<script setup lang="ts">
/**
 * 长图拼接 / 布局拼图
 * 完整对齐「好拼」(img.ops-coffee.com/photo/)的功能:
 *   · 左栏:135 个布局模板(按图片数分组)+ 长图竖向 / 横向模式
 *   · 中栏:画布(比例任意)、工具栏(文字 / 箭头 / 方框 / 圆圈 / 随机 / 清除)
 *   · 右栏:画布比例(含打印尺寸与自定义)、边框(上右下左)、间距、圆角、背景色 / 背景图、
 *          水印(文字 / 字号 / 透明度 / 旋转 / 密度 / 位置)、导出质量(高清 JPG / 标准 JPG / PNG)、
 *          复制到剪贴板、下载图片
 * 单元格支持点击上传、拖拽替换、拖动平移、方向键微调、双击复位;全部在本地完成。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Delete, Download, Plus, RefreshLeft, UploadFilled } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import {
  COLLAGE_LAYOUTS,
  COLLAGE_LAYOUT_MAP,
  LAYOUT_BY_COUNT,
  LAYOUT_COUNTS,
  stitchLayout,
  type CollageLayout,
} from '@/config/collageLayouts'
import {
  DESIGN_BASE,
  computeRects,
  coverRect,
  designHeight,
  drawWatermark,
  renderCollage,
  scaleRect,
  type Border,
  type CellDraw,
  type Rect,
  type WatermarkOptions,
} from '@/utils/collage'

/* ------------------------------ 比例预设 ------------------------------ */

interface RatioPreset {
  label: string
  sub?: string
  w: number
  h: number
}

const RATIOS: RatioPreset[] = [
  { label: '1:1', w: 1, h: 1 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '16:10', w: 16, h: 10 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:4', w: 3, h: 4 },
  { label: '2:3', sub: '6寸', w: 2, h: 3 },
  { label: '3:2', sub: '6寸横', w: 3, h: 2 },
  { label: '5:7', sub: '7寸', w: 5, h: 7 },
  { label: '7:5', sub: '7寸横', w: 7, h: 5 },
  { label: '4:5', sub: '8寸', w: 4, h: 5 },
  { label: '5:4', sub: '8寸横', w: 5, h: 4 },
  { label: '210:297', sub: 'A4', w: 210, h: 297 },
  { label: '297:210', sub: 'A4横', w: 297, h: 210 },
]

type Quality = 'high-jpg' | 'medium-jpg' | 'png'

const QUALITIES: { key: Quality; label: string }[] = [
  { key: 'high-jpg', label: '高清JPG' },
  { key: 'medium-jpg', label: '标准JPG' },
  { key: 'png', label: '无损PNG' },
]

/* ------------------------------ 状态 ------------------------------ */

interface CellState {
  img: HTMLImageElement | null
  url: string
  ox: number
  oy: number
  zoom: number
}

interface OverlayState {
  id: string
  type: 'text' | 'arrow' | 'rect' | 'ellipse'
  /** 设计坐标(基准宽 DESIGN_BASE) */
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  size: number
}

const layoutId = ref('4-grid')
const cells = ref<CellState[]>([])
const selected = ref(-1)

const ratioW = ref(1)
const ratioH = ref(1)
const customW = ref(4)
const customH = ref(5)

const border = ref<Border>({ t: 10, r: 10, b: 10, l: 10 })
const spacing = ref(10)
const radius = ref(8)
const bgColor = ref('#ffffff')
const bgUrl = ref('')
const bgImage = ref<HTMLImageElement | null>(null)

interface WatermarkState {
  enabled: boolean
  text: string
  size: number
  opacity: number
  rotate: number
  density: 'low' | 'medium' | 'high'
  anchor: 'none' | 'tl' | 'tr' | 'c' | 'bl' | 'br'
}

const watermark = ref<WatermarkState>({
  enabled: false,
  text: '仅用于演示',
  size: 20,
  opacity: 0.15,
  rotate: -30,
  density: 'medium',
  anchor: 'none',
})

const overlays = ref<OverlayState[]>([])
const selectedOverlay = ref('')

const quality = ref<Quality>('high-jpg')
const countFilter = ref(0) // 0 = 全部

const stageBox = ref<HTMLElement | null>(null)
const stageSize = ref({ w: 460, h: 460 })
const wmCanvas = ref<HTMLCanvasElement | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)
const bgFileRef = ref<HTMLInputElement | null>(null)
let pendingCell = -1

/* ------------------------------ 布局 ------------------------------ */

const isStitch = computed(() => layoutId.value === 'stitch-v' || layoutId.value === 'stitch-h')

const layout = computed<CollageLayout>(() => {
  if (isStitch.value) {
    return stitchLayout(Math.max(2, cells.value.length), layoutId.value === 'stitch-v' ? 'vertical' : 'horizontal')
  }
  return COLLAGE_LAYOUT_MAP.get(layoutId.value) ?? COLLAGE_LAYOUTS[0]
})

/** 按图片数筛选后的模板(用于左栏缩略图) */
const visibleLayouts = computed(() =>
  countFilter.value ? (LAYOUT_BY_COUNT.get(countFilter.value) ?? []) : COLLAGE_LAYOUTS,
)

const totalDesignH = computed(() => designHeight(DESIGN_BASE, ratioW.value, ratioH.value))

