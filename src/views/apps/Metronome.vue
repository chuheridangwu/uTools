<script setup lang="ts">
/**
 * 节拍器
 * 用 Web Audio 的 lookahead 调度器(提前 120ms 排音)保证节奏不受主线程抖动影响,
 * 支持拍号、细分、重音、音量与 Tap Tempo;所有声音实时合成,不加载音频文件。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { VideoPause, VideoPlay } from '@element-plus/icons-vue'

const state = reactive({
  bpm: 100,
  beats: 4,
  subdiv: 1,
  volume: 0.6,
  sound: 'click',
})

const playing = ref(false)
const activeBeat = ref(-1)
const activeStep = ref(-1)

const METERS = [
  { beats: 2, label: '2 / 4' },
  { beats: 3, label: '3 / 4' },
  { beats: 4, label: '4 / 4' },
  { beats: 6, label: '6 / 8' },
]
const SUBS = [
  { n: 1, label: '每拍' },
  { n: 2, label: '八分' },
  { n: 3, label: '三连音' },
  { n: 4, label: '十六分' },
]
const SOUNDS = [
  { key: 'click', label: '电子点击' },
  { key: 'wood', label: '木鱼' },
  { key: 'beep', label: '方波提示' },
]

const tempoName = computed(() => {
  const b = state.bpm
  if (b < 60) return 'Grave · 极慢'
  if (b < 76) return 'Largo · 广板'
  if (b < 108) return 'Andante · 行板'
  if (b < 120) return 'Moderato · 中板'
  if (b < 156) return 'Allegro · 快板'
  if (b < 176) return 'Vivace · 活泼'
  return 'Presto · 急板'
})

let ctx: AudioContext | null = null
let timer: number | null = null
let raf: number | null = null
let nextTime = 0
let step = 0
const queue: { time: number; step: number }[] = []

function tone(time: number, freq: number, dur: number, level: number, type: OscillatorType) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, time)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + dur + 0.02)
}

function scheduleStep(time: number, s: number) {
  const beat = Math.floor(s / state.subdiv)
  const isBeat = s % state.subdiv === 0
  const isAccent = isBeat && beat % state.beats === 0
  let freq = 760
  let dur = 0.045
  let level = 0.22
  let type: OscillatorType = 'sine'
  if (isAccent) {
    freq = 1200
    level = 0.5
    dur = 0.06
  } else if (!isBeat) {
    freq = 520
    level = 0.12
    dur = 0.03
  }
  if (state.sound === 'wood') {
    type = 'triangle'
    freq = isAccent ? 900 : isBeat ? 620 : 460
  } else if (state.sound === 'beep') {
    type = 'square'
    freq = isAccent ? 1320 : 880
    dur = 0.05
    level *= 0.55
  }
  tone(time, freq, dur, level * state.volume, type)
  queue.push({ time, step: s })
}

function draw() {
  if (!ctx) return
  const now = ctx.currentTime
  while (queue.length && queue[0].time <= now) {
    const e = queue.shift()!
    activeStep.value = e.step % state.subdiv
    activeBeat.value = Math.floor(e.step / state.subdiv) % state.beats
  }
  raf = requestAnimationFrame(draw)
}

function scheduler() {
  if (!ctx) return
  const stepDur = 60 / state.bpm / state.subdiv
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(nextTime, step)
    nextTime += stepDur
    step++
  }
}

async function start() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  playing.value = true
  step = 0
  queue.length = 0
  nextTime = ctx.currentTime + 0.06
  scheduler()
  timer = window.setInterval(scheduler, 25)
  raf = requestAnimationFrame(draw)
}

function stop() {
  playing.value = false
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
  queue.length = 0
  activeBeat.value = -1
  activeStep.value = -1
}

function toggle() {
  if (playing.value) stop()
  else void start()
}

/** 改变拍号/细分后重新对齐小节,避免相位错乱 */
function resetPhase() {
  if (!playing.value || !ctx) return
  queue.length = 0
  step = 0
  nextTime = ctx.currentTime + 0.06
}

