<script setup lang="ts">
/**
 * SVG 编辑器
 * 轻量矢量编辑:矩形 / 椭圆 / 直线 / 文字,拖动与四角缩放、层级调整、
 * 填充描边透明度等样式、撤销重做,导出 SVG 源码或 2x PNG。
 * 全程在浏览器本地完成,不依赖任何图形库。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Aim, Brush, CopyDocument, Crop, Delete, Download, Edit, Hide, Minus,
  Pointer, Rank, RefreshLeft, RefreshRight, View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const W = 960
const H = 640

type Tool = 'select' | 'rect' | 'ellipse' | 'line' | 'text'
type ShapeType = Exclude<Tool, 'select'>

interface Shape {
  id: number
  type: ShapeType
  x: number
  y: number
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  radius: number
  text: string
  fontSize: number
  bold: boolean
  visible: boolean
}

const TOOLS: { key: Tool; label: string; icon: unknown }[] = [
  { key: 'select', label: '选择', icon: Pointer },
  { key: 'rect', label: '矩形', icon: Crop },
  { key: 'ellipse', label: '椭圆', icon: Aim },
  { key: 'line', label: '直线', icon: Minus },
  { key: 'text', label: '文字', icon: Edit },
]

const shapes = ref<Shape[]>([])
const tool = ref<Tool>('select')
const selectedId = ref<number | null>(null)
const bg = ref('transparent')
const canvasRef = ref<SVGSVGElement>()
const zoom = ref(1)

let uid = 1
const past = ref<string[]>([])
const future = ref<string[]>([])

const selected = computed(() => shapes.value.find((s) => s.id === selectedId.value) ?? null)
const layers = computed(() => [...shapes.value].reverse())
const styleTarget = computed(() => selected.value)

/* ------------------------------ 历史 ------------------------------ */

function snap(): string {
  return JSON.stringify(shapes.value)
}

function commit(prev: string) {
  if (snap() === prev) return
  past.value.push(prev)
  if (past.value.length > 80) past.value.shift()
  future.value = []
}

function undo() {
  const prev = past.value.pop()
  if (!prev) return
  future.value.push(snap())
  shapes.value = JSON.parse(prev) as Shape[]
  if (!shapes.value.some((s) => s.id === selectedId.value)) selectedId.value = null
}

function redo() {
  const next = future.value.pop()
  if (!next) return
  past.value.push(snap())
  shapes.value = JSON.parse(next) as Shape[]
  if (!shapes.value.some((s) => s.id === selectedId.value)) selectedId.value = null
}

/* ------------------------------ 新建 / 选择 ------------------------------ */

function baseShape(type: ShapeType, x: number, y: number): Shape {
  return {
    id: uid++,
    type,
    x,
    y,
    w: type === 'text' ? 160 : 120,
    h: type === 'text' ? 40 : 90,
    fill: type === 'line' ? 'none' : '#667eea',
    stroke: type === 'line' ? '#ef4444' : '#334155',
    strokeWidth: type === 'line' ? 3 : 0,
    opacity: 1,
    radius: 8,
    text: '双击画布添加文字',
    fontSize: 28,
    bold: false,
    visible: true,
  }
}

function textWidth(s: Shape): number {
  return Math.max(40, s.text.length * s.fontSize * 0.62)
}

function addAt(type: ShapeType, x: number, y: number) {
  const prev = snap()
  const s = baseShape(type, x, y)
  if (type === 'text') {
    s.x = x
    s.y = y
    s.w = textWidth(s)
    s.h = s.fontSize * 1.4
  }
  shapes.value.push(s)
  selectedId.value = s.id
  commit(prev)
}

function hitTest(x: number, y: number): Shape | null {
  for (let i = shapes.value.length - 1; i >= 0; i--) {
    const s = shapes.value[i]
    if (!s.visible) continue
    const pad = 4
    if (x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad) return s
  }
  return null
}

/* ------------------------------ 指针交互 ------------------------------ */

type Handle = 'nw' | 'ne' | 'sw' | 'se'