/** 设计坐标下的内容框(扣除边框) */
const contentBox = computed<Rect>(() => ({
  x: border.value.l,
  y: border.value.t,
  w: Math.max(1, DESIGN_BASE - border.value.l - border.value.r),
  h: Math.max(1, totalDesignH.value - border.value.t - border.value.b),
}))

const rects = computed<Rect[]>(() =>
  computeRects(layout.value.cols, layout.value.rows, layout.value.cells, contentBox.value, spacing.value),
)

const scale = computed(() => stageSize.value.w / DESIGN_BASE)

/** 预览用的单元格几何 + 图片摆放 */
const previewCells = computed(() =>
  rects.value.map((r, i) => {
    const target = scaleRect(r, scale.value)
    const cell = cells.value[i]
    const img = cell?.img
    const fit = img && cell
      ? coverRect(img.naturalWidth, img.naturalHeight, target, cell.ox, cell.oy, cell.zoom)
      : null
    return { target, fit, radius: radius.value * scale.value }
  }),
)

/** 预览里叠加元素的位置(设计坐标 → 预览 px) */
const previewOverlays = computed(() =>
  overlays.value.map((o) => ({
    ...o,
    left: o.x * scale.value,
    top: o.y * scale.value,
    width: o.w * scale.value,
    height: o.h * scale.value,
    fontSize: o.size * scale.value,
  })),
)

/* ------------------------------ 单元格管理 ------------------------------ */

/** 重建单元格:按索引保留已有图片 */
function syncCells() {
  const n = layout.value.count
  const next: CellState[] = []
  for (let i = 0; i < n; i += 1) {
    const old = cells.value[i]
    next.push(old ?? { img: null, url: '', ox: 0, oy: 0, zoom: 1 })
  }
  // 被裁掉的格子释放对象 URL
  cells.value.slice(n).forEach((c) => c.url && URL.revokeObjectURL(c.url))
  cells.value = next
  if (selected.value >= n) selected.value = -1
}

function applyLayout(id: string) {
  layoutId.value = id
  // 切到长图模式时,按当前图片数铺开,避免丢图
  if (id === 'stitch-v' || id === 'stitch-h') {
    const kept = cells.value.filter((c) => c.img)
    cells.value = kept.length ? kept : cells.value.slice(0, 2)
    const n = Math.max(2, cells.value.length)
    while (cells.value.length < n) cells.value.push({ img: null, url: '', ox: 0, oy: 0, zoom: 1 })
  }
  syncCells()
  selected.value = -1
  void redrawWatermark()
}

/** 把文件写入指定单元格 */
async function loadIntoCell(file: File, index: number): Promise<boolean> {
  if (!file.type.startsWith('image/')) return false
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    const cell = cells.value[index]
    if (!cell) {
      URL.revokeObjectURL(url)
      return false
    }
    if (cell.url) URL.revokeObjectURL(cell.url)
    cell.img = img
    cell.url = url
    cell.ox = 0
    cell.oy = 0
    cell.zoom = 1
    return true
  } catch {
    ElMessage.warning(`${file.name} 加载失败`)
    return false
  }
}

/** 批量加入:填满空位;长图模式下自动增加格子 */
async function addFiles(list: FileList | File[], targetIndex = -1) {
  const files = Array.from(list).filter((f) => f.type.startsWith('image/'))
  if (!files.length) {
    ElMessage.warning('请选择图片文件')
    return
  }
  if (targetIndex >= 0) {
    await loadIntoCell(files[0], targetIndex)
    if (files.length > 1) ElMessage.info('替换模式下每个格子只放一张')
    return
  }
  let idx = 0
  let dropped = 0
  for (const f of files) {
    // 找下一个空位
    while (idx < cells.value.length && cells.value[idx].img) idx += 1
    if (idx >= cells.value.length) {
      if (isStitch.value) {
        cells.value.push({ img: null, url: '', ox: 0, oy: 0, zoom: 1 })
      } else {
        dropped += 1
        continue
      }
    }
    await loadIntoCell(f, idx)
    idx += 1
  }
  if (dropped) ElMessage.warning(`${layout.value.count} 张的布局放不下,已忽略 ${dropped} 张`)
}

function pickForCell(i: number) {
  pendingCell = i
  fileRef.value?.click()
}

function pickForEmpty() {
  pendingCell = -1
  fileRef.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  // FileList 是活引用:先快照成数组,再清空 input.value,否则会被一起清掉
  const files = input.files ? Array.from(input.files) : []
  const target = pendingCell
  input.value = ''
  pendingCell = -1
  if (!files.length) return
  void addFiles(files, target)
}

function removeCellImage(i: number) {
  const cell = cells.value[i]
  if (!cell) return
  if (cell.url) URL.revokeObjectURL(cell.url)
  cell.img = null
  cell.url = ''
  cell.ox = 0
  cell.oy = 0
  cell.zoom = 1
}

function shuffleImages() {
  const imgs = cells.value.map((c) => ({ img: c.img, url: c.url }))
  const filled = imgs.filter((x) => x.img)
  if (filled.length < 2) {
    ElMessage.info('至少要有两张图片才能随机')
    return
  }
  // 只打乱已填充的槽位,空位保持为空
  const slots = imgs.map((x, i) => (x.img ? i : -1)).filter((i) => i >= 0)
  const pool = [...filled]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  slots.forEach((slot, k) => {
    const c = cells.value[slot]
    c.img = pool[k].img
    c.url = pool[k].url
    c.ox = 0
    c.oy = 0
    c.zoom = 1
  })
  ElMessage.success('已随机排列')
}

