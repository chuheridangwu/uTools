<script setup lang="ts">
/**
 * 乐器体验馆
 * 两八度虚拟键盘,全部音色由 Web Audio 实时合成(无音频文件):
 * 钢琴 / 吉他 / 八音盒 / 电子琴 / 管风琴。
 * 支持鼠标点击与电脑键盘演奏(下半 z-s-x-d… 上半 q-2-w-3…)。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

/* ------------------------------ 音色配置 ------------------------------ */
interface Timbre {
  name: string
  partials: { type: OscillatorType; mult: number; gain: number }[]
  attack: number
  decay: number
  sustain: number
  release: number
  filter?: { type: BiquadFilterType; freq: number; q: number }
}

const TIMBRES: Record<string, Timbre> = {
  piano: {
    name: '钢琴',
    partials: [
      { type: 'sine', mult: 1, gain: 1 },
      { type: 'sine', mult: 2, gain: 0.5 },
      { type: 'sine', mult: 3, gain: 0.22 },
      { type: 'sine', mult: 4.2, gain: 0.1 },
    ],
    attack: 0.005,
    decay: 2.4,
    sustain: 0.0001,
    release: 0.25,
  },
  guitar: {
    name: '吉他',
    partials: [
      { type: 'sawtooth', mult: 1, gain: 1 },
      { type: 'sawtooth', mult: 2, gain: 0.3 },
    ],
    attack: 0.004,
    decay: 1.2,
    sustain: 0.0001,
    release: 0.2,
    filter: { type: 'lowpass', freq: 2200, q: 1 },
  },
  musicbox: {
    name: '八音盒',
    partials: [
      { type: 'sine', mult: 1, gain: 0.8 },
      { type: 'triangle', mult: 4, gain: 0.5 },
      { type: 'sine', mult: 8, gain: 0.15 },
    ],
    attack: 0.002,
    decay: 1.4,
    sustain: 0.0001,
    release: 0.15,
  },
  synth: {
    name: '电子琴',
    partials: [
      { type: 'square', mult: 1, gain: 0.7 },
      { type: 'sawtooth', mult: 0.5, gain: 0.3 },
      { type: 'sawtooth', mult: 1.005, gain: 0.4 },
    ],
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: 0.35,
    filter: { type: 'lowpass', freq: 3000, q: 2 },
  },
  organ: {
    name: '管风琴',
    partials: [
      { type: 'sine', mult: 1, gain: 0.7 },
      { type: 'sine', mult: 2, gain: 0.4 },
      { type: 'sine', mult: 3, gain: 0.25 },
      { type: 'sine', mult: 4, gain: 0.15 },
    ],
    attack: 0.03,
    decay: 0.1,
    sustain: 0.85,
    release: 0.4,
  },
}

const timbreKey = ref<keyof typeof TIMBRES>('piano')
const vol = ref(0.7)

/* ------------------------------ 键盘布局 ------------------------------ */
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function noteMidi(name: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(name)!
  return SEMI[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12
}
function noteFreq(name: string): number {
  return 440 * 2 ** ((noteMidi(name) - 69) / 12)
}

interface Key {
  note: string
  freq: number
  black: boolean
  /** 白键序号(黑键用其左侧白键序号定位) */
  whiteIndex: number
  /** 电脑键盘绑定 */
  binding: string
}

const KEYS: Key[] = []
{
  const whiteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const blackAfter: Record<string, string | undefined> = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' }
  const bindings: Record<string, string> = {
    C4: 'z', 'C#4': 's', D4: 'x', 'D#4': 'd', E4: 'c', F4: 'v', 'F#4': 'g', G4: 'b', 'G#4': 'h', A4: 'n', 'A#4': 'j', B4: 'm',
    C5: 'q', 'C#5': '2', D5: 'w', 'D#5': '3', E5: 'e', F5: 'r', 'F#5': '5', G5: 't', 'G#5': '6', A5: 'y', 'A#5': '7', B5: 'u',
  }
  let wi = 0
  for (const oct of [4, 5]) {
    for (const w of whiteNames) {
      const note = w + oct
      KEYS.push({ note, freq: noteFreq(note), black: false, whiteIndex: wi, binding: bindings[note] || '' })
      const bn = blackAfter[w]
      if (bn) {
        const bnote = bn + oct
        KEYS.push({ note: bnote, freq: noteFreq(bnote), black: true, whiteIndex: wi, binding: bindings[bnote] || '' })
      }
      wi++
    }
  }
  KEYS.push({ note: 'C6', freq: noteFreq('C6'), black: false, whiteIndex: wi, binding: '' })
}

const whiteKeys = computed(() => KEYS.filter((k) => !k.black))
const whiteCount = computed(() => whiteKeys.value.length)

/** 黑键的左侧偏移百分比 */
function blackLeft(k: Key): string {
  const step = 100 / whiteCount.value
  return `${(k.whiteIndex + 1) * step}%`
}

/* ------------------------------ 音频引擎 ------------------------------ */
let ctx: AudioContext | null = null
let master: GainNode | null = null
const voices = new Map<string, { oscs: OscillatorNode[]; gain: GainNode }>()
const active = ref<Set<string>>(new Set())

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = vol.value * 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noteOn(k: Key) {
  if (voices.has(k.note)) return
  const c = ensure()
  if (!master) return
  const t = TIMBRES[timbreKey.value]
  const at = c.currentTime
  const gain = c.createGain()
  let node: AudioNode = gain
  if (t.filter) {
    const f = c.createBiquadFilter()
    f.type = t.filter.type
    f.frequency.value = t.filter.freq
    f.Q.value = t.filter.q
    gain.connect(f)
    node = f
  }
  node.connect(master)

  const peak = 0.28
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + t.attack)
  gain.gain.exponentialRampToValueAtTime(Math.max(t.sustain * peak, 0.0001), at + t.attack + t.decay)

  const oscs: OscillatorNode[] = []
  for (const p of t.partials) {
    const osc = c.createOscillator()
    osc.type = p.type
    osc.frequency.value = k.freq * p.mult
    const pg = c.createGain()
    pg.gain.value = p.gain
    osc.connect(pg).connect(gain)
    osc.start(at)
    oscs.push(osc)
  }
  voices.set(k.note, { oscs, gain })
  active.value = new Set(active.value).add(k.note)
}