interface DragState {
  mode: 'create' | 'move' | 'resize'
  startX: number
  startY: number
  before: string
  shape: Shape | null
  handle?: Handle
  orig?: { x: number; y: number; w: number; h: number; fontSize: number }
}

let drag: DragState | null = null

function toLocal(ev: PointerEvent): { x: number; y: number } {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: ((ev.clientX - rect.left) / rect.width) * W,
    y: ((ev.clientY - rect.top) / rect.height) * H,
  }
}

function round(n: number): number {
  return Math.round(n)
}

function onCanvasDown(ev: PointerEvent) {
  const p = toLocal(ev)
  try { (ev.currentTarget as SVGSVGElement).setPointerCapture?.(ev.pointerId) } catch { /* 合成事件没有活动指针 */ }
  if (tool.value === 'text') {
    addAt('text', round(p.x), round(p.y))
    tool.value = 'select'
    return
  }
  if (tool.value === 'select') {
    const hit = hitTest(p.x, p.y)
    selectedId.value = hit?.id ?? null
    if (!hit) return
    drag = {
      mode: 'move',
      startX: p.x,
      startY: p.y,
      before: snap(),
      shape: hit,
      orig: { x: hit.x, y: hit.y, w: hit.w, h: hit.h, fontSize: hit.fontSize },
    }
    return
  }
  // 绘制新图形
  const prev = snap()
  const s = baseShape(tool.value, round(p.x), round(p.y))
  s.w = 0
  s.h = 0
  shapes.value.push(s)
  selectedId.value = s.id
  drag = { mode: 'create', startX: p.x, startY: p.y, before: prev, shape: s }
}

function onCanvasMove(ev: PointerEvent) {
  if (!drag) return
  const p = toLocal(ev)
  if (drag.mode === 'create' && drag.shape) {
    const s = drag.shape
    s.x = round(Math.min(drag.startX, p.x))
    s.y = round(Math.min(drag.startY, p.y))
    s.w = round(Math.abs(p.x - drag.startX))
    s.h = round(Math.abs(p.y - drag.startY))
    return
  }
  if (!drag.shape || !drag.orig) return
  const s = drag.shape
  const dx = p.x - drag.startX
  const dy = p.y - drag.startY
  if (drag.mode === 'move') {
    s.x = round(drag.orig.x + dx)
    s.y = round(drag.orig.y + dy)
    return
  }
  if (drag.mode === 'resize') {
    const o = drag.orig
    const h = drag.handle
    let x = o.x
    let y = o.y
    let w = o.w
    let ht = o.h
    if (h?.includes('e')) w = o.w + dx
    if (h?.includes('s')) ht = o.h + dy
    if (h?.includes('w')) { x = o.x + dx; w = o.w - dx }
    if (h?.includes('n')) { y = o.y + dy; ht = o.h - dy }
    if (w < 4) w = 4
    if (ht < 4) ht = 4
    s.x = round(x)
    s.y = round(y)
    s.w = round(w)
    s.h = round(ht)
    if (s.type === 'text') s.fontSize = Math.max(8, round(ht / 1.4))
    return
  }
}

function onCanvasUp() {
  if (!drag) return
  if (drag.mode === 'create' && drag.shape) {
    const s = drag.shape
    if (s.w < 4 || s.h < 4) {
      // 点击未拖动:给一个默认尺寸
      s.w = s.type === 'line' ? 120 : 140
      s.h = s.type === 'line' ? 0 : 100
      if (s.type === 'text') { s.w = textWidth(s); s.h = s.fontSize * 1.4 }
    }
    if (s.type === 'text') { s.w = textWidth(s); s.h = s.fontSize * 1.4 }
    commit(drag.before)
  } else {
    commit(drag.before)
  }
  drag = null
}

function startResize(ev: PointerEvent, handle: Handle) {
  ev.stopPropagation()
  const s = selected.value
  if (!s) return
  drag = {
    mode: 'resize',
    startX: toLocal(ev).x,
    startY: toLocal(ev).y,
    before: snap(),
    shape: s,
    handle,
    orig: { x: s.x, y: s.y, w: s.w, h: s.h, fontSize: s.fontSize },
  }
  try { (canvasRef.value as SVGSVGElement).setPointerCapture?.(ev.pointerId) } catch { /* 合成事件没有活动指针 */ }
}