function clearAll() {
  cells.value.forEach((c) => {
    if (c.url) URL.revokeObjectURL(c.url)
    c.img = null
    c.url = ''
    c.ox = 0
    c.oy = 0
    c.zoom = 1
  })
  selected.value = -1
  ElMessage.success('已清除画布')
}

/* ------------------------------ 拖拽导入 / 平移 ------------------------------ */

const dragging = ref(false)
let dragDepth = 0

function onDragEnter() {
  dragDepth += 1
  dragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  dragging.value = dragDepth > 0
}

function onDrop(e: DragEvent) {
  dragDepth = 0
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) void addFiles(files)
}

let pan: { i: number; sx: number; sy: number; ox: number; oy: number } | null = null

function onCellDown(e: PointerEvent, i: number) {
  const cell = cells.value[i]
  selected.value = i
  selectedOverlay.value = ''
  if (!cell?.img) {
    pickForCell(i)
    return
  }
  pan = { i, sx: e.clientX, sy: e.clientY, ox: cell.ox, oy: cell.oy }
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    /* 合成事件没有活动指针时忽略 */
  }
}

function onCellMove(e: PointerEvent) {
  if (!pan) return
  const cell = cells.value[pan.i]
  const geo = previewCells.value[pan.i]
  if (!cell?.img || !geo) return
  const { target, fit } = geo
  const overflowX = Math.max(1, (fit?.w ?? target.w) - target.w)
  const overflowY = Math.max(1, (fit?.h ?? target.h) - target.h)
  const nx = pan.ox + ((e.clientX - pan.sx) * 2) / overflowX
  const ny = pan.oy + ((e.clientY - pan.sy) * 2) / overflowY
  cell.ox = Math.max(-1, Math.min(1, nx))
  cell.oy = Math.max(-1, Math.min(1, ny))
}

function onCellUp() {
  pan = null
}

function resetPan(i: number) {
  const cell = cells.value[i]
  if (!cell) return
  cell.ox = 0
  cell.oy = 0
  cell.zoom = 1
}

/* ------------------------------ 叠加元素 ------------------------------ */

let overlaySeq = 0

function addOverlay(type: OverlayState['type']) {
  overlaySeq += 1
  const id = `ov-${overlaySeq}`
  const base: OverlayState = {
    id,
    type,
    x: DESIGN_BASE * 0.3,
    y: totalDesignH.value * 0.4,
    w: DESIGN_BASE * 0.4,
    h: 48,
    text: type === 'text' ? '双击编辑文字' : '',
    color: '#ef4444',
    size: 24,
  }
  if (type === 'arrow') base.h = 20
  if (type === 'rect' || type === 'ellipse') base.h = DESIGN_BASE * 0.25
  overlays.value.push(base)
  selectedOverlay.value = id
}

function removeOverlay(id: string) {
  overlays.value = overlays.value.filter((o) => o.id !== id)
  if (selectedOverlay.value === id) selectedOverlay.value = ''
}

let ovDrag: { id: string; sx: number; sy: number; x: number; y: number } | null = null

