<script setup lang="ts">
/**
 * 白噪音混音台
 * 15 种环境音全部由 Web Audio 实时合成(噪声 + 滤波 + 振荡器 + 调度事件),
 * 无需任何音频文件。每个音源支持独立音量与左右声像;内置场景预设与睡眠定时。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

/* ------------------------------ 音源定义 ------------------------------ */
interface SourceDef {
  key: string
  name: string
  /** 合成引擎:连接到目标节点,返回需要定时清理的句柄 */
  build: (ctx: AudioContext, dest: AudioNode) => Handles
}

interface Handles {
  stop: () => void
}

/** 白噪声缓冲(2 秒循环) */
function noiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (type === 'white') d[i] = w
    else if (type === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else {
      // Paul Kellet 粉噪近似
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buf
}

function loopNoise(ctx: AudioContext, dest: AudioNode, type: 'white' | 'pink' | 'brown', gain = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, type)
  src.loop = true
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g).connect(dest)
  src.start()
  return src
}

/** 周期/随机事件调度器 */
function scheduler(ctx: AudioContext, minMs: number, maxMs: number, fire: (at: number) => void): Handles {
  let timer = 0
  let stopped = false
  const tick = () => {
    if (stopped) return
    fire(ctx.currentTime + 0.05)
    timer = window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs))
  }
  timer = window.setTimeout(tick, Math.random() * maxMs)
  return { stop: () => { stopped = true; clearTimeout(timer) } }
}

/** 短促声音包络 */
function blip(ctx: AudioContext, dest: AudioNode, opts: { type: OscillatorType | 'noise'; freq: number; freqEnd?: number; dur: number; gain: number; at?: number; filter?: { type: BiquadFilterType; freq: number; q?: number } }) {
  const at = opts.at ?? ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(opts.gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur)
  let node: AudioNode
  if (opts.type === 'noise') {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 'white')
    src.loop = true
    node = src
    if (opts.filter) {
      const f = ctx.createBiquadFilter()
      f.type = opts.filter.type
      f.frequency.value = opts.filter.freq
      f.Q.value = opts.filter.q ?? 1
      node.connect(f)
      node = f
    }
    node.connect(g)
    src.start(at)
    src.stop(at + opts.dur + 0.05)
  } else {
    const osc = ctx.createOscillator()
    osc.type = opts.type
    osc.frequency.setValueAtTime(opts.freq, at)
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, at + opts.dur)
    osc.connect(g)
    osc.start(at)
    osc.stop(at + opts.dur + 0.05)
  }
  g.connect(dest)
}