/* ------------------------------ 属性 / 图层操作 ------------------------------ */

function setColor(key: 'fill' | 'stroke', v: string | null) {
  const s = styleTarget.value
  if (!s) return
  const prev = snap()
  s[key] = v ?? 'none'
  commit(prev)
}

function setNum(key: 'strokeWidth' | 'opacity' | 'radius' | 'fontSize', v: number | undefined) {
  const s = styleTarget.value
  if (!s || v === undefined) return
  const prev = snap()
  s[key] = v
  if (key === 'fontSize') { s.w = textWidth(s); s.h = s.fontSize * 1.4 }
  commit(prev)
}

function setText(v: string) {
  const s = styleTarget.value
  if (!s) return
  const prev = snap()
  s.text = v
  s.w = textWidth(s)
  s.h = s.fontSize * 1.4
  commit(prev)
}

function toggleBold(v: boolean) {
  const s = styleTarget.value
  if (!s) return
  const prev = snap()
  s.bold = v
  commit(prev)
}

function setFontSize(v: number | undefined) { setNum('fontSize', v) }
function setStrokeWidth(v: number | undefined) { setNum('strokeWidth', v) }
function setOpacity(v: number | undefined) { setNum('opacity', v) }
function setRadius(v: number | undefined) { setNum('radius', v) }
function setFillColor(v: string | null) { setColor('fill', v) }
function setStrokeColor(v: string | null) { setColor('stroke', v) }
function setBold(v: string | number | boolean) { toggleBold(Boolean(v)) }
function setCanvasBg(v: string | number | boolean | undefined) { if (v !== undefined) bg.value = String(v) }

function toggleTransparent() {
  const s = styleTarget.value
  if (!s) return
  const prev = snap()
  s.fill = s.fill === 'none' ? '#667eea' : 'none'
  commit(prev)
}

function removeSelected() {
  const s = selected.value
  if (!s) return
  const prev = snap()
  shapes.value = shapes.value.filter((x) => x.id !== s.id)
  selectedId.value = null
  commit(prev)
}

function duplicate() {
  const s = selected.value
  if (!s) return
  const prev = snap()
  const copy: Shape = { ...s, id: uid++, x: s.x + 16, y: s.y + 16 }
  shapes.value.push(copy)
  selectedId.value = copy.id
  commit(prev)
}

function toggleVisible(id: number) {
  const s = shapes.value.find((x) => x.id === id)
  if (!s) return
  const prev = snap()
  s.visible = !s.visible
  if (!s.visible && selectedId.value === s.id) selectedId.value = null
  commit(prev)
}

function moveLayer(dir: 1 | -1) {
  const s = selected.value
  if (!s) return
  const i = shapes.value.findIndex((x) => x.id === s.id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= shapes.value.length) return
  const prev = snap()
  const arr = shapes.value
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
  commit(prev)
}

async function clearAll() {
  if (!shapes.value.length) return
  try {
    await ElMessageBox.confirm('清空画布上的全部图形?', '清空画布', { type: 'warning' })
  } catch { return }
  const prev = snap()
  shapes.value = []
  selectedId.value = null
  commit(prev)
}

