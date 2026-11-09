<script setup lang="ts">
/**
 * 随机转盘
 * 把选项(每行一个)画成转盘,点击开始随机旋转并停在某一项,
 * 用于决策、抽奖与点名,保留最近结果记录。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { Delete, VideoPlay } from '@element-plus/icons-vue'

const PALETTE = ['#14b8a6', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#22c55e', '#f43f5e', '#eab308', '#64748b']

const text = ref('吃火锅\n吃烧烤\n吃日料\n吃快餐\n回家做饭')
const options = computed(() => text.value.split('\n').map((s) => s.trim()).filter(Boolean))
const rotation = ref(0)
const spinning = ref(false)
const result = ref('')
const history = ref<string[]>([])
const canvas = ref<HTMLCanvasElement>()

const segDeg = computed(() => 360 / Math.max(options.value.length, 1))

function draw() {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const size = c.width
  const r = size / 2
  ctx.clearRect(0, 0, size, size)
  const n = options.value.length
  if (!n) {
    ctx.fillStyle = '#e5e7eb'
    ctx.beginPath()
    ctx.arc(r, r, r - 4, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const seg = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * seg
    ctx.beginPath()
    ctx.moveTo(r, r)
    ctx.arc(r, r, r - 4, start, start + seg)
    ctx.closePath()
    ctx.fillStyle = PALETTE[i % PALETTE.length]
    ctx.fill()
    // 文本
    ctx.save()
    ctx.translate(r, r)
    ctx.rotate(start + seg / 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = `600 ${Math.max(12, Math.min(22, 260 / n + 8))}px system-ui, sans-serif`
    const label = options.value[i].slice(0, 8)
    ctx.fillText(label, r - 20, 6)
    ctx.restore()
  }
  // 中心
  ctx.beginPath()
  ctx.arc(r, r, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#e5e7eb'
  ctx.stroke()
}

function spin() {
  const n = options.value.length
  if (n < 2 || spinning.value) return
  spinning.value = true
  result.value = ''
  const winner = Math.floor(Math.random() * n)
  const a = winner * segDeg.value + segDeg.value / 2
  const turns = 5 + Math.floor(Math.random() * 3)
  const target = 360 * turns - a
  const from = rotation.value % 360
  const delta = target - from + (target >= from ? 0 : 360)
  const start = performance.now()
  const dur = 3600
  const ease = (t: number) => 1 - Math.pow(1 - t, 3)

  let done = false
  const finalize = () => {
    if (done) return
    done = true
    rotation.value = target
    spinning.value = false
    const w = options.value[winner]
    result.value = w
    history.value.unshift(w)
    if (history.value.length > 12) history.value.length = 12
  }

  const step = (now: number) => {
    if (done) return
    const t = Math.min(1, (now - start) / dur)
    rotation.value = from + delta * ease(t)
    if (t < 1) requestAnimationFrame(step)
    else finalize()
  }
  requestAnimationFrame(step)
  // 兜底:后台标签页中 rAF 可能被节流,确保动画结束仍能出结果
  window.setTimeout(finalize, dur + 200)
}

function clearHistory() {
  history.value = []
}

watch(options, draw)
onMounted(draw)
</script>

<template>
  <div class="wheel">
    <div class="head">
      <div>
        <h3 class="title">随机转盘</h3>
        <p class="sub">每行一个选项,点击开始让它帮你做决定</p>
      </div>
    </div>

    <div class="cols">
      <div class="left">
        <el-input v-model="text" type="textarea" :rows="10" placeholder="每行一个选项…" />
        <el-button
          type="primary"
          size="large"
          class="spin-btn"
          :icon="VideoPlay"
          :loading="spinning"
          :disabled="options.length < 2"
          @click="spin"
        >
          {{ spinning ? '旋转中…' : '开始' }}
        </el-button>
        <div v-if="result" class="result">
          结果:<b>{{ result }}</b>
        </div>
      </div>

      <div class="right">
        <div class="wheel-wrap">
          <div class="pointer" />
          <canvas
            ref="canvas"
            width="360"
            height="360"
            :style="{ transform: `rotate(${rotation}deg)` }"
          />
        </div>
        <div class="history">
          <div class="h-head">历史 <el-button text size="small" :icon="Delete" @click="clearHistory" /></div>
          <div class="h-list">
            <span v-for="(h, i) in history" :key="i" class="h-item">{{ h }}</span>
            <span v-if="!history.length" class="h-empty">暂无</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel {
  padding: 4px 2px;
}
.head {
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
.cols {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}
@media (max-width: 760px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.spin-btn {
  width: 100%;
}
.result {
  font-size: 15px;
  text-align: center;
  color: var(--el-text-color-regular);
}
.result b {
  color: #14b8a6;
  font-size: 20px;
}
.right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.wheel-wrap {
  position: relative;
  width: 360px;
  height: 360px;
  max-width: 100%;
}
.wheel-wrap canvas {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: 0 10px 30px rgb(0 0 0 / 15%);
  transition: none;
}
.pointer {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 22px solid #ef4444;
  z-index: 2;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 30%));
}
.history {
  width: 360px;
  max-width: 100%;
}
.h-head {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.h-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.h-item {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}
.h-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