const SOURCES: SourceDef[] = [
  { key: 'white', name: '白噪音', build: (c, d) => {
      const n = loopNoise(c, d, 'white', 0.5)
      return { stop: () => n.stop() }
    } },
  { key: 'pink', name: '粉噪音', build: (c, d) => {
      const n = loopNoise(c, d, 'pink', 0.7)
      return { stop: () => n.stop() }
    } },
  { key: 'brown', name: '棕噪音', build: (c, d) => {
      const n = loopNoise(c, d, 'brown', 0.9)
      return { stop: () => n.stop() }
    } },
  { key: 'rain', name: '雨声', build: (c, d) => {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1800
      bp.Q.value = 0.6
      const g = c.createGain()
      g.gain.value = 0.7
      const n = loopNoise(c, g, 'white', 0.8)
      g.connect(d)
      // 偶尔的大雨滴
      const drops = scheduler(c, 120, 600, (at) => blip(c, d, { type: 'sine', freq: 900 + Math.random() * 900, freqEnd: 300, dur: 0.06, gain: 0.05, at }))
      return { stop: () => { n.stop(); drops.stop() } }
    } },
  { key: 'wind', name: '风声', build: (c, d) => {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 400
      const lfo = c.createOscillator()
      lfo.frequency.value = 0.07
      const lfoGain = c.createGain()
      lfoGain.gain.value = 260
      lfo.connect(lfoGain).connect(lp.frequency)
      lfo.start()
      const n = loopNoise(c, lp, 'brown', 1.2)
      lp.connect(d)
      return { stop: () => { n.stop(); lfo.stop() } }
    } },
  { key: 'wave', name: '海浪', build: (c, d) => {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      const g = c.createGain()
      g.gain.value = 0.5
      const lfo = c.createOscillator()
      lfo.frequency.value = 0.09
      const lfoGain = c.createGain()
      lfoGain.gain.value = 0.45
      lfo.connect(lfoGain).connect(g.gain)
      lfo.start()
      const n = loopNoise(c, lp, 'brown', 1)
      g.connect(d)
      return { stop: () => { n.stop(); lfo.stop() } }
    } },
  { key: 'fire', name: '篝火', build: (c, d) => {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      const n = loopNoise(c, lp, 'brown', 0.6)
      lp.connect(d)
      const crackle = scheduler(c, 60, 400, (at) => blip(c, d, { type: 'noise', freq: 0, dur: 0.03 + Math.random() * 0.04, gain: 0.12 + Math.random() * 0.1, at, filter: { type: 'highpass', freq: 1500 } }))
      return { stop: () => { n.stop(); crackle.stop() } }
    } },
  { key: 'thunder', name: '雷声', build: (c, d) => {
      const rumble = scheduler(c, 9000, 22000, (at) => {
        const dur = 1.6 + Math.random() * 1.6
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.5, at + 0.08)
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 200
        const n = c.createBufferSource()
        n.buffer = noiseBuffer(c, 'brown')
        n.loop = true
        n.connect(lp).connect(g).connect(d)
        n.start(at)
        n.stop(at + dur + 0.1)
      })
      return { stop: rumble.stop }
    } },
  { key: 'bird', name: '鸟鸣', build: (c, d) => {
      const chirp = scheduler(c, 1800, 5200, (at) => {
        const n = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < n; i++) {
          blip(c, d, { type: 'sine', freq: 2200 + Math.random() * 1800, freqEnd: 1400 + Math.random() * 1200, dur: 0.09, gain: 0.06, at: at + i * (0.12 + Math.random() * 0.1) })
        }
      })
      return { stop: chirp.stop }
    } },
  { key: 'clock', name: '时钟', build: (c, d) => {
      const tick = scheduler(c, 1000, 1000, (at) => blip(c, d, { type: 'square', freq: 1800, dur: 0.025, gain: 0.05, at, filter: { type: 'highpass', freq: 900 } }))
      return { stop: tick.stop }
    } },
  { key: 'keyboard', name: '键盘', build: (c, d) => {
      const type = scheduler(c, 90, 900, (at) => blip(c, d, { type: 'noise', freq: 0, dur: 0.02, gain: 0.08 + Math.random() * 0.06, at, filter: { type: 'bandpass', freq: 2400 + Math.random() * 1800, q: 2 } }))
      return { stop: type.stop }
    } },
  { key: 'train', name: '夜行列车', build: (c, d) => {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 300
      const n = loopNoise(c, lp, 'brown', 0.9)
      lp.connect(d)
      // 有节奏的哐当声
      const clack = scheduler(c, 1400, 1400, (at) => {
        blip(c, d, { type: 'noise', freq: 0, dur: 0.05, gain: 0.07, at, filter: { type: 'bandpass', freq: 500, q: 1.5 } })
        blip(c, d, { type: 'noise', freq: 0, dur: 0.05, gain: 0.05, at: at + 0.18, filter: { type: 'bandpass', freq: 420, q: 1.5 } })
      })
      return { stop: () => { n.stop(); clack.stop() } }
    } },
  { key: 'chime', name: '风铃', build: (c, d) => {
      const scale = [523.25, 587.33, 659.25, 783.99, 880]
      const ring = scheduler(c, 1500, 6000, (at) => {
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1)
        blip(c, d, { type: 'sine', freq: f, dur: 1.4, gain: 0.05, at })
        blip(c, d, { type: 'sine', freq: f * 2.76, dur: 0.7, gain: 0.015, at })
      })
      return { stop: ring.stop }
    } },
  { key: 'bowl', name: '颂钵', build: (c, d) => {
      const strike = scheduler(c, 7000, 14000, (at) => {
        ;[220, 552, 812].forEach((f, i) => blip(c, d, { type: 'sine', freq: f, dur: 3.5 - i * 0.6, gain: 0.09 / (i + 1), at }))
      })
      return { stop: strike.stop }
    } },
  { key: 'crickets', name: '虫鸣', build: (c, d) => {
      const chirp = scheduler(c, 300, 800, (at) => {
        for (let i = 0; i < 3; i++) blip(c, d, { type: 'sine', freq: 4200 + Math.random() * 600, dur: 0.03, gain: 0.03, at: at + i * 0.07 })
      })
      return { stop: chirp.stop }
    } },
]

