<script setup lang="ts">
/**
 * 手速测试
 * 在设定时长内快速点击,实时显示 CPS(每秒点击数),结束后
 * 记录本轮成绩与各时长的个人最好成绩,保存在本机。
 */
import { computed, onUnmounted, reactive, ref } from 'vue'
import { Lightning, RefreshLeft } from '@element-plus/icons-vue'

const DURATIONS = [5, 10, 15, 30]
const STORE = 'utools_cps-best-v1'

type Phase = 'idle' | 'running' | 'done'

const phase = ref<Phase>('idle')
const duration = ref(10)
const clicks = ref(0)
const remain = ref(10)
const bests = reactive<Record<number, number>>({})

let timer = 0
let startedAt = 0

const cps = computed(() => {
  if (phase.value === 'idle') return 0
  const elapsed = phase.value === 'done' ? duration.value : Math.max(0.05, (Date.now() - startedAt) / 1000)
  return Math.round((clicks.value / elapsed) * 100) / 100
})

const progress = computed(() => (phase.value === 'idle' ? 0 : (1 - remain.value / duration.value) * 100))

const best = computed(() => bests[duration.value] ?? 0)

function loadBests() {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) Object.assign(bests, JSON.parse(raw))
  } catch { /* ignore */ }
}

function saveBests() {
  try { localStorage.setItem(STORE, JSON.stringify(bests)) } catch { /* ignore */ }
}

function start() {
  stopTimer()
  phase.value = 'running'
  clicks.value = 0
  remain.value = duration.value
  startedAt = performance.now()
  timer = window.setInterval(() => {
    const used = (performance.now() - startedAt) / 1000
    remain.value = Math.max(0, Math.round((duration.value - used) * 10) / 10)
    if (used >= duration.value) finish()
  }, 100)
}

function finish() {
  stopTimer()
  phase.value = 'done'
  remain.value = 0
  const score = Math.round((clicks.value / duration.value) * 100) / 100
  if (score > (bests[duration.value] ?? 0)) {
    bests[duration.value] = score
    saveBests()
  }
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = 0
  }
}

function tap() {
  if (phase.value === 'running') {
    clicks.value++
    return
  }
  if (phase.value === 'idle' || phase.value === 'done') start()
}

function reset() {
  stopTimer()
  phase.value = 'idle'
  clicks.value = 0
  remain.value = duration.value
}

function setDuration(d: number) {
  duration.value = d
  reset()
}

function onDurationChange(v: string | number | boolean) {
  setDuration(Number(v))
}

onUnmounted(stopTimer)

loadBests()
</script>

<template>
  <div class="cps">
    <div class="head">
      <div>
        <h3 class="title">手速测试</h3>
        <p class="sub">限时点击,实时测出每秒点击数(CPS)与个人最好成绩</p>
      </div>
      <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
    </div>

    <div class="cfg">
      <span class="lbl">时长</span>
      <el-radio-group :model-value="duration" size="small" @change="onDurationChange">
        <el-radio-button v-for="d in DURATIONS" :key="d" :value="d">{{ d }} 秒</el-radio-button>
      </el-radio-group>
      <span class="best">最好:{{ best }} CPS</span>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="v">{{ clicks }}</span>
        <span class="k">点击次数</span>
      </div>
      <div class="stat hot">
        <span class="v">{{ cps }}</span>
        <span class="k">CPS</span>
      </div>
      <div class="stat">
        <span class="v">{{ remain.toFixed(1) }}</span>
        <span class="k">剩余秒数</span>
      </div>
    </div>

    <div class="bar"><div class="bar-in" :style="{ width: progress + '%' }" /></div>

    <div class="arena" :class="phase" @pointerdown.prevent="tap">
      <template v-if="phase === 'idle'">
        <el-icon :size="34"><Lightning /></el-icon>
        <span class="arena-label">点击开始</span>
        <span class="arena-sub">开始后在这里快速点击</span>
      </template>
      <template v-else-if="phase === 'running'">
        <span class="arena-label">快点!</span>
        <span class="arena-sub">已点 {{ clicks }} 次 · {{ cps }} CPS</span>
      </template>
      <template v-else>
        <span class="arena-label">{{ cps }} CPS</span>
        <span class="arena-sub">共 {{ clicks }} 次 / {{ duration }} 秒 · 点击再来一轮</span>
      </template>
    </div>

    <div class="bests">
      <span v-for="d in DURATIONS" :key="d" class="b" :class="{ on: d === duration }">
        {{ d }}s · {{ bests[d] ?? 0 }}
      </span>
    </div>

    <p class="foot">说明:CPS = 总点击数 ÷ 秒数,含起手延迟,短时长更容易出高分;成绩仅保存在本机浏览器。</p>
  </div>
</template>

<style scoped>
.cps {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
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
.cfg {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.best {
  font-size: 12px;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.stat {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat .v {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat.hot .v {
  color: var(--el-color-primary);
}
.stat .k {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  overflow: hidden;
  margin-bottom: 12px;
}
.bar-in {
  height: 100%;
  background: var(--el-color-primary);
  transition: width 0.1s linear;
}
.arena {
  min-height: 220px;
  border-radius: 16px;
  border: 2px dashed var(--card-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  transition: transform 0.05s, border-color 0.15s, background 0.15s;
}
.arena.running {
  border-style: solid;
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
}
.arena.running:active {
  transform: scale(0.995);
}
.arena.done {
  border-style: solid;
  border-color: #16a34a;
  background: color-mix(in srgb, #16a34a 8%, transparent);
  color: #16a34a;
}
.arena-label {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.arena-sub {
  font-size: 12px;
}
.bests {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.b {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 3px 10px;
  font-variant-numeric: tabular-nums;
}
.b.on {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
