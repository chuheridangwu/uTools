<script setup lang="ts">
/**
 * 画板
 * 基于 Canvas 的简易绘图:画笔/橡皮/调色/粗细、撤销、清空与导出 PNG。
 * 支持鼠标与触屏。
 */
import { onMounted, ref } from 'vue'
import { Brush, Delete, Download, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const W = 1000
const H = 600

const canvas = ref<HTMLCanvasElement>()
const color = ref('#0ea5e9')
const size = ref(4)
const eraser = ref(false)
const drawing = ref(false)
const history = ref<ImageData[]>([])
let ctx: CanvasRenderingContext2D | null = null
let last: { x: number; y: number } | null = null

function setCtx() {
  const c = canvas.value
  if (!c) return
  ctx = c.getContext('2d')
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }
}

function pushHistory() {
  const c = canvas.value
  if (!c || !ctx) return
  history.value.push(ctx.getImageData(0, 0, W, H))
  if (history.value.length > 30) history.value.shift()
}

function pos(e: PointerEvent): { x: number; y: number } {
  const c = canvas.value!
  const rect = c.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  }
}

function start(e: PointerEvent) {
  if (!ctx) return
  pushHistory()
  drawing.value = true
  last = pos(e)
  canvas.value?.setPointerCapture(e.pointerId)
  draw(e)
}

function draw(e: PointerEvent) {
  if (!drawing.value || !ctx) return
  const p = pos(e)
  ctx.strokeStyle = eraser.value ? '#ffffff' : color.value
  ctx.lineWidth = eraser.value ? size.value * 4 : size.value
  ctx.beginPath()
  ctx.moveTo(last!.x, last!.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  last = p
}

function end() {
  drawing.value = false
  last = null
}

function undo() {
  if (!ctx) return
  const img = history.value.pop()
  if (img) ctx.putImageData(img, 0, 0)
  else ElMessage.info('没有可撤销的操作')
}

function clear() {
  if (!ctx) return
  pushHistory()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
}

function download() {
  const c = canvas.value
  if (!c) return
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = 'drawing.png'
  a.click()
}

const COLORS = ['#ef4444', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#ec4899', '#111827', '#ffffff']

onMounted(setCtx)
</script>

<template>
  <div class="board">
    <div class="head">
      <div>
        <h3 class="title">画板</h3>
        <p class="sub">随手涂鸦或画示意图,支持撤销与导出 PNG</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="RefreshLeft" @click="undo">撤销</el-button>
        <el-button size="small" :icon="Delete" @click="clear">清空</el-button>
        <el-button size="small" type="primary" :icon="Download" @click="download">导出 PNG</el-button>
      </div>
    </div>

    <div class="toolbar">
      <div class="swatches">
        <button
          v-for="c in COLORS"
          :key="c"
          class="swatch"
          :class="{ on: color === c && !eraser }"
          :style="{ background: c }"
          @click="color = c; eraser = false"
        />
      </div>
      <el-color-picker v-model="color" size="small" @change="eraser = false" />
      <div class="size-row">
        <span class="s-label">粗细</span>
        <el-slider v-model="size" :min="1" :max="40" :show-tooltip="false" style="width: 120px" />
        <span class="s-val">{{ size }}</span>
      </div>
      <el-button size="small" :type="eraser ? 'warning' : ''" :icon="Brush" @click="eraser = !eraser">
        {{ eraser ? '橡皮(开)' : '橡皮' }}
      </el-button>
    </div>

    <canvas
      ref="canvas"
      class="cv"
      :width="W"
      :height="H"
      @pointerdown="start"
      @pointermove="draw"
      @pointerup="end"
      @pointerleave="end"
    />
  </div>
</template>

<style scoped>
.board {
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
.acts {
  display: flex;
  gap: 8px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.swatches {
  display: flex;
  gap: 6px;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}
.swatch.on {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-bg-color) inset;
}
.size-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.s-label,
.s-val {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cv {
  width: 100%;
  height: auto;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: #fff;
  touch-action: none;
  cursor: crosshair;
  display: block;
}
</style>