function loopStop(_c: AudioContext) { /* 已不再需要,保留占位防误用 */ }
void loopStop

/* ------------------------------ 混音状态 ------------------------------ */
interface Mix {
  on: boolean
  gain: number   // 0~1
  pan: number    // -1~1
}

const state = reactive<Record<string, Mix>>({})
SOURCES.forEach((s) => { state[s.key] = { on: false, gain: 0.6, pan: 0 } })

const playing = ref(false)
const masterVol = ref(0.8)
const timerMin = ref(0)
const timerLeft = ref('')

let ctx: AudioContext | null = null
let master: GainNode | null = null
const nodes = new Map<string, { src: Handles; gain: GainNode; pan: StereoPannerNode }>()
let timer: number | null = null

const activeCount = computed(() => SOURCES.filter((s) => state[s.key].on).length)

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = masterVol.value
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function startOne(def: SourceDef) {
  if (!ctx || !master || nodes.has(def.key)) return
  const mix = state[def.key]
  const gain = ctx.createGain()
  gain.gain.value = mix.gain
  const pan = ctx.createStereoPanner()
  pan.pan.value = mix.pan
  gain.connect(pan).connect(master)
  const handles = def.build(ctx, gain)
  nodes.set(def.key, { src: handles, gain, pan })
}

function stopOne(key: string) {
  const n = nodes.get(key)
  if (!n) return
  n.gain.gain.setTargetAtTime(0.0001, ctx!.currentTime, 0.15)
  setTimeout(() => { n.src.stop(); n.gain.disconnect(); n.pan.disconnect() }, 500)
  nodes.delete(key)
}

function toggle(key: string) {
  const def = SOURCES.find((s) => s.key === key)
  if (!def) return
  state[key].on = !state[key].on
  if (state[key].on) {
    ensureCtx()
    startOne(def)
    playing.value = true
  } else {
    stopOne(key)
    if (activeCount.value === 0) playing.value = false
  }
}

function onGain(key: string) {
  const n = nodes.get(key)
  if (n && ctx) n.gain.gain.setTargetAtTime(state[key].gain, ctx.currentTime, 0.05)
}

function onPan(key: string) {
  const n = nodes.get(key)
  if (n && ctx) n.pan.pan.setTargetAtTime(state[key].pan, ctx.currentTime, 0.05)
}

function onMaster() {
  if (master && ctx) master.gain.setTargetAtTime(masterVol.value, ctx.currentTime, 0.05)
}

const SCENES: Record<string, string[]> = {
  sleep: ['rain', 'thunder', 'wave'],
  read: ['fire', 'rain', 'pink'],
  focus: ['brown', 'keyboard', 'clock'],
  idle: ['bird', 'wind', 'chime'],
}
const SCENE_NAMES: Record<string, string> = { sleep: '安眠', read: '静读', focus: '专注', idle: '闲坐' }

function applyScene(key: string) {
  ensureCtx()
  SOURCES.forEach((s) => {
    const want = SCENES[key].includes(s.key)
    if (want && !state[s.key].on) { state[s.key].on = true; startOne(s) }
    if (!want && state[s.key].on) { state[s.key].on = false; stopOne(s.key) }
  })
  playing.value = activeCount.value > 0
  ElMessage.success(`已切换到「${SCENE_NAMES[key]}」场景`)
}

function stopAll() {
  SOURCES.forEach((s) => { state[s.key].on = false })
  nodes.forEach((n) => { n.src.stop(); n.gain.disconnect(); n.pan.disconnect() })
  nodes.clear()
  playing.value = false
  clearTimer()
}