/* ------------------------------ 导出 ------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shapeMarkup(s: Shape): string {
  const common = `fill="${s.fill}" stroke="${s.stroke === 'none' ? 'none' : s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"`
  if (s.type === 'rect') {
    return `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.radius}" ${common} />`
  }
  if (s.type === 'ellipse') {
    const cx = s.x + s.w / 2
    const cy = s.y + s.h / 2
    return `  <ellipse cx="${cx}" cy="${cy}" rx="${s.w / 2}" ry="${s.h / 2}" ${common} />`
  }
  if (s.type === 'line') {
    return `  <line x1="${s.x}" y1="${s.y}" x2="${s.x + s.w}" y2="${s.y + s.h}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}" />`
  }
  return `  <text x="${s.x}" y="${s.y + s.fontSize}" font-size="${s.fontSize}" font-weight="${s.bold ? 700 : 400}" font-family="system-ui, -apple-system, 'PingFang SC', sans-serif" ${common}>${esc(s.text)}</text>`
}

function svgMarkup(): string {
  const bgRect = bg.value === 'transparent' ? '' : `  <rect width="${W}" height="${H}" fill="${bg.value}" />\n`
  const body = shapes.value.filter((s) => s.visible).map(shapeMarkup).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${bgRect}${body ? body + '\n' : ''}</svg>\n`
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function exportSvg() {
  if (!shapes.value.length) { ElMessage.info('画布还是空的'); return }
  download('drawing.svg', new Blob([svgMarkup()], { type: 'image/svg+xml;charset=utf-8' }))
  ElMessage.success('已导出 SVG')
}

async function copySvg() {
  try {
    await navigator.clipboard.writeText(svgMarkup())
    ElMessage.success('SVG 源码已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function exportPng() {
  if (!shapes.value.length) { ElMessage.info('画布还是空的'); return }
  const svg = svgMarkup()
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) { ElMessage.error('当前浏览器不支持 Canvas'); URL.revokeObjectURL(url); return }
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, W, H)
    URL.revokeObjectURL(url)
    canvas.toBlob((out) => {
      if (!out) { ElMessage.error('导出失败'); return }
      download('drawing@2x.png', out)
      ElMessage.success('已导出 PNG(2 倍)')
    }, 'image/png')
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    ElMessage.error('PNG 导出失败')
  }
  img.src = url
}

/* ------------------------------ 快捷键 ------------------------------ */

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

function onKeydown(e: KeyboardEvent) {
  if (isTyping(e.target)) return
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected.value) { e.preventDefault(); removeSelected() }
    return
  }
  if (e.key === 'Escape') { selectedId.value = null; return }
  const map: Record<string, Tool> = { v: 'select', r: 'rect', o: 'ellipse', l: 'line', t: 'text' }
  const t = map[e.key.toLowerCase()]
  if (t) tool.value = t
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const typeLabel: Record<ShapeType, string> = { rect: '矩形', ellipse: '椭圆', line: '直线', text: '文字' }

function layerName(s: Shape, i: number): string {
  if (s.type === 'text') return s.text.slice(0, 10) || '文字'
  return `${typeLabel[s.type]} ${shapes.value.length - i}`
}

/* ------------------------------ 初始示例 ------------------------------ */

function loadDemo() {
  const prev = snap()
  shapes.value = []
  const t: Shape = {
    id: uid++, type: 'text', x: 60, y: 54, w: 300, h: 42,
    fill: '#111827', stroke: 'none', strokeWidth: 0, opacity: 1, radius: 0,
    text: 'SVG 编辑器', fontSize: 30, bold: true, visible: true,
  }
  t.w = textWidth(t)
  const card: Shape = {
    id: uid++, type: 'rect', x: 60, y: 130, w: 260, h: 150,
    fill: '#667eea', stroke: '#334155', strokeWidth: 0, opacity: 1, radius: 14,
    text: '', fontSize: 24, bold: false, visible: true,
  }
  const circle: Shape = {
    id: uid++, type: 'ellipse', x: 370, y: 130, w: 150, h: 150,
    fill: '#22c55e', stroke: 'none', strokeWidth: 0, opacity: 0.85, radius: 0,
    text: '', fontSize: 24, bold: false, visible: true,
  }
  const line: Shape = {
    id: uid++, type: 'line', x: 560, y: 200, w: 180, h: 0,
    fill: 'none', stroke: '#ef4444', strokeWidth: 4, opacity: 1, radius: 0,
    text: '', fontSize: 24, bold: false, visible: true,
  }
  shapes.value = [t, card, circle, line]
  selectedId.value = null
  commit(prev)
}
</script>