function noteOff(k: Key) {
  const v = voices.get(k.note)
  if (!v || !ctx) return
  const t = TIMBRES[timbreKey.value]
  const at = ctx.currentTime
  v.gain.gain.cancelScheduledValues(at)
  v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), at)
  v.gain.gain.exponentialRampToValueAtTime(0.0001, at + t.release)
  v.oscs.forEach((o) => o.stop(at + t.release + 0.05))
  const next = new Set(active.value)
  next.delete(k.note)
  active.value = next
  setTimeout(() => voices.delete(k.note), (t.release + 0.1) * 1000)
}

function stopAll() {
  KEYS.forEach((k) => noteOff(k))
}

/* ------------------------------ 交互 ------------------------------ */
const holding = new Set<string>()

function keyDown(k: Key) {
  noteOn(k)
}
function keyUp(k: Key) {
  noteOff(k)
}

function onKeydown(e: KeyboardEvent) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  const k = KEYS.find((x) => x.binding === e.key.toLowerCase())
  if (k && !holding.has(k.note)) {
    holding.add(k.note)
    keyDown(k)
  }
}
function onKeyup(e: KeyboardEvent) {
  const k = KEYS.find((x) => x.binding === e.key.toLowerCase())
  if (k && holding.has(k.note)) {
    holding.delete(k.note)
    keyUp(k)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  stopAll()
  void ctx?.close()
  ctx = null
})

watch(vol, (v) => {
  if (master && ctx) master.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.05)
})

watch(timbreKey, () => {
  stopAll()
  ElMessage.success(`已切换到「${TIMBRES[timbreKey.value].name}」`)
})

function isActive(note: string): boolean {
  return active.value.has(note)
}
</script>

<template>
  <div class="inst">
    <div class="head">
      <div>
        <h3 class="title">乐器体验馆</h3>
        <p class="sub">点击琴键或用电脑键盘演奏,音色实时合成</p>
      </div>
      <div class="head-acts">
        <el-radio-group v-model="timbreKey" size="small">
          <el-radio-button v-for="(t, k) in TIMBRES" :key="k" :value="k">{{ t.name }}</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="tools">
      <span class="t-label">音量</span>
      <el-slider v-model="vol" :show-tooltip="false" style="width: 140px" />
      <el-button size="small" @click="stopAll">停止全部</el-button>
    </div>

    <div class="piano" @mouseleave="stopAll">
      <!-- 白键 -->
      <div class="whites">
        <div
          v-for="k in whiteKeys"
          :key="k.note"
          class="white"
          :class="{ on: isActive(k.note) }"
          @mousedown="keyDown(k)"
          @mouseup="keyUp(k)"
          @mouseleave="isActive(k.note) && keyUp(k)"
        >
          <span class="w-label">{{ k.binding.toUpperCase() }}</span>
          <span class="w-note">{{ k.note }}</span>
        </div>
      </div>
      <!-- 黑键 -->
      <div class="blacks">
        <div
          v-for="k in KEYS.filter((x) => x.black)"
          :key="k.note"
          class="black"
          :class="{ on: isActive(k.note) }"
          :style="{ left: blackLeft(k) }"
          @mousedown.stop="keyDown(k)"
          @mouseup.stop="keyUp(k)"
          @mouseleave="isActive(k.note) && keyUp(k)"
        >
          <span class="b-label">{{ k.binding.toUpperCase() }}</span>
        </div>
      </div>
    </div>

    <p class="foot">键盘映射:下半八度 z s x d c v g b h n j m;上半八度 q 2 w 3 e r 5 t 6 y 7 u。</p>
  </div>
</template>

<style scoped>
.inst {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.t-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.piano {
  position: relative;
  height: 220px;
  user-select: none;
  max-width: 900px;
}
.whites {
  display: flex;
  height: 100%;
}
.white {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 0 0 6px 6px;
  background: linear-gradient(180deg, #ffffff, #eef2f7);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 10px;
  gap: 4px;
  cursor: pointer;
  transition: background 0.05s;
}
.white.on {
  background: linear-gradient(180deg, #d1fae5, #a7f3d0);
}
.w-label {
  font-size: 11px;
  color: #94a3b8;
}
.w-note {
  font-size: 11px;
  color: #64748b;
}
.blacks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.black {
  position: absolute;
  top: 0;
  width: 4.6%;
  height: 60%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #1e293b, #0f172a);
  border-radius: 0 0 5px 5px;
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 8px;
}
.black.on {
  background: linear-gradient(180deg, #0d9488, #0f766e);
}
.b-label {
  font-size: 10px;
  color: #94a3b8;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
