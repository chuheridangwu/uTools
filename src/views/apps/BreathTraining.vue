<script setup lang="ts">
/**
 * 呼吸训练
 * 多种节律的引导呼吸(4-7-8 / 箱式 / 放松),跟随圆环缩放节奏,
 * 帮助快速放松与入眠,可选提示音与时长统计。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'

interface Phase {
  name: string
  sec: number
  /** 圆环目标缩放 */
  scale: number
}

interface Pattern {
  key: string
  name: string
  desc: string
  phases: Phase[]
  color: string
}

const PATTERNS: Pattern[] = [
  {
    key: '478',
    name: '4-7-8 助眠',
    desc: '吸气 4 秒 · 屏息 7 秒 · 呼气 8 秒,常用于快速放松与入睡',
    color: '#6366f1',
    phases: [
      { name: '吸气', sec: 4, scale: 1 },
      { name: '屏息', sec: 7, scale: 1 },
      { name: '呼气', sec: 8, scale: 0.55 },
    ],
  },
  {
    key: 'box',
    name: '箱式呼吸',
    desc: '4-4-4-4,吸气、屏息、呼气、屏息各 4 秒,提升专注与稳定',
    color: '#0ea5e9',
    phases: [
      { name: '吸气', sec: 4, scale: 1 },
      { name: '屏息', sec: 4, scale: 1 },
      { name: '呼气', sec: 4, scale: 0.55 },
      { name: '屏息', sec: 4, scale: 0.55 },
    ],
  },
  {
    key: 'relax',
    name: '放松呼吸',
    desc: '吸气 4 秒 · 呼气 6 秒,呼气略长,温和地安抚神经',
    color: '#10b981',
    phases: [
      { name: '吸气', sec: 4, scale: 1 },
      { name: '呼气', sec: 6, scale: 0.55 },
    ],
  },
]

const patternKey = ref('478')
const running = ref(false)
const phaseIndex = ref(0)
const left = ref(PATTERNS[0].phases[0].sec)
const cycles = ref(0)
const sound = ref(false)

const pattern = computed(() => PATTERNS.find((p) => p.key === patternKey.value)!)
const phase = computed(() => pattern.value.phases[phaseIndex.value])
const scale = computed(() => (running.value ? phase.value.scale : 0.7))

let timer: number | null = null

function beep(freq: number) {
  if (!sound.value) return
  try {
    const ctx = new AudioContext()
    const at = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.18, at + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
    osc.connect(g).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.3)
    setTimeout(() => void ctx.close(), 400)
  } catch {
    /* ignore */
  }
}

function tick() {
  if (left.value > 1) {
    left.value--
    return
  }
  // 进入下一阶段
  const phases = pattern.value.phases
  if (phaseIndex.value === phases.length - 1) {
    cycles.value++
    phaseIndex.value = 0
  } else {
    phaseIndex.value++
  }
  left.value = phases[phaseIndex.value].sec
  beep(phases[phaseIndex.value].name === '吸气' ? 660 : 440)
}

function start() {
  if (running.value) return
  running.value = true
  beep(660)
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
  phaseIndex.value = 0
  cycles.value = 0
  left.value = pattern.value.phases[0].sec
}

function switchPattern(k: string) {
  patternKey.value = k
  reset()
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="breath">
    <div class="head">
      <div>
        <h3 class="title">呼吸训练</h3>
        <p class="sub">{{ pattern.desc }}</p>
      </div>
      <el-radio-group :model-value="patternKey" size="small" @update:model-value="switchPattern($event as string)">
        <el-radio-button v-for="p in PATTERNS" :key="p.key" :value="p.key">{{ p.name }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stage">
      <div class="ring-wrap">
        <div
          class="ring"
          :style="{
            transform: `scale(${scale})`,
            background: `radial-gradient(circle at 35% 30%, ${pattern.color}cc, ${pattern.color}55)`,
            transitionDuration: (running ? phase.sec : 0.6) + 's',
          }"
        />
        <div class="center">
          <div class="phase-name">{{ running ? phase.name : '准备' }}</div>
          <div class="phase-sec">{{ running ? left : '—' }}</div>
        </div>
      </div>

      <div class="ctrl">
        <el-button v-if="!running" type="primary" size="large" :icon="VideoPlay" @click="start">开始</el-button>
        <el-button v-else size="large" :icon="VideoPause" @click="pause">暂停</el-button>
        <el-button size="large" :icon="Refresh" @click="reset">重置</el-button>
        <el-switch v-model="sound" active-text="提示音" style="margin-left: 8px" />
      </div>

      <div class="stat">已完成 <b :style="{ color: pattern.color }">{{ cycles }}</b> 轮</div>
    </div>
  </div>
</template>

<style scoped>
.breath {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  max-width: 460px;
}
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 20px 0;
}
.ring-wrap {
  position: relative;
  width: 260px;
  height: 260px;
  display: grid;
  place-items: center;
}
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  transform: scale(0.7);
  transition-property: transform;
  transition-timing-function: ease-in-out;
  box-shadow: 0 0 60px color-mix(in srgb, currentColor 30%, transparent);
}
.center {
  position: relative;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 6px rgb(0 0 0 / 30%);
}
.phase-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
}
.phase-sec {
  font-size: 44px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
}
.stat {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat b {
  font-size: 18px;
}
</style>