const taps: number[] = []
function tap() {
  const t = performance.now()
  if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0
  taps.push(t)
  if (taps.length > 5) taps.shift()
  if (taps.length < 2) return
  const gaps = taps.slice(1).map((x, i) => x - taps[i])
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  state.bpm = Math.min(240, Math.max(40, Math.round(60000 / avg)))
}

onBeforeUnmount(() => {
  stop()
  if (ctx) void ctx.close()
  ctx = null
})
</script>

<template>
  <div class="mt">
    <div class="head">
      <div>
        <h3 class="title">节拍器</h3>
        <p class="sub">Web Audio 实时合成 · 拍号 / 细分 / 重音 / Tap Tempo</p>
      </div>
      <span class="tempo">{{ tempoName }}</span>
    </div>

    <div class="bpm-row">
      <div class="bpm-num">
        <span class="bpm-value">{{ state.bpm }}</span>
        <span class="bpm-unit">BPM</span>
      </div>
      <div class="bpm-ctl">
        <el-slider v-model="state.bpm" :min="40" :max="240" :show-tooltip="false" />
        <div class="bpm-sub">
          <el-input-number v-model="state.bpm" :min="40" :max="240" size="small" controls-position="right" />
          <el-button size="small" @click="tap">Tap Tempo</el-button>
          <span class="hint">连续敲击 2~5 下自动测速</span>
        </div>
      </div>
    </div>

    <div class="beats">
      <div v-for="b in state.beats" :key="b" class="beat" :class="{ on: activeBeat === b - 1, first: b === 1 }">
        <span class="beat-n">{{ b }}</span>
        <span v-if="state.subdiv > 1" class="subs">
          <i v-for="s in state.subdiv" :key="s" :class="{ on: activeBeat === b - 1 && activeStep === s - 1 }" />
        </span>
      </div>
    </div>

    <div class="play-row">
      <el-button type="primary" size="large" :icon="playing ? VideoPause : VideoPlay" @click="toggle">
        {{ playing ? '停止' : '开始' }}
      </el-button>
    </div>

    <div class="opts">
      <div class="opt">
        <span class="lbl">拍号</span>
        <el-select v-model="state.beats" size="small" style="width: 110px" @change="resetPhase">
          <el-option v-for="m in METERS" :key="m.beats" :label="m.label" :value="m.beats" />
        </el-select>
      </div>
      <div class="opt">
        <span class="lbl">细分</span>
        <el-select v-model="state.subdiv" size="small" style="width: 110px" @change="resetPhase">
          <el-option v-for="s in SUBS" :key="s.n" :label="s.label" :value="s.n" />
        </el-select>
      </div>
      <div class="opt">
        <span class="lbl">音色</span>
        <el-select v-model="state.sound" size="small" style="width: 130px">
          <el-option v-for="s in SOUNDS" :key="s.key" :label="s.label" :value="s.key" />
        </el-select>
      </div>
      <div class="opt vol">
        <span class="lbl">音量</span>
        <el-slider v-model="state.volume" :min="0" :max="1" :step="0.05" :show-tooltip="false" />
      </div>
    </div>

    <p class="foot">提示:小节第一拍为重音;浏览器需用户点击后才允许播放声音,所有音频均在本机合成,不产生任何网络请求。</p>
  </div>
</template>

<style scoped>
.mt {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
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
.tempo {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.bpm-row {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 18px;
}
.bpm-num {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 130px;
}
.bpm-value {
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
}
.bpm-unit {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.bpm-ctl {
  flex: 1;
  min-width: 0;
}
.bpm-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.beats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--el-fill-color-light);
  margin-bottom: 16px;
}
.beat {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2px solid var(--card-border);
  background: var(--el-bg-color);
  transition: transform 0.08s, background 0.08s, border-color 0.08s;
}
.beat.on {
  transform: scale(1.12);
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}
.beat.on.first {
  border-color: #f43f5e;
  background: color-mix(in srgb, #f43f5e 22%, transparent);
}
.beat-n {
  font-size: 16px;
  font-weight: 600;
}
.subs {
  display: flex;
  gap: 3px;
}
.subs i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}
.subs i.on {
  background: var(--el-color-primary);
}
.play-row {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.opts {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
}
.opt.vol {
  flex: 1;
  min-width: 160px;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
