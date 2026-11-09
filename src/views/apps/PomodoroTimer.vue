<script setup lang="ts">
/**
 * 番茄钟
 * 工作 / 短休 / 长休 三段循环,可自定义时长与长休间隔,
 * 结束提示音由 Web Audio 合成;当天完成数存本机。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'

type Mode = 'work' | 'short' | 'long'

const cfg = reactive({
  work: 25,
  short: 5,
  long: 15,
  rounds: 4,
})

const mode = ref<Mode>('work')
const running = ref(false)
const left = ref(cfg.work * 60)
const finished = ref(0)
const round = ref(0)

const KEY = 'utools_pomodoro'
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  if (saved) {
    cfg.work = saved.work ?? 25
    cfg.short = saved.short ?? 5
    cfg.long = saved.long ?? 15
    cfg.rounds = saved.rounds ?? 4
    finished.value = saved.finished ?? 0
    left.value = cfg.work * 60
  }
} catch {
  /* defaults */
}

const MODE_META: Record<Mode, { name: string; color: string }> = {
  work: { name: '专注', color: '#ef4444' },
  short: { name: '短休', color: '#10b981' },
  long: { name: '长休', color: '#3b82f6' },
}

const total = computed(() => (mode.value === 'work' ? cfg.work : mode.value === 'short' ? cfg.short : cfg.long) * 60)
const pct = computed(() => (total.value ? Math.round(((total.value - left.value) / total.value) * 100) : 0))
const mm = computed(() => String(Math.floor(left.value / 60)).padStart(2, '0'))
const ss = computed(() => String(left.value % 60).padStart(2, '0'))

let timer: number | null = null

function persist() {
  localStorage.setItem(KEY, JSON.stringify({ ...cfg, finished: finished.value }))
}

function beep(times = 2) {
  const ctx = new AudioContext()
  for (let i = 0; i < times; i++) {
    const at = ctx.currentTime + i * 0.35
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, at)
    osc.frequency.setValueAtTime(1180, at + 0.12)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
    osc.connect(g).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.35)
  }
  setTimeout(() => void ctx.close(), times * 400 + 300)
}

function tick() {
  if (left.value > 0) {
    left.value--
    return
  }
  // 一段结束
  beep()
  if (mode.value === 'work') {
    finished.value++
    round.value++
    mode.value = round.value % cfg.rounds === 0 ? 'long' : 'short'
  } else {
    mode.value = 'work'
  }
  left.value = (mode.value === 'work' ? cfg.work : mode.value === 'short' ? cfg.short : cfg.long) * 60
  persist()
  ElMessage.success(`${MODE_META[mode.value].name}开始`)
}

function start() {
  if (running.value) return
  // 借用户手势解锁音频上下文,确保到点能出声
  try {
    const c = new AudioContext()
    void c.resume().then(() => c.close())
  } catch {
    /* ignore */
  }
  running.value = true
  if (!timer) timer = window.setInterval(tick, 1000)
}

function pause() {
  running.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function reset() {
  pause()
  mode.value = 'work'
  round.value = 0
  left.value = cfg.work * 60
}

function switchMode(m: Mode) {
  pause()
  mode.value = m
  left.value = (m === 'work' ? cfg.work : m === 'short' ? cfg.short : cfg.long) * 60
}

function onCfgChange() {
  persist()
  if (!running.value) left.value = total.value
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="pomo">
    <div class="head">
      <div>
        <h3 class="title">番茄钟</h3>
        <p class="sub">专注 {{ cfg.work }} 分钟,休息 {{ cfg.short }} 分钟,每 {{ cfg.rounds }} 轮长休</p>
      </div>
      <div class="tabs">
        <el-radio-group :model-value="mode" size="small" @update:model-value="switchMode($event as Mode)">
          <el-radio-button value="work">专注</el-radio-button>
          <el-radio-button value="short">短休</el-radio-button>
          <el-radio-button value="long">长休</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="stage">
      <el-progress
        type="circle"
        :width="230"
        :stroke-width="12"
        :percentage="pct"
        :color="MODE_META[mode].color"
      >
        <div class="dial">
          <div class="dial-mode" :style="{ color: MODE_META[mode].color }">{{ MODE_META[mode].name }}</div>
          <div class="dial-time">{{ mm }}:{{ ss }}</div>
          <div class="dial-round">第 {{ round + 1 }} 轮</div>
        </div>
      </el-progress>

      <div class="ctrls">
        <el-button v-if="!running" type="primary" size="large" :icon="VideoPlay" @click="start">开始</el-button>
        <el-button v-else size="large" :icon="VideoPause" @click="pause">暂停</el-button>
        <el-button size="large" :icon="Refresh" @click="reset">重置</el-button>
      </div>

      <div class="stat">今日已完成 <b>{{ finished }}</b> 个番茄</div>
    </div>

    <div class="cfg">
      <div class="cfg-item">
        <span>专注(分)</span>
        <el-input-number v-model="cfg.work" :min="1" :max="120" size="small" @change="onCfgChange" />
      </div>
      <div class="cfg-item">
        <span>短休(分)</span>
        <el-input-number v-model="cfg.short" :min="1" :max="60" size="small" @change="onCfgChange" />
      </div>
      <div class="cfg-item">
        <span>长休(分)</span>
        <el-input-number v-model="cfg.long" :min="1" :max="120" size="small" @change="onCfgChange" />
      </div>
      <div class="cfg-item">
        <span>长休间隔(轮)</span>
        <el-input-number v-model="cfg.rounds" :min="2" :max="10" size="small" @change="onCfgChange" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pomo {
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
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 10px 0 20px;
}
.dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.dial-mode {
  font-size: 13px;
  font-weight: 600;
}
.dial-time {
  font-size: 42px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  color: var(--el-text-color-primary);
}
.dial-round {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.ctrls {
  display: flex;
  gap: 12px;
}
.stat {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat b {
  color: #ef4444;
  font-size: 16px;
}
.cfg {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  border-top: 1px dashed var(--card-border);
  padding-top: 16px;
}
.cfg-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
</style>