function startTimer() {
  if (!timerMin.value) return
  clearTimer()
  const end = Date.now() + timerMin.value * 60000
  timer = window.setInterval(() => {
    const left = end - Date.now()
    if (left <= 0) {
      stopAll()
      ElMessage.success('定时到了,已停止播放')
    } else {
      const m = Math.floor(left / 60000)
      const s = Math.floor((left % 60000) / 1000)
      timerLeft.value = `${m}:${String(s).padStart(2, '0')}`
    }
  }, 500)
  ElMessage.success(`将在 ${timerMin.value} 分钟后自动停止`)
}

function clearTimer() {
  if (timer) { clearInterval(timer); timer = null }
  timerLeft.value = ''
}

onBeforeUnmount(() => {
  stopAll()
  void ctx?.close()
  ctx = null
})
</script>

<template>
  <div class="mixer" :class="{ playing }">
    <div class="head">
      <div class="head-main">
        <h3 class="head-title">白噪音混音台</h3>
        <p class="head-sub">全部声音由 Web Audio 实时合成,点击卡片开启,可叠加多层</p>
      </div>
      <div class="head-actions">
        <el-select v-model="timerMin" size="small" class="timer-select" placeholder="睡眠定时" @change="startTimer">
          <el-option :value="0" label="不定时" />
          <el-option :value="15" label="15 分钟" />
          <el-option :value="30" label="30 分钟" />
          <el-option :value="60" label="60 分钟" />
        </el-select>
        <span v-if="timerLeft" class="timer-left">{{ timerLeft }}</span>
        <el-button v-if="playing" size="small" @click="stopAll">全部停止</el-button>
      </div>
    </div>

    <!-- 场景 -->
    <div class="scenes">
      <el-button v-for="(n, k) in SCENE_NAMES" :key="k" size="small" round @click="applyScene(k)">{{ n }}</el-button>
      <div class="master">
        <span class="m-label">总音量</span>
        <el-slider v-model="masterVol" :show-tooltip="false" style="width: 140px" @input="onMaster" />
      </div>
    </div>

    <!-- 音源卡片 -->
    <div class="grid">
      <div
        v-for="s in SOURCES"
        :key="s.key"
        class="src"
        :class="{ on: state[s.key].on }"
        @click="toggle(s.key)"
      >
        <div class="src-head">
          <span class="src-name">{{ s.name }}</span>
          <span class="src-dot" :class="{ lit: state[s.key].on }" />
        </div>
        <div class="src-ctrl" @click.stop>
          <el-slider
            v-model="state[s.key].gain"
            size="small"
            :show-tooltip="false"
            :disabled="!state[s.key].on"
            @input="onGain(s.key)"
          />
          <div class="pan-row" @click.stop>
            <span class="pan-label">左</span>
            <el-slider
              v-model="state[s.key].pan"
              size="small"
              :min="-1"
              :max="1"
              :step="0.1"
              :show-tooltip="false"
              :disabled="!state[s.key].on"
              @input="onPan(s.key)"
            />
            <span class="pan-label">右</span>
          </div>
        </div>
      </div>
    </div>

    <p class="foot">提示:浏览器策略要求首次点击页面后才会出声;全部声音本地合成,不加载任何音频文件。</p>
  </div>
</template>

<style scoped>
.mixer {
  --tone: #14b8a6;
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
.head-title {
  margin: 0;
  font-size: 16px;
}
.head-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timer-select {
  width: 110px;
}
.timer-left {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--tone);
}
.scenes {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.master {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.src {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}
.src:hover {
  transform: translateY(-1px);
}
.src.on {
  border-color: var(--tone);
  background: color-mix(in srgb, var(--tone) 8%, var(--el-bg-color));
}
.src-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.src-name {
  font-size: 13px;
  font-weight: 600;
}
.src-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-fill-color);
}
.src-dot.lit {
  background: var(--tone);
  box-shadow: 0 0 6px var(--tone);
}
.src-ctrl {
  pointer-events: auto;
}
.pan-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.pan-label {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
