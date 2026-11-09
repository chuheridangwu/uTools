<script setup lang="ts">
/**
 * 秒表与计时器
 * 左侧秒表:支持开始/暂停/计次(分段),精确到 10ms;
 * 右侧倒计时:自定义时长,到点提示音;两者互不干扰。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshLeft, VideoPause, VideoPlay } from '@element-plus/icons-vue'

/* ------------------------------ 秒表 ------------------------------ */
const swRunning = ref(false)
const swElapsed = ref(0) // ms
const laps = reactive<{ list: number[] }>({ list: [] })
let swTimer: number | null = null
let swLast = 0

function swTick() {
  const now = performance.now()
  swElapsed.value += now - swLast
  swLast = now
}

function swToggle() {
  if (swRunning.value) {
    swRunning.value = false
    if (swTimer) { clearInterval(swTimer); swTimer = null }
  } else {
    swRunning.value = true
    swLast = performance.now()
    swTimer = window.setInterval(swTick, 37)
  }
}

function swLap() {
  if (!swElapsed.value) return
  laps.list.unshift(swElapsed.value)
}

function swReset() {
  swRunning.value = false
  if (swTimer) { clearInterval(swTimer); swTimer = null }
  swElapsed.value = 0
  laps.list = []
}

function fmtMs(ms: number): string {
  const t = Math.floor(ms)
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  const s = Math.floor((t % 60000) / 1000)
  const cs = Math.floor((t % 1000) / 10)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}.${pad(cs)}`
}

const lapDiff = computed(() => laps.list)

/* ------------------------------ 倒计时 ------------------------------ */
const timerCfg = reactive({ h: 0, m: 5, s: 0 })
const cdLeft = ref(0) // 秒
const cdRunning = ref(false)
let cdTimer: number | null = null

const cdTotal = computed(() => timerCfg.h * 3600 + timerCfg.m * 60 + timerCfg.s)
const cdPct = computed(() => (cdTotal.value ? Math.round(((cdTotal.value - cdLeft.value) / cdTotal.value) * 100) : 0))
const cdText = computed(() => {
  const v = Math.max(0, cdLeft.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(v / 3600))}:${pad(Math.floor((v % 3600) / 60))}:${pad(v % 60)}`
})

function beep() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const at = ctx.currentTime + i * 0.4
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      osc.connect(g).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.4)
    }
    setTimeout(() => void ctx.close(), 1600)
  } catch { /* ignore */ }
}

function cdTick() {
  if (cdLeft.value > 0) {
    cdLeft.value--
    if (cdLeft.value === 0) {
      beep()
      cdRunning.value = false
      if (cdTimer) { clearInterval(cdTimer); cdTimer = null }
      ElMessage.success('倒计时结束')
    }
  }
}

function cdToggle() {
  if (cdRunning.value) {
    cdRunning.value = false
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null }
    return
  }
  if (cdLeft.value === 0) cdLeft.value = cdTotal.value
  if (cdLeft.value <= 0) {
    ElMessage.warning('请先设置时长')
    return
  }
  cdRunning.value = true
  cdTimer = window.setInterval(cdTick, 1000)
}

function cdReset() {
  cdRunning.value = false
  if (cdTimer) { clearInterval(cdTimer); cdTimer = null }
  cdLeft.value = 0
}

function setPreset(min: number) {
  cdReset()
  timerCfg.h = 0
  timerCfg.m = min
  timerCfg.s = 0
  cdLeft.value = min * 60
}

onBeforeUnmount(() => {
  if (swTimer) clearInterval(swTimer)
  if (cdTimer) clearInterval(cdTimer)
})
</script>

<template>
  <div class="st">
    <div class="cols">
      <!-- 秒表 -->
      <div class="panel">
        <div class="p-title">秒表</div>
        <div class="big-num">{{ fmtMs(swElapsed) }}</div>
        <div class="p-acts">
          <el-button :type="swRunning ? 'warning' : 'primary'" size="large" :icon="swRunning ? VideoPause : VideoPlay" @click="swToggle">
            {{ swRunning ? '暂停' : (swElapsed ? '继续' : '开始') }}
          </el-button>
          <el-button size="large" :disabled="!swElapsed" @click="swLap">计次</el-button>
          <el-button size="large" :icon="RefreshLeft" :disabled="!swElapsed" @click="swReset">重置</el-button>
        </div>
        <div class="laps">
          <div v-if="laps.list.length" class="lap-head"><span>计次</span><span>累计时间</span></div>
          <div v-for="(l, i) in lapDiff" :key="i" class="lap-row">
            <span class="lap-no">#{{ lapDiff.length - i }}</span>
            <span class="lap-time">{{ fmtMs(l) }}</span>
          </div>
          <div v-if="!laps.list.length" class="lap-empty">暂无计次记录</div>
        </div>
      </div>

      <!-- 倒计时 -->
      <div class="panel">
        <div class="p-title">倒计时</div>
        <el-progress type="circle" :width="180" :stroke-width="10" :percentage="cdPct" :color="cdLeft <= 10 && cdRunning ? '#ef4444' : '#0ea5e9'">
          <div class="cd-dial">
            <div class="cd-text">{{ cdLeft > 0 || cdRunning ? cdText : '00:00:00' }}</div>
            <div class="cd-sub">{{ cdRunning ? '进行中' : (cdLeft ? '已暂停' : '待开始') }}</div>
          </div>
        </el-progress>

        <div class="cfg-row">
          <el-input-number v-model="timerCfg.h" :min="0" :max="23" size="small" :disabled="cdRunning" />
          <span class="unit">时</span>
          <el-input-number v-model="timerCfg.m" :min="0" :max="59" size="small" :disabled="cdRunning" />
          <span class="unit">分</span>
          <el-input-number v-model="timerCfg.s" :min="0" :max="59" size="small" :disabled="cdRunning" />
          <span class="unit">秒</span>
        </div>

        <div class="presets">
          <el-button v-for="m in [1, 3, 5, 10, 25]" :key="m" size="small" text @click="setPreset(m)">{{ m }} 分钟</el-button>
        </div>

        <div class="p-acts">
          <el-button :type="cdRunning ? 'warning' : 'primary'" :icon="cdRunning ? VideoPause : VideoPlay" @click="cdToggle">
            {{ cdRunning ? '暂停' : '开始' }}
          </el-button>
          <el-button :icon="Refresh" @click="cdReset">重置</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st {
  padding: 4px 2px;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 760px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.panel {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.p-title {
  font-size: 14px;
  font-weight: 600;
  align-self: flex-start;
}
.big-num {
  font-size: 46px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  color: var(--el-text-color-primary);
}
.p-acts {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.laps {
  width: 100%;
  max-height: 180px;
  overflow: auto;
}
.lap-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 8px;
  border-bottom: 1px solid var(--card-border);
}
.lap-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px dashed var(--card-border);
}
.lap-no {
  color: var(--el-text-color-secondary);
}
.lap-empty {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  padding: 16px 0;
}
.cd-dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.cd-text {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cd-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.cfg-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 6px;
}
.presets {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