function onOverlayDown(e: PointerEvent, o: OverlayState) {
  selectedOverlay.value = o.id
  ovDrag = { id: o.id, sx: e.clientX, sy: e.clientY, x: o.x, y: o.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.stopPropagation()
}

function onOverlayMove(e: PointerEvent) {
  if (!ovDrag) return
  const o = overlays.value.find((x) => x.id === ovDrag!.id)
  if (!o) return
  o.x = ovDrag.x + (e.clientX - ovDrag.sx) / scale.value
  o.y = ovDrag.y + (e.clientY - ovDrag.sy) / scale.value
}

function onOverlayUp() {
  ovDrag = null
}

/** 把叠加元素画到导出画布 */
function drawOverlays(canvas: HTMLCanvasElement) {
  if (!overlays.value.length) return
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / DESIGN_BASE
  for (const o of overlays.value) {
    const x = o.x * s
    const y = o.y * s
    const w = o.w * s
    const h = o.h * s
    ctx.save()
    ctx.strokeStyle = o.color
    ctx.fillStyle = o.color
    ctx.lineWidth = Math.max(1, 3 * s)
    if (o.type === 'text') {
      ctx.font = `600 ${o.size * s}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(o.text, x, y + (o.size * s) / 2)
    } else if (o.type === 'rect') {
      ctx.strokeRect(x, y, w, h)
    } else if (o.type === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      const y2 = y + h / 2
      ctx.beginPath()
      ctx.moveTo(x, y2)
      ctx.lineTo(x + w, y2)
      ctx.stroke()
      const head = Math.max(6, 14 * s)
      const dir = w >= 0 ? 1 : -1
      ctx.beginPath()
      ctx.moveTo(x + w, y2)
      ctx.lineTo(x + w - dir * head, y2 - head / 1.6)
      ctx.lineTo(x + w - dir * head, y2 + head / 1.6)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}

/* ------------------------------ 背景图 ------------------------------ */

function pickBg() {
  bgFileRef.value?.click()
}

function onBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    if (bgUrl.value) URL.revokeObjectURL(bgUrl.value)
    bgUrl.value = url
    bgImage.value = img
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    ElMessage.error('背景图加载失败')
  }
  img.src = url
}

function removeBg() {
  if (bgUrl.value) URL.revokeObjectURL(bgUrl.value)
  bgUrl.value = ''
  bgImage.value = null
}

/* ------------------------------ 水印预览 ------------------------------ */

function watermarkOptions(): WatermarkOptions | null {
  if (!watermark.value.enabled || !watermark.value.text.trim()) return null
  return {
    text: watermark.value.text,
    size: watermark.value.size,
    opacity: watermark.value.opacity,
    rotate: watermark.value.rotate,
    density: watermark.value.density,
    anchor: watermark.value.anchor,
  }
}

async function redrawWatermark() {
  const canvas = wmCanvas.value
  if (!canvas) return
  const w = Math.max(1, Math.round(stageSize.value.w))
  const h = Math.max(1, Math.round(stageSize.value.h))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const wm = watermarkOptions()
  if (!wm) return
  drawWatermark(ctx, { w: canvas.width, h: canvas.height }, wm, (canvas.width / DESIGN_BASE))
}

/* ------------------------------ 舞台尺寸 ------------------------------ */

let ro: ResizeObserver | null = null

function fitStage() {
  const box = stageBox.value
  if (!box) return
  const availW = Math.max(120, box.clientWidth - 16)
  const availH = Math.max(120, box.clientHeight - 16)
  const ratio = ratioW.value / ratioH.value
  let w = availW
  let h = w / ratio
  if (h > availH) {
    h = availH
    w = h * ratio
  }
  stageSize.value = { w: Math.round(w), h: Math.round(h) }
}

/* ------------------------------ 导出 ------------------------------ */

function exportSize(): { width: number; height: number } {
  const longEdge = quality.value === 'medium-jpg' ? 1600 : 2400
  const ratio = ratioW.value / ratioH.value
  const width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio)
  const height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge
  return { width, height }
}

function buildCanvas(): HTMLCanvasElement {
  const { width, height } = exportSize()
  const draws: CellDraw[] = cells.value.map((c, i) => ({
    rect: rects.value[i] ?? { x: 0, y: 0, w: 1, h: 1 },
    img: c.img,
    ox: c.ox,
    oy: c.oy,
    zoom: c.zoom,
  }))
  const canvas = renderCollage({
    width,
    height,
    base: DESIGN_BASE,
    radius: radius.value,
    bgColor: bgColor.value,
    bgImage: bgImage.value,
    cells: draws,
    watermark: watermarkOptions(),
  })
  drawOverlays(canvas)
  return canvas
}

async function download() {
  try {
    const canvas = buildCanvas()
    const isPng = quality.value === 'png'
    const type = isPng ? 'image/png' : 'image/jpeg'
    const q = quality.value === 'high-jpg' ? 0.92 : 0.85
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), type, isPng ? undefined : q)
    })
    downloadBlob(blob, `collage-${Date.now()}.${isPng ? 'png' : 'jpg'}`)
    ElMessage.success(`已导出 ${canvas.width}×${canvas.height}`)
  } catch (e) {
    ElMessage.error(`导出失败: ${(e as Error).message}`)
  }
}

async function copyToClipboard() {
  try {
    const canvas = buildCanvas()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('生成失败'))), 'image/png')
    })
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      ElMessage.warning('当前浏览器不支持复制图片,请使用「下载图片」')
      return
    }
    // 浏览器可能在无用户手势 / 未授权时让 Promise 一直挂起,加超时兜底
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('timeout')), 4000)
    })
    await Promise.race([
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
      timeout,
    ])
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    const msg = (e as Error).message === 'timeout' ? '剪贴板写入超时' : '浏览器可能未授权剪贴板写入'
    ElMessage.error(`复制失败:${msg},请改用「下载图片」`)
  }
}

/* ------------------------------ 重置 ------------------------------ */

function resetSettings() {
  ratioW.value = 1
  ratioH.value = 1
  border.value = { t: 10, r: 10, b: 10, l: 10 }
  spacing.value = 10
  radius.value = 8
  bgColor.value = '#ffffff'
  removeBg()
  watermark.value = { enabled: false, text: '仅用于演示', size: 20, opacity: 0.15, rotate: -30, density: 'medium', anchor: 'none' }
  quality.value = 'high-jpg'
  ElMessage.success('已恢复默认设置')
}

function applyRatio(w: number, h: number) {
  ratioW.value = w
  ratioH.value = h
}

function applyCustomRatio() {
  const w = Math.max(1, Math.min(1000, Math.round(customW.value || 1)))
  const h = Math.max(1, Math.min(1000, Math.round(customH.value || 1)))
  customW.value = w
  customH.value = h
  applyRatio(w, h)
}

/* ------------------------------ 生命周期 ------------------------------ */

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
  if (selectedOverlay.value) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeOverlay(selectedOverlay.value)
    }
    return
  }
  const i = selected.value
  if (i < 0) return
  const cell = cells.value[i]
  if (!cell?.img) return
  const step = e.shiftKey ? 0.15 : 0.05
  if (e.key === 'ArrowLeft') {
    cell.ox = Math.max(-1, cell.ox - step)
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    cell.ox = Math.min(1, cell.ox + step)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    cell.oy = Math.max(-1, cell.oy - step)
    e.preventDefault()
  } else if (e.key === 'ArrowDown') {
    cell.oy = Math.min(1, cell.oy + step)
    e.preventDefault()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeCellImage(i)
  }
}

onMounted(() => {
  syncCells()
  fitStage()
  if (stageBox.value) {
    ro = new ResizeObserver(() => fitStage())
    ro.observe(stageBox.value)
  }
  window.addEventListener('keydown', onKeydown)
  void redrawWatermark()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  cells.value.forEach((c) => c.url && URL.revokeObjectURL(c.url))
  if (bgUrl.value) URL.revokeObjectURL(bgUrl.value)
})

watch([ratioW, ratioH, border, spacing, radius], () => {
  fitStage()
  void redrawWatermark()
})
watch([watermark, () => watermark.value.enabled], () => void redrawWatermark(), { deep: true })
watch(stageSize, () => void redrawWatermark())
</script>

<template>
  <ToolPage>
    <template #title>长图拼接</template>
    <template #desc>
      布局拼图 + 长图拼接:135 个布局模板、任意比例、边框 / 间距 / 圆角 / 背景 / 水印,导出 JPG 或 PNG;全部在本地完成。
    </template>

    <div
      class="st-app"
      :class="{ 'is-dragging': dragging }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- 左栏:布局选择 -->
      <aside class="st-side st-left">
        <div class="st-block">
          <h3 class="st-title">布局选择</h3>
          <div class="st-seg">
            <button :class="{ active: layoutId === 'stitch-v' }" @click="applyLayout('stitch-v')">竖向长图</button>
            <button :class="{ active: layoutId === 'stitch-h' }" @click="applyLayout('stitch-h')">横向长图</button>
          </div>
          <div class="st-chips">
            <button :class="{ active: countFilter === 0 }" @click="countFilter = 0">全部</button>
            <button
              v-for="n in LAYOUT_COUNTS"
              :key="n"
              :class="{ active: countFilter === n }"
              @click="countFilter = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <div class="st-block st-grow">
          <div class="st-grid">
            <button
              v-for="l in visibleLayouts"
              :key="l.id"
              class="st-lay"
              :class="{ active: layoutId === l.id }"
              :title="`${l.count} 张 · ${l.id}`"
              @click="applyLayout(l.id)"
            >
              <span
                class="st-lay-grid"
                :style="{ gridTemplateColumns: `repeat(${l.cols}, 1fr)`, gridTemplateRows: `repeat(${l.rows}, 1fr)` }"
              >
                <i
                  v-for="(c, ci) in l.cells"
                  :key="ci"
                  :style="{ gridColumnEnd: `span ${c.w}`, gridRowEnd: `span ${c.h}` }"
                />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <!-- 中栏:工具栏 + 画布 -->
      <main class="st-center">
        <div class="st-toolbar">
          <div class="st-tools">
            <button class="st-btn ghost" @click="addOverlay('text')">文字</button>
            <button class="st-btn ghost" @click="addOverlay('arrow')">箭头</button>
            <button class="st-btn ghost" @click="addOverlay('rect')">方框</button>
            <button class="st-btn ghost" @click="addOverlay('ellipse')">圆圈</button>
          </div>
          <div class="st-tools">
            <button class="st-btn ghost" @click="shuffleImages">随机</button>
            <button class="st-btn ghost danger" @click="clearAll">
              <el-icon><Delete /></el-icon>
              <span>清除</span>
            </button>
          </div>
        </div>

        <div ref="stageBox" class="st-stage">
          <div
            class="st-canvas"
            :style="{
              width: `${stageSize.w}px`,
              height: `${stageSize.h}px`,
              backgroundColor: bgImage ? 'transparent' : bgColor,
              backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
            }"
          >
            <div
              v-for="(pc, i) in previewCells"
              :key="i"
              class="st-cell"
              :class="{ active: selected === i, empty: !cells[i]?.img }"
              :style="{
                left: `${pc.target.x}px`,
                top: `${pc.target.y}px`,
                width: `${pc.target.w}px`,
                height: `${pc.target.h}px`,
                borderRadius: `${pc.radius}px`,
              }"
              @pointerdown="onCellDown($event, i)"
              @pointermove="onCellMove"
              @pointerup="onCellUp"
              @pointercancel="onCellUp"
              @dblclick="resetPan(i)"
            >
              <img
                v-if="pc.fit && cells[i]?.url"
                :src="cells[i].url"
                class="st-cell-img"
                :style="{
                  left: `${pc.fit.x - pc.target.x}px`,
                  top: `${pc.fit.y - pc.target.y}px`,
                  width: `${pc.fit.w}px`,
                  height: `${pc.fit.h}px`,
                }"
                alt=""
                draggable="false"
              />
              <span v-else class="st-cell-add">
                <el-icon :size="20"><Plus /></el-icon>
              </span>
            </div>

            <!-- 水印预览层 -->
            <canvas v-show="watermark.enabled" ref="wmCanvas" class="st-wm" />

            <!-- 叠加元素 -->
            <div
              v-for="o in previewOverlays"
              :key="o.id"
              class="st-ov"
              :class="{ active: selectedOverlay === o.id }"
              :style="{ left: `${o.left}px`, top: `${o.top}px`, width: `${o.width}px`, height: `${o.height}px` }"
              @pointerdown="onOverlayDown($event, o)"
              @pointermove="onOverlayMove"
              @pointerup="onOverlayUp"
            >
              <template v-if="o.type === 'text'">
                <span
                  class="st-ov-text"
                  :style="{ color: o.color, fontSize: `${o.fontSize}px` }"
                  contenteditable="true"
                  @input="(e: Event) => ((overlays.find((x) => x.id === o.id)!.text = (e.target as HTMLElement).innerText))"
                >{{ o.text }}</span>
              </template>
              <svg v-else-if="o.type === 'arrow'" :viewBox="`0 0 ${o.width} ${o.height}`" preserveAspectRatio="none">
                <line :x1="0" :y1="o.height / 2" :x2="o.width" :y2="o.height / 2" :stroke="o.color" stroke-width="3" />
                <polygon
                  :points="`${o.width},${o.height / 2} ${o.width - 14},${o.height / 2 - 9} ${o.width - 14},${o.height / 2 + 9}`"
                  :fill="o.color"
                />
              </svg>
              <div
                v-else
                class="st-ov-shape"
                :style="{
                  borderColor: o.color,
                  borderRadius: o.type === 'ellipse' ? '50%' : '0',
                  borderWidth: `${Math.max(1, 3 * scale)}px`,
                }"
              />
              <button class="st-ov-del" title="删除" @pointerdown.stop @click.stop="removeOverlay(o.id)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>

          <button v-if="!cells.some((c) => c.img)" class="st-placeholder" @click="pickForEmpty">
            <el-icon :size="26"><UploadFilled /></el-icon>
            <span>点击选择图片,或拖入画布</span>
          </button>
        </div>

        <p class="st-hint">
          提示:点击格子选择图片;按住格子拖动可平移;选中后可用 <b>↑ ↓ ← →</b> 微调,<b>Delete</b> 清空该格,双击复位。
        </p>

        <input ref="fileRef" type="file" accept="image/*" multiple hidden @change="onFileChange" />
      </main>

      <!-- 右栏:画布设置 / 样式 / 水印 / 导出 -->
      <aside class="st-side st-right">
        <div class="st-block">
          <h3 class="st-title">
            画布设置
            <button class="st-reset" title="恢复默认设置" @click="resetSettings">
              <el-icon><RefreshLeft /></el-icon>
            </button>
          </h3>
          <div class="st-ratios">
            <button
              v-for="r in RATIOS"
              :key="r.label"
              :class="{ active: ratioW === r.w && ratioH === r.h }"
              @click="applyRatio(r.w, r.h)"
            >
              {{ r.label }}<em v-if="r.sub">{{ r.sub }}</em>
            </button>
          </div>
          <div class="st-custom">
            <span>自定义</span>
            <input v-model.number="customW" type="number" min="1" max="1000" />
            <b>:</b>
            <input v-model.number="customH" type="number" min="1" max="1000" />
            <button class="st-btn ghost" @click="applyCustomRatio">应用</button>
          </div>
        </div>

        <div class="st-block">
          <h3 class="st-title">样式调整</h3>
          <div class="st-label">边框 (上 / 右 / 下 / 左) px</div>
          <div class="st-borders">
            <input v-model.number="border.t" type="number" min="0" max="200" />
            <input v-model.number="border.r" type="number" min="0" max="200" />
            <input v-model.number="border.b" type="number" min="0" max="200" />
            <input v-model.number="border.l" type="number" min="0" max="200" />
          </div>

          <div class="st-field">
            <label>间距 <b>{{ spacing }}</b> px</label>
            <input v-model.number="spacing" type="range" min="0" max="100" step="1" />
          </div>
          <div class="st-field">
            <label>圆角 <b>{{ radius }}</b> px</label>
            <input v-model.number="radius" type="range" min="0" max="100" step="1" />
          </div>
          <div class="st-field">
            <label>背景颜色</label>
            <div class="st-color">
              <input v-model="bgColor" type="color" />
              <span>{{ bgColor.toUpperCase() }}</span>
              <button v-if="bgUrl" class="st-btn ghost" @click="removeBg">移除背景图</button>
            </div>
          </div>
          <div class="st-field">
            <label>背景图片</label>
            <button class="st-btn ghost full" @click="pickBg">
              <el-icon><UploadFilled /></el-icon>
              <span>{{ bgUrl ? '更换背景图' : '上传背景图' }}</span>
            </button>
            <input ref="bgFileRef" type="file" accept="image/*" hidden @change="onBgChange" />
          </div>
        </div>

        <div class="st-block">
          <h3 class="st-title">高级配置</h3>
          <label class="st-check">
            <input v-model="watermark.enabled" type="checkbox" />
            <span>启用图片水印</span>
          </label>
          <template v-if="watermark.enabled">
            <div class="st-field">
              <label>水印文字</label>
              <input v-model="watermark.text" class="st-input" type="text" maxlength="24" />
            </div>
            <div class="st-field">
              <label>字号 <b>{{ watermark.size }}</b> px</label>
              <input v-model.number="watermark.size" type="range" min="12" max="100" step="1" />
            </div>
            <div class="st-field">
              <label>透明度 <b>{{ watermark.opacity.toFixed(2) }}</b></label>
              <input v-model.number="watermark.opacity" type="range" min="0.05" max="1" step="0.05" />
            </div>
            <div class="st-field">
              <label>旋转角度 <b>{{ watermark.rotate }}</b>°</label>
              <input v-model.number="watermark.rotate" type="range" min="-90" max="90" step="5" />
            </div>
            <div class="st-field">
              <label>水印密度</label>
              <div class="st-seg three">
                <button :class="{ active: watermark.density === 'low' }" @click="watermark.density = 'low'">稀疏</button>
                <button :class="{ active: watermark.density === 'medium' }" @click="watermark.density = 'medium'">中等</button>
                <button :class="{ active: watermark.density === 'high' }" @click="watermark.density = 'high'">密集</button>
              </div>
            </div>
            <div class="st-field">
              <label>水印位置</label>
              <div class="st-anchors">
                <button :class="{ active: watermark.anchor === 'none' }" @click="watermark.anchor = 'none'">平铺</button>
                <button :class="{ active: watermark.anchor === 'tl' }" @click="watermark.anchor = 'tl'">左上</button>
                <button :class="{ active: watermark.anchor === 'tr' }" @click="watermark.anchor = 'tr'">右上</button>
                <button :class="{ active: watermark.anchor === 'c' }" @click="watermark.anchor = 'c'">居中</button>
                <button :class="{ active: watermark.anchor === 'bl' }" @click="watermark.anchor = 'bl'">左下</button>
                <button :class="{ active: watermark.anchor === 'br' }" @click="watermark.anchor = 'br'">右下</button>
              </div>
            </div>
          </template>
        </div>

        <div class="st-block">
          <h3 class="st-title">导出设置</h3>
          <div class="st-label">图片质量</div>
          <div class="st-seg three">
            <button
              v-for="q in QUALITIES"
              :key="q.key"
              :class="{ active: quality === q.key }"
              @click="quality = q.key"
            >
              {{ q.label }}
            </button>
          </div>
          <p class="st-hint">尺寸 {{ exportSize().width }} × {{ exportSize().height }} px</p>
          <div class="st-exports">
            <button class="st-btn ghost full" @click="copyToClipboard">复制到剪贴板</button>
            <button class="st-btn primary full" @click="download">
              <el-icon><Download /></el-icon>
              <span>下载图片</span>
            </button>
          </div>
        </div>
      </aside>

      <div v-if="dragging" class="st-drop-tip">松开即可加入图片</div>
    </div>
  </ToolPage>
</template>

<style scoped>
/* 设计令牌取自「好拼」(img.ops-coffee.com),深色模式做对应映射 */
.st-app {
  --st-bg: #f4f5f7;
  --st-panel: #ffffff;
  --st-text: #172b4d;
  --st-text2: #42526e;
  --st-muted: #6b7f99;
  --st-border: #dfe1e6;
  --st-accent: #0052cc;
  --st-accent-soft: #e9f2ff;
  --st-soft: #fafbfc;

  position: relative;
  display: grid;
  grid-template-columns: 214px minmax(0, 1fr) 246px;
  /* 整页打开:填满视口(标题区约 150px);浮层打开时也够高 */
  height: clamp(460px, calc(100vh - 170px), 1600px);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--st-bg);
  color: var(--st-text2);
  font-size: 13px;
}
html.dark .st-app {
  --st-bg: #0f1319;
  --st-panel: #171c23;
  --st-text: #e6edf3;
  --st-text2: #b9c4d0;
  --st-muted: #8b98a5;
  --st-border: #2a323c;
  --st-accent: #4c9aff;
  --st-accent-soft: #1b2a41;
  --st-soft: #1f252d;
}
.st-app.is-dragging {
  outline: 2px dashed var(--st-accent);
  outline-offset: -6px;
}

/* 侧栏 */
.st-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: var(--st-panel);
}
.st-left { border-right: 1px solid var(--st-border); }
.st-right { border-left: 1px solid var(--st-border); }
.st-block { padding: 14px; }
.st-block + .st-block { border-top: 1px solid var(--st-border); }
.st-grow { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

.st-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--st-border);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--st-text);
}
.st-reset {
  margin-left: auto;
  display: flex;
  align-items: center;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--st-muted);
  cursor: pointer;
}
.st-reset:hover { color: var(--st-accent); }

.st-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--st-text2);
}

/* 分段按钮 */
.st-seg {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.st-seg.three { grid-auto-flow: row; grid-template-columns: repeat(3, 1fr); }
.st-seg button,
.st-anchors button {
  padding: 6px 4px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-soft);
  color: var(--st-text2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}
.st-seg button:hover,
.st-anchors button:hover { border-color: #c1c7d0; }
.st-seg button.active,
.st-anchors button.active {
  background: var(--st-accent-soft);
  color: var(--st-accent);
  border-color: var(--st-accent);
  font-weight: 600;
}

/* 数量筛选 */
.st-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.st-chips button {
  min-width: 24px;
  padding: 2px 6px;
  border: 1px solid var(--st-border);
  border-radius: 999px;
  background: var(--st-soft);
  color: var(--st-muted);
  font-size: 11px;
  cursor: pointer;
}
.st-chips button.active {
  background: var(--st-accent-soft);
  border-color: var(--st-accent);
  color: var(--st-accent);
  font-weight: 600;
}

/* 布局缩略图 */
.st-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}
.st-lay {
  padding: 5px;
  border: 1px solid var(--st-border);
  border-radius: 8px;
  background: var(--st-soft);
  cursor: pointer;
  transition: all 0.18s ease;
}
.st-lay:hover { border-color: #c1c7d0; }
.st-lay.active {
  border-color: var(--st-accent);
  background: var(--st-accent-soft);
}
.st-lay-grid {
  display: grid;
  gap: 2px;
  width: 100%;
  aspect-ratio: 1 / 1;
}
.st-lay-grid i {
  display: block;
  border-radius: 2px;
  background: #c1c7d0;
}
.st-lay.active .st-lay-grid i { background: var(--st-accent); }

/* 按钮 */
.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease-out;
}
.st-btn.full { width: 100%; }
.st-btn.ghost {
  background: var(--st-soft);
  color: var(--st-text2);
  border-color: var(--st-border);
}
.st-btn.ghost:hover { background: var(--st-bg); border-color: #c1c7d0; }
.st-btn.ghost.danger:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}
.st-btn.primary {
  background: var(--st-accent);
  color: #fff;
  border-color: var(--st-accent);
}
.st-btn.primary:hover { filter: brightness(1.08); }

.st-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--st-muted);
}
.st-hint b { color: var(--st-text2); }

/* 中栏 */
.st-center {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}
.st-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  background: #f8f9fa;
  box-shadow: 0 2px 4px rgb(0 0 0 / 5%);
}
html.dark .st-toolbar {
  border-color: var(--st-border);
  background: var(--st-panel);
}
.st-tools { display: flex; gap: 6px; }

.st-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.st-canvas {
  position: relative;
  flex: none;
  background-size: cover;
  background-position: center;
  box-shadow: 0 4px 12px -2px rgb(9 30 66 / 25%), 0 0 1px rgb(9 30 66 / 20%);
  user-select: none;
}
.st-cell {
  position: absolute;
  overflow: hidden;
  background: rgb(0 0 0 / 4%);
  cursor: pointer;
}
.st-cell.empty {
  border: 1px dashed rgb(0 0 0 / 18%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.st-cell.active { outline: 2px solid var(--st-accent); outline-offset: -2px; }
.st-cell-img {
  position: absolute;
  max-width: none;
  pointer-events: none;
}
.st-cell-add { color: var(--st-muted); pointer-events: none; }

.st-wm {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.st-placeholder {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 22px;
  border: 2px dashed var(--st-border);
  border-radius: 10px;
  background: rgb(255 255 255 / 88%);
  color: var(--st-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.st-placeholder:hover { border-color: var(--st-accent); color: var(--st-accent); }

/* 叠加元素 */
.st-ov {
  position: absolute;
  cursor: move;
}
.st-ov.active { outline: 1px dashed var(--st-accent); }
.st-ov-text {
  display: block;
  outline: none;
  white-space: pre-wrap;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgb(0 0 0 / 25%);
}
.st-ov svg { width: 100%; height: 100%; display: block; }
.st-ov-shape { width: 100%; height: 100%; border-style: solid; }
.st-ov-del {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 18px;
  height: 18px;
  display: none;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  cursor: pointer;
}
.st-ov.active .st-ov-del { display: flex; }

/* 右栏控件 */
.st-ratios {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.st-ratios button {
  padding: 5px 2px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-soft);
  color: var(--st-text2);
  font-size: 11.5px;
  cursor: pointer;
  line-height: 1.35;
}
.st-ratios button em {
  display: block;
  font-style: normal;
  font-size: 10px;
  color: var(--st-muted);
}
.st-ratios button.active {
  background: var(--st-accent-soft);
  border-color: var(--st-accent);
  color: var(--st-accent);
  font-weight: 600;
}
.st-ratios button.active em { color: var(--st-accent); }

.st-custom {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--st-muted);
}
.st-custom input {
  width: 44px;
  padding: 3px 5px;
  border: 1px solid var(--st-border);
  border-radius: 5px;
  background: var(--st-panel);
  color: var(--st-text);
  font-size: 12px;
  text-align: center;
}

.st-borders {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}
.st-borders input {
  width: 100%;
  padding: 4px 2px;
  border: 1px solid var(--st-border);
  border-radius: 5px;
  background: var(--st-panel);
  color: var(--st-text);
  font-size: 12px;
  text-align: center;
}

.st-field { margin-bottom: 12px; }
.st-field > label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--st-text2);
}
.st-field > label b { color: var(--st-text); font-weight: 600; }
.st-field input[type='range'] {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--st-border);
  accent-color: var(--st-accent);
  cursor: pointer;
}
.st-input {
  width: 100%;
  padding: 5px 7px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-panel);
  color: var(--st-text);
  font-size: 12.5px;
}

.st-color { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.st-color input[type='color'] {
  width: 34px;
  height: 26px;
  padding: 2px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-soft);
  cursor: pointer;
}
.st-color span {
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--st-text2);
}

.st-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12.5px;
  color: var(--st-text2);
  cursor: pointer;
}
.st-check input { width: 15px; height: 15px; accent-color: var(--st-accent); }

.st-anchors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.st-exports { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

/* 拖拽提示 */
.st-drop-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--st-panel) 82%, transparent);
  color: var(--st-accent);
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
}

/* 窄屏退化为单列 */
@media (max-width: 900px) {
  .st-app {
    grid-template-columns: 1fr;
    height: auto;
  }
  .st-center { order: -1; height: 360px; }
  .st-left { border-right: none; border-top: 1px solid var(--st-border); }
  .st-right { border-left: none; border-top: 1px solid var(--st-border); }
  .st-grow { max-height: 320px; }
}
</style>