<template>
  <div class="sve">
    <div class="head">
      <div>
        <h3 class="title">SVG 编辑器</h3>
        <p class="sub">画矩形 / 椭圆 / 直线 / 文字,拖动与缩放,导出 SVG 源码或 2x PNG</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="Brush" @click="loadDemo">示例</el-button>
        <el-button size="small" :icon="RefreshLeft" :disabled="!past.length" @click="undo">撤销</el-button>
        <el-button size="small" :icon="RefreshRight" :disabled="!future.length" @click="redo">重做</el-button>
        <el-button size="small" :icon="Delete" @click="clearAll">清空</el-button>
      </div>
    </div>

    <div class="tools">
      <button
        v-for="t in TOOLS"
        :key="t.key"
        class="tool"
        :class="{ on: tool === t.key }"
        @click="tool = t.key"
      >
        <el-icon :size="15"><component :is="t.icon" /></el-icon>
        <span>{{ t.label }}</span>
        <kbd>{{ t.key === 'select' ? 'V' : t.key === 'rect' ? 'R' : t.key === 'ellipse' ? 'O' : t.key === 'line' ? 'L' : 'T' }}</kbd>
      </button>
      <span class="spacer" />
      <span class="hint">按住拖动绘制 · 选中后拖动移动 · 四角手柄缩放 · Delete 删除</span>
    </div>

    <div class="body">
      <div class="stage">
        <div class="canvas-wrap">
        <svg
          ref="canvasRef"
          class="canvas"
          :viewBox="`0 0 ${W} ${H}`"
          :style="{ background: bg === 'transparent' ? undefined : bg, width: (W * zoom) + 'px' }"
          @pointerdown="onCanvasDown"
          @pointermove="onCanvasMove"
          @pointerup="onCanvasUp"
          @pointercancel="onCanvasUp"
        >
          <rect width="960" height="640" fill="transparent" />
          <g v-for="s in shapes" :key="s.id" :opacity="s.visible ? 1 : 0">
            <rect
              v-if="s.type === 'rect'"
              :x="s.x" :y="s.y" :width="s.w" :height="s.h" :rx="s.radius"
              :fill="s.fill" :stroke="s.stroke === 'none' ? 'none' : s.stroke"
              :stroke-width="s.strokeWidth" :opacity="s.opacity"
            />
            <ellipse
              v-else-if="s.type === 'ellipse'"
              :cx="s.x + s.w / 2" :cy="s.y + s.h / 2" :rx="s.w / 2" :ry="s.h / 2"
              :fill="s.fill" :stroke="s.stroke === 'none' ? 'none' : s.stroke"
              :stroke-width="s.strokeWidth" :opacity="s.opacity"
            />
            <line
              v-else-if="s.type === 'line'"
              :x1="s.x" :y1="s.y" :x2="s.x + s.w" :y2="s.y + s.h"
              :stroke="s.stroke" :stroke-width="s.strokeWidth" :opacity="s.opacity"
            />
            <text
              v-else
              :x="s.x" :y="s.y + s.fontSize"
              :font-size="s.fontSize" :font-weight="s.bold ? 700 : 400"
              font-family="system-ui, -apple-system, 'PingFang SC', sans-serif"
              :fill="s.fill" :stroke="s.stroke === 'none' ? 'none' : s.stroke"
              :stroke-width="s.strokeWidth" :opacity="s.opacity"
            >{{ s.text }}</text>
          </g>
          <g v-if="selected" class="sel">
            <rect
              :x="selected.x" :y="selected.y" :width="selected.w" :height="selected.h"
              fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="5 4"
            />
            <rect
              v-for="h in (['nw','ne','sw','se'] as const)" :key="h"
              :x="h.includes('w') ? selected.x - 5 : selected.x + selected.w - 5"
              :y="h.includes('n') ? selected.y - 5 : selected.y + selected.h - 5"
              width="10" height="10" fill="#fff" stroke="#0ea5e9" stroke-width="1.5"
              :style="{ cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize' }"
              @pointerdown="startResize($event, h)"
            />
          </g>
        </svg>
        </div>
        <div class="stage-foot">
          <span class="dim">{{ W }} × {{ H }}</span>
          <span class="spacer" />
          <span class="dim">{{ shapes.filter((s) => s.visible).length }} 个可见图形</span>
        </div>
      </div>

      <aside class="side">
        <div v-if="selected" class="panel">
          <div class="panel-title">
            {{ typeLabel[selected.type] }}
            <span class="spacer" />
            <button class="mini" title="下移一层" @click="moveLayer(-1)"><el-icon><Rank /></el-icon></button>
            <button class="mini" title="上移一层" @click="moveLayer(1)"><el-icon><Rank /></el-icon></button>
            <button class="mini" title="复制" @click="duplicate"><el-icon><CopyDocument /></el-icon></button>
            <button class="mini danger" title="删除" @click="removeSelected"><el-icon><Delete /></el-icon></button>
          </div>

          <template v-if="selected.type === 'text'">
            <div class="field">
              <span class="lbl">文字</span>
              <el-input :model-value="selected.text" size="small" @change="setText" />
            </div>
            <div class="field">
              <span class="lbl">字号</span>
              <el-input-number :model-value="selected.fontSize" :min="8" :max="200" size="small" @change="setFontSize" />
              <el-checkbox :model-value="selected.bold" @change="setBold">加粗</el-checkbox>
            </div>
          </template>

          <div class="field">
            <span class="lbl">填充</span>
            <el-color-picker
              v-if="selected.fill !== 'none'"
              :model-value="selected.fill" size="small"
              @change="setFillColor"
            />
            <span v-else class="none-tag">无</span>
            <el-button size="small" text @click="toggleTransparent">{{ selected.fill === 'none' ? '启用填充' : '设为无填充' }}</el-button>
          </div>
          <div class="field">
            <span class="lbl">描边</span>
            <el-color-picker
              v-if="selected.stroke !== 'none'"
              :model-value="selected.stroke" size="small"
              @change="setStrokeColor"
            />
            <span v-else class="none-tag">无</span>
            <el-button size="small" text @click="setColor('stroke', selected.stroke === 'none' ? '#334155' : 'none')">
              {{ selected.stroke === 'none' ? '启用描边' : '无描边' }}
            </el-button>
          </div>
          <div class="field">
            <span class="lbl">线宽</span>
            <el-input-number :model-value="selected.strokeWidth" :min="0" :max="40" size="small" @change="setStrokeWidth" />
            <span class="lbl">透明</span>
            <el-input-number :model-value="selected.opacity" :min="0.05" :max="1" :step="0.05" size="small" @change="setOpacity" />
          </div>
          <div v-if="selected.type === 'rect'" class="field">
            <span class="lbl">圆角</span>
            <el-input-number :model-value="selected.radius" :min="0" :max="200" size="small" @change="setRadius" />
          </div>
          <div class="field">
            <span class="lbl">位置</span>
            <span class="coord">{{ Math.round(selected.x) }}, {{ Math.round(selected.y) }}</span>
            <span class="lbl">尺寸</span>
            <span class="coord">{{ Math.round(selected.w) }} × {{ Math.round(selected.h) }}</span>
          </div>
        </div>
        <div v-else class="panel empty">
          未选中图形。用左侧工具绘制,或用「示例」快速上手。
        </div>

        <div class="panel">
          <div class="panel-title">画布</div>
          <div class="field">
            <span class="lbl">背景</span>
            <el-radio-group :model-value="bg" size="small" @change="setCanvasBg">
              <el-radio-button value="transparent">透明</el-radio-button>
              <el-radio-button value="#ffffff">白</el-radio-button>
              <el-radio-button value="#0f172a">深</el-radio-button>
            </el-radio-group>
          </div>
          <div class="field">
            <span class="lbl">导出</span>
            <el-button size="small" :icon="Download" @click="exportSvg">SVG</el-button>
            <el-button size="small" :icon="Download" @click="exportPng">PNG</el-button>
            <el-button size="small" :icon="CopyDocument" @click="copySvg">复制源码</el-button>
          </div>
          <div class="field">
            <span class="lbl">缩放</span>
            <el-slider v-model="zoom" :min="0.5" :max="2" :step="0.1" style="flex: 1" />
            <span class="coord">{{ Math.round(zoom * 100) }}%</span>
          </div>
        </div>

        <div class="panel layers">
          <div class="panel-title">图层 <span class="n">{{ shapes.length }}</span></div>
          <div v-if="!layers.length" class="empty-line">暂无图层</div>
          <div
            v-for="(s, i) in layers"
            :key="s.id"
            class="layer"
            :class="{ on: selectedId === s.id }"
            @click="selectedId = s.id"
          >
            <button class="mini" :title="s.visible ? '隐藏' : '显示'" @click.stop="toggleVisible(s.id)">
              <el-icon><View v-if="s.visible" /><Hide v-else /></el-icon>
            </button>
            <span class="lname" :class="{ off: !s.visible }">{{ layerName(s, i) }}</span>
            <span class="ltype">{{ typeLabel[s.type] }}</span>
          </div>
        </div>
      </aside>
    </div>

    <p class="foot">
      说明:坐标为 960×640 画布内的像素值;导出 SVG 含 viewBox,PNG 为 2 倍尺寸。所有图形与历史仅存在当前页面,刷新即清空。
    </p>
  </div>
</template>

<style scoped>
.sve { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.tool {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--card-border); background: transparent; color: var(--el-text-color-regular);
  border-radius: 9px; padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.tool:hover { border-color: var(--el-color-primary); }
.tool.on { border-color: var(--el-color-primary); color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 8%, transparent); }
.tool kbd { font-size: 10px; opacity: 0.6; border: 1px solid var(--card-border); border-radius: 4px; padding: 0 4px; }
.hint { font-size: 11px; color: var(--el-text-color-placeholder); }
.spacer { flex: 1; }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
@media (max-width: 980px) { .body { grid-template-columns: 1fr; } }
.stage { border: 1px solid var(--card-border); border-radius: 12px; padding: 8px; background: var(--el-fill-color-light); }
.canvas-wrap { overflow: auto; max-height: 68vh; border-radius: 8px; }
.canvas {
  display: block; height: auto; border-radius: 8px; touch-action: none;
  background-image: linear-gradient(45deg, rgb(0 0 0 / 6%) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 6%) 75%), linear-gradient(45deg, rgb(0 0 0 / 6%) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 6%) 75%);
  background-size: 18px 18px; background-position: 0 0, 9px 9px; background-color: #fff;
  box-shadow: inset 0 0 0 1px var(--card-border);
}
.stage-foot { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.dim { font-size: 11px; color: var(--el-text-color-placeholder); font-variant-numeric: tabular-nums; }
.side { display: flex; flex-direction: column; gap: 10px; }
.panel { border: 1px solid var(--card-border); border-radius: 12px; padding: 10px 12px; }
.panel.empty { font-size: 12px; color: var(--el-text-color-placeholder); line-height: 1.7; }
.panel-title { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.n { font-weight: 400; color: var(--el-text-color-placeholder); }
.mini { border: none; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; padding: 2px; display: inline-flex; border-radius: 6px; }
.mini:hover { background: var(--el-fill-color); color: var(--el-color-primary); }
.mini.danger:hover { color: #ef4444; }
.field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.field:last-child { margin-bottom: 0; }
.lbl { font-size: 11px; color: var(--el-text-color-secondary); min-width: 28px; }
.coord { font-size: 11px; color: var(--el-text-color-regular); font-variant-numeric: tabular-nums; }
.none-tag { font-size: 11px; color: var(--el-text-color-placeholder); }
.layers { max-height: 260px; overflow: auto; }
.empty-line { font-size: 11px; color: var(--el-text-color-placeholder); }
.layer { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px; cursor: pointer; }
.layer:hover { background: var(--el-fill-color-light); }
.layer.on { background: color-mix(in srgb, var(--el-color-primary) 9%, transparent); }
.lname { flex: 1; min-width: 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lname.off { opacity: 0.45; text-decoration: line-through; }
.ltype { font-size: 10px; color: var(--el-text-color-placeholder); }
.foot { margin-top: 12px; font-size: 11px; color: var(--el-text-color-placeholder); line-height: 1.7; }
</style>
