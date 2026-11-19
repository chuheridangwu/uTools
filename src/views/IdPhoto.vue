<script setup lang="ts">
/**
 * 证件照制作
 * 纯前端(不上传)完成:自动去背景 → 换底色 → 按标准尺寸裁剪 → 导出 / 排版打印。
 *
 * 抠图算法(零依赖、可离线):
 *  - 从图片四边取种子像素,做「颜色相似区域生长」(4 邻域 BFS),
 *    与相邻像素的加权 RGB 距离小于容差就判为背景,适合证件照常见的纯色/简单背景;
 *  - 支持边缘羽化(对 alpha 做盒式模糊,只柔化边界);
 *  - 复杂背景可用「擦除 / 恢复」画笔手动修整,支持撤销。
 * 说明:未引入 ONNX 模型,因此不依赖外网下载几十 MB 模型文件;换底色、尺寸、排版均为本地 canvas 合成。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Aim, Brush, Delete, Download, MagicStick, Picture, RefreshLeft, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/zip'

/* ------------------------------ 图片与画布 ------------------------------ */
const fileRef = ref<HTMLInputElement>()
const previewCanvas = ref<HTMLCanvasElement>()
const stageRef = ref<HTMLElement>()

const hasImage = ref(false)
const imgName = ref('')
const loading = ref(false)

/** 工作图最长边上限(证件照输出最大约 600px,2000px 足够且处理更快) */
const MAX_SIDE = 2000

let workW = 0
let workH = 0
/** 原图像素(只读) */
let origData: ImageData | null = null
/** 合成用像素:RGB 来自原图,alpha 来自 mask */
let workImageData: ImageData | null = null
/** 每像素 alpha(0=背景,255=保留) */
let mask: Uint8ClampedArray | null = null
/** 抠图后带透明通道的 canvas */
let cutCanvas: HTMLCanvasElement | null = null
let cutCtx: CanvasRenderingContext2D | null = null

/* ------------------------------ 预览取景 ------------------------------ */
const frameW = ref(300)
const frameH = ref(400)
const zoom = ref(1)
const panX = ref(0) // 以取景框宽/高为单位的平移比例
const panY = ref(0)
const showGuides = ref(true)

/* ------------------------------ 抠图参数 ------------------------------ */
const tolerance = ref(18)
const feather = ref(1)
const processing = ref(false)
const hasCut = ref(false)

/* ------------------------------ 画笔修整 ------------------------------ */
const brushMode = ref<'none' | 'erase' | 'restore'>('none')
const brushSize = ref(48) // 预览像素
const undoStack: Uint8ClampedArray[] = []
const undoCount = ref(0)
let painting = false
let lastPaint: { x: number; y: number } | null = null

/* ------------------------------ 背景 ------------------------------ */
type BgMode = 'solid' | 'gradient' | 'transparent'
const bgMode = ref<BgMode>('solid')
const bgColor = ref('#ffffff')
const bgColor2 = ref('#dbeafe')
const BG_PRESETS = [
  { label: '白底', color: '#ffffff' },
  { label: '蓝底', color: '#438edb' },
  { label: '红底', color: '#d9001b' },
  { label: '浅蓝', color: '#d6e8ff' },
  { label: '灰底', color: '#e5e7eb' },
]

/* ------------------------------ 尺寸 ------------------------------ */
interface SizePreset {
  key: string
  label: string
  wmm: number
  hmm: number
}
const SIZE_PRESETS: SizePreset[] = [
  { key: 'one', label: '一寸 25×35mm', wmm: 25, hmm: 35 },
  { key: 'small-one', label: '小一寸 22×32mm', wmm: 22, hmm: 32 },
  { key: 'big-one', label: '大一寸 33×48mm', wmm: 33, hmm: 48 },
  { key: 'two', label: '二寸 35×49mm', wmm: 35, hmm: 49 },
  { key: 'small-two', label: '小二寸 35×45mm', wmm: 35, hmm: 45 },
  { key: 'big-two', label: '大二寸 35×53mm', wmm: 35, hmm: 53 },
  { key: 'passport', label: '护照 33×48mm', wmm: 33, hmm: 48 },
  { key: 'hk-mo', label: '港澳通行证 33×48mm', wmm: 33, hmm: 48 },
  { key: 'driver', label: '驾驶证 22×32mm', wmm: 22, hmm: 32 },
  { key: 'social', label: '社保卡 26×32mm', wmm: 26, hmm: 32 },
  { key: 'us-visa', label: '美国签证 51×51mm', wmm: 51, hmm: 51 },
  { key: 'jp-visa', label: '日本签证 45×45mm', wmm: 45, hmm: 45 },
  { key: 'kr-visa', label: '韩国签证 35×45mm', wmm: 35, hmm: 45 },
  { key: 'schengen', label: '申根签证 35×45mm', wmm: 35, hmm: 45 },
  { key: 'custom', label: '自定义尺寸', wmm: 0, hmm: 0 },
]
const sizeKey = ref('one')
const customW = ref(25)
const customH = ref(35)
const dpi = ref(300)

const sizePreset = computed(() => SIZE_PRESETS.find((s) => s.key === sizeKey.value) ?? SIZE_PRESETS[0])
const mmW = computed(() => (sizeKey.value === 'custom' ? customW.value : sizePreset.value.wmm))
const mmH = computed(() => (sizeKey.value === 'custom' ? customH.value : sizePreset.value.hmm))
const outW = computed(() => Math.max(1, Math.round((mmW.value / 25.4) * dpi.value)))
const outH = computed(() => Math.max(1, Math.round((mmH.value / 25.4) * dpi.value)))

/* ------------------------------ 导出 ------------------------------ */
const exportFormat = ref<'jpg' | 'png'>('jpg')
const PAPERS = [
  { key: '5', label: '5寸相纸 89×127mm', w: 1050, h: 1500 },
  { key: '6', label: '6寸相纸 102×152mm', w: 1200, h: 1800 },
  { key: '7', label: '7寸相纸 127×178mm', w: 1500, h: 2100 },
]
const paperKey = ref('6')

/* ====================================================================== *
 * 文件载入
 * ====================================================================== */
function pickFile() {
  fileRef.value?.click()
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // FileList 是活引用,先取再清空
  if (file) void loadFile(file)
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (file) void loadFile(file)
}

async function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  loading.value = true
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    workW = Math.max(1, Math.round(img.naturalWidth * scale))
    workH = Math.max(1, Math.round(img.naturalHeight * scale))

    const src = document.createElement('canvas')
    src.width = workW
    src.height = workH
    const sctx = src.getContext('2d', { willReadFrequently: true })!
    sctx.drawImage(img, 0, 0, workW, workH)
    origData = sctx.getImageData(0, 0, workW, workH)

    cutCanvas = document.createElement('canvas')
    cutCanvas.width = workW
    cutCanvas.height = workH
    cutCtx = cutCanvas.getContext('2d', { willReadFrequently: true })!
    workImageData = new ImageData(new Uint8ClampedArray(origData.data), workW, workH)

    mask = new Uint8ClampedArray(workW * workH).fill(255)
    hasCut.value = false
    hasImage.value = true
    imgName.value = file.name.replace(/\.[^.]+$/, '')
    zoom.value = 1
    panX.value = 0
    panY.value = 0
    brushMode.value = 'none'
    undoStack.length = 0
    undoCount.value = 0

    rebuildCutout()
    await nextTick()
    updateFrame()
    redraw()
    ElMessage.success(`已载入 ${workW} × ${workH}`)
  } catch (err) {
    ElMessage.error(`图片载入失败:${(err as Error).message}`)
  } finally {
    URL.revokeObjectURL(url)
    loading.value = false
  }
}

/* ====================================================================== *
 * 抠图:颜色相似区域生长
 * ====================================================================== */
/** 加权 RGB 距离平方(对绿色更敏感),已归一化到 0..255² */
function colorDist2(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return (2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9
}

/**
 * 取四边像素各通道的中位数作为背景色模型。
 * 用中位数而非均值:证件照里肩膀/头发常压到画面底边,中位数能抵抗这些「主体混入边框」的离群点。
 */
function medianBorderColor(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const add = (idx: number) => {
    const p = idx * 4
    rs.push(data[p])
    gs.push(data[p + 1])
    bs.push(data[p + 2])
  }
  for (let x = 0; x < w; x++) {
    add(x)
    add((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    add(y * w)
    add(y * w + w - 1)
  }
  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b)
    return arr[arr.length >> 1] ?? 0
  }
  return [med(rs), med(gs), med(bs)]
}

/**
 * 抠图:以边框中位色为背景模型,从「与模型相近的边框像素」出发做 4 邻域 BFS。
 * 只接受「颜色接近背景模型」的像素,避免沿抗锯齿边缘逐步爬进主体;
 * 主体压到底边也不会被当成种子(种子需先通过颜色阈值)。
 */
function computeMask(data: Uint8ClampedArray, w: number, h: number, tol: number): Uint8ClampedArray {
  const n = w * h
  const [mr, mg, mb] = medianBorderColor(data, w, h)
  const limit = tol * tol
  const visited = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0

  const matches = (idx: number) => {
    const p = idx * 4
    return colorDist2(data[p], data[p + 1], data[p + 2], mr, mg, mb) <= limit
  }
  const seed = (idx: number) => {
    if (!visited[idx] && matches(idx)) {
      visited[idx] = 1
      stack[sp++] = idx
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    seed(y * w)
    seed(y * w + w - 1)
  }

  while (sp > 0) {
    const idx = stack[--sp]
    const x = idx % w
    const y = (idx / w) | 0

    const tryPush = (j: number) => {
      if (!visited[j] && matches(j)) {
        visited[j] = 1
        stack[sp++] = j
      }
    }
    if (x + 1 < w) tryPush(idx + 1)
    if (x > 0) tryPush(idx - 1)
    if (y + 1 < h) tryPush(idx + w)
    if (y > 0) tryPush(idx - w)
  }

  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) out[i] = visited[i] ? 0 : 255
  return out
}

/** 对 alpha 做盒式模糊,只柔化边界(内部仍为 255,背景仍为 0) */
function blurAlpha(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  if (r <= 0) return src
  const tmp = new Float32Array(w * h)
  const out = new Uint8ClampedArray(w * h)
  const win = r * 2 + 1

  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win
      const add = Math.min(w - 1, x + r + 1)
      const sub = Math.max(0, x - r)
      sum += src[row + add] - src[row + sub]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win
      const add = Math.min(h - 1, y + r + 1)
      const sub = Math.max(0, y - r)
      sum += tmp[add * w + x] - tmp[sub * w + x]
    }
  }
  return out
}

function autoRemoveBg() {
  if (!origData || !mask) return
  processing.value = true
  // 让 loading 状态先渲染一帧,再执行同步计算
  setTimeout(() => {
    try {
      pushUndo()
      const raw = computeMask(origData!.data, workW, workH, tolerance.value)
      mask = feather.value > 0 ? blurAlpha(raw, workW, workH, feather.value) : raw
      hasCut.value = true
      rebuildCutout()
      redraw()
    } catch (err) {
      ElMessage.error(`抠图失败:${(err as Error).message}`)
    } finally {
      processing.value = false
    }
  }, 30)
}

function resetCut() {
  if (!mask) return
  pushUndo()
  mask.fill(255)
  hasCut.value = false
  rebuildCutout()
  redraw()
}

/** 把 mask 应用到像素 alpha 并写入 cutCanvas */
function rebuildCutout() {
  if (!workImageData || !mask || !cutCtx || !cutCanvas) return
  const d = workImageData.data
  for (let i = 0; i < mask.length; i++) d[i * 4 + 3] = mask[i]
  cutCtx.putImageData(workImageData, 0, 0)
}

/* ====================================================================== *
 * 撤销
 * ====================================================================== */
function pushUndo() {
  if (!mask) return
  undoStack.push(new Uint8ClampedArray(mask))
  if (undoStack.length > 8) undoStack.shift()
  undoCount.value = undoStack.length
}

function undo() {
  const prev = undoStack.pop()
  undoCount.value = undoStack.length
  if (!prev || !mask) return
  mask.set(prev)
  rebuildCutout()
  redraw()
}

/* ====================================================================== *
 * 预览渲染
 * ====================================================================== */
let rafDraw = 0
let rafRebuild = 0

function scheduleDraw() {
  if (rafDraw) return
  rafDraw = requestAnimationFrame(() => {
    rafDraw = 0
    redraw()
  })
}

function scheduleRebuild() {
  if (rafRebuild) return
  rafRebuild = requestAnimationFrame(() => {
    rafRebuild = 0
    rebuildCutout()
    redraw()
  })
}

function updateFrame() {
  const stage = stageRef.value
  if (!stage) return
  const ratio = outW.value / outH.value
  const maxH = Math.max(240, Math.min(560, window.innerHeight - 300))
  const maxW = Math.max(160, Math.min(460, stage.clientWidth - 4))
  let h = maxH
  let w = h * ratio
  if (w > maxW) {
    w = maxW
    h = w / ratio
  }
  frameW.value = Math.max(60, Math.round(w))
  frameH.value = Math.max(60, Math.round(h))
  clampPan()
  redraw()
}

/** 取景框内的图片变换(cover + zoom + pan) */
function imageTransform(fw: number, fh: number) {
  const iw = workW || 1
  const ih = workH || 1
  const base = Math.max(fw / iw, fh / ih)
  const s = base * zoom.value
  const dw = iw * s
  const dh = ih * s
  let x = (fw - dw) / 2 + panX.value * fw
  let y = (fh - dh) / 2 + panY.value * fh
  x = Math.min(0, Math.max(fw - dw, x))
  y = Math.min(0, Math.max(fh - dh, y))
  return { x, y, dw, dh, s }
}

/** 把平移限制在图片始终覆盖取景框的范围内 */
function clampPan() {
  if (!workW || !workH) return
  const base = Math.max(frameW.value / workW, frameH.value / workH)
  const s = base * zoom.value
  const mx = Math.max(0, (workW * s) / frameW.value - 1) / 2
  const my = Math.max(0, (workH * s) / frameH.value - 1) / 2
  panX.value = Math.min(mx, Math.max(-mx, panX.value))
  panY.value = Math.min(my, Math.max(-my, panY.value))
}

function drawBackground(ctx: CanvasRenderingContext2D, fw: number, fh: number, preview: boolean) {
  ctx.clearRect(0, 0, fw, fh)
  if (bgMode.value === 'transparent') {
    if (preview) drawChecker(ctx, fw, fh)
    return
  }
  if (bgMode.value === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, fh)
    g.addColorStop(0, bgColor.value)
    g.addColorStop(1, bgColor2.value)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bgColor.value
  }
  ctx.fillRect(0, 0, fw, fh)
}

let checkerPattern: CanvasPattern | null = null
function drawChecker(ctx: CanvasRenderingContext2D, fw: number, fh: number) {
  if (!checkerPattern) {
    const tile = document.createElement('canvas')
    tile.width = 16
    tile.height = 16
    const t = tile.getContext('2d')!
    t.fillStyle = '#f3f4f6'
    t.fillRect(0, 0, 16, 16)
    t.fillStyle = '#e5e7eb'
    t.fillRect(0, 0, 8, 8)
    t.fillRect(8, 8, 8, 8)
    checkerPattern = ctx.createPattern(tile, 'repeat')
  }
  ctx.fillStyle = checkerPattern ?? '#f3f4f6'
  ctx.fillRect(0, 0, fw, fh)
}

function drawGuides(ctx: CanvasRenderingContext2D, fw: number, fh: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  // 竖向中线
  ctx.beginPath()
  ctx.moveTo(fw / 2, 0)
  ctx.lineTo(fw / 2, fh)
  ctx.stroke()
  // 眼睛参考线(约 42% 高度)
  ctx.beginPath()
  ctx.moveTo(0, fh * 0.42)
  ctx.lineTo(fw, fh * 0.42)
  ctx.stroke()
  // 头部参考椭圆
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)'
  ctx.beginPath()
  ctx.ellipse(fw / 2, fh * 0.4, fw * 0.3, fh * 0.24, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function redraw() {
  const canvas = previewCanvas.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const fw = frameW.value
  const fh = frameH.value
  canvas.width = Math.max(1, Math.round(fw * dpr))
  canvas.height = Math.max(1, Math.round(fh * dpr))
  canvas.style.width = `${fw}px`
  canvas.style.height = `${fh}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBackground(ctx, fw, fh, true)
  if (cutCanvas) {
    const t = imageTransform(fw, fh)
    ctx.drawImage(cutCanvas, t.x, t.y, t.dw, t.dh)
  }
  if (showGuides.value) drawGuides(ctx, fw, fh)
}

/* ====================================================================== *
 * 交互:拖动 / 缩放 / 画笔
 * ====================================================================== */
let dragging = false
let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

function canvasPoint(e: PointerEvent): { x: number; y: number } {
  const canvas = previewCanvas.value!
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  if (!hasImage.value) return
  const canvas = previewCanvas.value
  if (!canvas) return
  // 合成事件 / 部分触控笔的 pointerId 可能不是活动指针,捕获失败不应中断绘制
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  const pt = canvasPoint(e)
  if (brushMode.value === 'none') {
    dragging = true
    dragStart = { x: pt.x, y: pt.y, panX: panX.value, panY: panY.value }
  } else {
    painting = true
    pushUndo()
    lastPaint = null
    paintAt(pt.x, pt.y)
  }
}

function onPointerMove(e: PointerEvent) {
  if (!hasImage.value) return
  const pt = canvasPoint(e)
  if (dragging) {
    panX.value = dragStart.panX + (pt.x - dragStart.x) / frameW.value
    panY.value = dragStart.panY + (pt.y - dragStart.y) / frameH.value
    clampPan()
    scheduleDraw()
  } else if (painting) {
    paintAt(pt.x, pt.y)
  }
}

function onPointerUp(e: PointerEvent) {
  const canvas = previewCanvas.value
  try {
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  dragging = false
  painting = false
  lastPaint = null
}

/** 在预览坐标 (px,py) 处涂抹,沿上一位置补间避免快速移动断点 */
function paintAt(px: number, py: number) {
  if (!mask) return
  const t = imageTransform(frameW.value, frameH.value)
  const ix = (px - t.x) / t.s
  const iy = (py - t.y) / t.s
  const rImg = brushSize.value / 2 / t.s
  const value = brushMode.value === 'erase' ? 0 : 255
  if (lastPaint) {
    const dx = ix - lastPaint.x
    const dy = iy - lastPaint.y
    const dist = Math.hypot(dx, dy)
    const step = Math.max(1, rImg * 0.4)
    const steps = Math.ceil(dist / step)
    for (let i = 1; i <= steps; i++) {
      stamp(lastPaint.x + (dx * i) / steps, lastPaint.y + (dy * i) / steps, rImg, value)
    }
  } else {
    stamp(ix, iy, rImg, value)
  }
  lastPaint = { x: ix, y: iy }
  scheduleRebuild()
}

function stamp(cx: number, cy: number, r: number, value: number) {
  if (!mask) return
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(workW - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(workH - 1, Math.ceil(cy + r))
  const r2 = r * r
  for (let y = y0; y <= y1; y++) {
    const row = y * workW
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) mask[row + x] = value
    }
  }
}

function onWheel(e: WheelEvent) {
  if (!hasImage.value) return
  const next = Math.min(4, Math.max(1, zoom.value * (1 - e.deltaY * 0.0012)))
  zoom.value = Math.round(next * 100) / 100
  clampPan()
  scheduleDraw()
}

function zoomBy(delta: number) {
  zoom.value = Math.min(4, Math.max(1, Math.round((zoom.value + delta) * 100) / 100))
  clampPan()
  scheduleDraw()
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  redraw()
}

/* ====================================================================== *
 * 导出
 * ====================================================================== */
/** 按输出尺寸渲染一张证件照(带当前底色) */
function renderOutput(transparent: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = outW.value
  c.height = outH.value
  const ctx = c.getContext('2d')!
  if (transparent) {
    ctx.clearRect(0, 0, c.width, c.height)
  } else {
    drawBackground(ctx, c.width, c.height, false)
  }
  if (cutCanvas) {
    const t = imageTransform(c.width, c.height)
    ctx.drawImage(cutCanvas, t.x, t.y, t.dw, t.dh)
  }
  return c
}

function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b ?? new Blob()), type, quality))
}

function fileBase(): string {
  return (imgName.value || '证件照').replace(/[\\/:*?"<>|]/g, '_')
}

async function exportPhoto() {
  if (!hasImage.value) return
  const transparent = bgMode.value === 'transparent' && exportFormat.value === 'png'
  const canvas = renderOutput(transparent)
  const type = exportFormat.value === 'png' ? 'image/png' : 'image/jpeg'
  const blob = await canvasToBlob(canvas, type, 0.92)
  downloadBlob(blob, `${fileBase()}-${sizePreset.value.label.split(' ')[0]}-${outW.value}x${outH.value}.${exportFormat.value}`)
  ElMessage.success(`已导出 ${outW.value} × ${outH.value}${exportFormat.value === 'png' ? ' 透明 PNG' : ' JPG'}`)
}

/** 排版打印:把多张证件照排到相纸上并加裁剪虚线 */
async function exportSheet() {
  if (!hasImage.value) return
  const paper = PAPERS.find((p) => p.key === paperKey.value) ?? PAPERS[1]
  const sheet = document.createElement('canvas')
  sheet.width = paper.w
  sheet.height = paper.h
  const ctx = sheet.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)

  const id = renderOutput(false)
  const margin = 24
  const gap = 16
  const cols = Math.max(1, Math.floor((paper.w - 2 * margin + gap) / (outW.value + gap)))
  const rows = Math.max(1, Math.floor((paper.h - 2 * margin + gap) / (outH.value + gap)))
  const totalW = cols * outW.value + (cols - 1) * gap
  const totalH = rows * outH.value + (rows - 1) * gap
  const startX = Math.round((paper.w - totalW) / 2)
  const startY = Math.round((paper.h - totalH) / 2)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(id, startX + c * (outW.value + gap), startY + r * (outH.value + gap))
    }
  }

  // 裁剪虚线
  ctx.save()
  ctx.strokeStyle = '#c9c9c9'
  ctx.lineWidth = 1
  ctx.setLineDash([6, 6])
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (outW.value + gap)
      const y = startY + r * (outH.value + gap)
      ctx.strokeRect(x + 0.5, y + 0.5, outW.value, outH.value)
    }
  }
  ctx.restore()

  const blob = await canvasToBlob(sheet, 'image/jpeg', 0.95)
  const count = cols * rows
  downloadBlob(blob, `排版-${paper.label.split(' ')[0]}-${count}张-${outW.value}x${outH.value}.jpg`)
  ElMessage.success(`已生成 ${paper.label} 排版,共 ${count} 张`)
}

/* ====================================================================== *
 * 生命周期 / 响应式
 * ====================================================================== */
function pickBg(color: string) {
  bgColor.value = color
  bgMode.value = 'solid'
  scheduleDraw()
}

watch([bgMode, bgColor, bgColor2, showGuides], () => scheduleDraw())
watch([outW, outH], () => {
  if (hasImage.value) updateFrame()
})
watch(sizeKey, () => {
  if (hasImage.value) updateFrame()
})

function onResize() {
  if (hasImage.value) updateFrame()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (rafDraw) cancelAnimationFrame(rafDraw)
  if (rafRebuild) cancelAnimationFrame(rafRebuild)
  undoStack.length = 0
})
</script>

<template>
  <ToolPage>
    <template #title>证件照制作</template>
    <template #desc>
      一键去背景、换底色,按一寸 / 二寸 / 签证照等标准尺寸裁剪导出,支持排版打印;全部在浏览器本地处理,照片不上传。
    </template>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onFile" />

    <!-- 未载入图片 -->
    <div v-if="!hasImage" class="drop" @click="pickFile" @dragover.prevent @drop.prevent="onDrop">
      <el-icon :size="38"><Picture /></el-icon>
      <p class="drop-title">点击或拖入照片开始制作</p>
      <span class="drop-sub">支持 JPG / PNG / WebP;建议使用正面免冠照,纯色背景效果最佳</span>
    </div>

    <!-- 编辑区 -->
    <div v-else class="editor" v-loading="loading">
      <!-- 左:预览 -->
      <section class="preview-col">
        <div ref="stageRef" class="stage">
          <canvas
            ref="previewCanvas"
            class="preview"
            :class="{ brushing: brushMode !== 'none' }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @wheel.prevent="onWheel"
          />
        </div>

        <div class="preview-tools">
          <el-button-group>
            <el-button size="small" :icon="ZoomOut" title="缩小" @click="zoomBy(-0.1)" />
            <el-button size="small" :icon="ZoomIn" title="放大" @click="zoomBy(0.1)" />
          </el-button-group>
          <span class="muted">{{ Math.round(zoom * 100) }}%</span>
          <el-button size="small" :icon="Aim" @click="resetView">复位</el-button>
          <el-checkbox v-model="showGuides" size="small">参考线</el-checkbox>
          <el-button size="small" :icon="Picture" @click="pickFile">换图</el-button>
        </div>

        <div class="brush-bar">
          <el-icon><Brush /></el-icon>
          <el-radio-group v-model="brushMode" size="small">
            <el-radio-button value="none">拖动</el-radio-button>
            <el-radio-button value="erase">擦除</el-radio-button>
            <el-radio-button value="restore">恢复</el-radio-button>
          </el-radio-group>
          <el-slider
            v-model="brushSize"
            :min="8"
            :max="160"
            :step="2"
            :disabled="brushMode === 'none'"
            style="width: 130px"
          />
          <el-button size="small" :icon="RefreshLeft" :disabled="!undoCount" @click="undo">撤销</el-button>
        </div>
      </section>

      <!-- 右:设置 -->
      <section class="settings">
        <div class="block">
          <div class="block-title">1. 去背景</div>
          <div class="row">
            <el-button type="primary" :icon="MagicStick" :loading="processing" @click="autoRemoveBg">
              一键去背景
            </el-button>
            <el-button :icon="Delete" :disabled="!hasCut" @click="resetCut">恢复原图</el-button>
          </div>
          <div class="row">
            <span class="lbl">容差</span>
            <el-slider v-model="tolerance" :min="4" :max="60" :step="1" style="flex: 1" />
            <span class="val">{{ tolerance }}</span>
          </div>
          <div class="row">
            <span class="lbl">边缘羽化</span>
            <el-slider v-model="feather" :min="0" :max="4" :step="1" style="flex: 1" />
            <span class="val">{{ feather }}px</span>
          </div>
          <p class="tip">
            自动识别四边颜色作为背景,适合证件照常见的纯色 / 简单背景。背景较复杂时,用上方「擦除 / 恢复」画笔修整。
          </p>
        </div>

        <div class="block">
          <div class="block-title">2. 背景底色</div>
          <div class="swatches">
            <button
              v-for="b in BG_PRESETS"
              :key="b.color"
              class="swatch"
              :class="{ on: bgMode === 'solid' && bgColor.toLowerCase() === b.color }"
              :style="{ background: b.color }"
              :title="b.label"
              @click="pickBg(b.color)"
            />
            <el-color-picker v-model="bgColor" size="small" />
          </div>
          <div class="row">
            <el-radio-group v-model="bgMode" size="small">
              <el-radio-button value="solid">纯色</el-radio-button>
              <el-radio-button value="gradient">渐变</el-radio-button>
              <el-radio-button value="transparent">透明</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="bgMode === 'gradient'" class="row">
            <el-color-picker v-model="bgColor" size="small" />
            <span class="muted">→</span>
            <el-color-picker v-model="bgColor2" size="small" />
          </div>
          <p v-if="bgMode === 'transparent'" class="tip">透明背景请导出 PNG;导出 JPG 时会自动填白底。</p>
        </div>

        <div class="block">
          <div class="block-title">3. 证件照尺寸</div>
          <el-select v-model="sizeKey" style="width: 100%">
            <el-option v-for="s in SIZE_PRESETS" :key="s.key" :label="s.label" :value="s.key" />
          </el-select>
          <div v-if="sizeKey === 'custom'" class="row">
            <el-input-number v-model="customW" :min="10" :max="200" size="small" controls-position="right" style="width: 110px" />
            <span class="muted">×</span>
            <el-input-number v-model="customH" :min="10" :max="200" size="small" controls-position="right" style="width: 110px" />
            <span class="muted">mm</span>
          </div>
          <div class="row">
            <span class="lbl">分辨率</span>
            <el-select v-model="dpi" size="small" style="width: 120px">
              <el-option :value="300" label="300 DPI" />
              <el-option :value="350" label="350 DPI" />
              <el-option :value="600" label="600 DPI" />
            </el-select>
            <span class="muted">输出 {{ outW }} × {{ outH }} px</span>
          </div>
          <p class="tip">一寸 = 25×35mm,二寸 = 35×49mm;常见证件照按 300 DPI 输出即可。</p>
        </div>

        <div class="block">
          <div class="block-title">4. 导出</div>
          <div class="row">
            <el-radio-group v-model="exportFormat" size="small">
              <el-radio-button value="jpg">JPG</el-radio-button>
              <el-radio-button value="png">PNG</el-radio-button>
            </el-radio-group>
            <el-button type="primary" :icon="Download" @click="exportPhoto">下载证件照</el-button>
          </div>
          <div class="row">
            <span class="lbl">排版打印</span>
            <el-select v-model="paperKey" size="small" style="width: 170px">
              <el-option v-for="p in PAPERS" :key="p.key" :label="p.label" :value="p.key" />
            </el-select>
            <el-button :icon="Download" @click="exportSheet">下载排版</el-button>
          </div>
          <p class="tip">排版会把多张证件照排到一张相纸上并加裁剪虚线,方便冲印后裁剪。</p>
        </div>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 14px;
  min-height: 260px;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 24px;
  transition: border-color 0.2s;
}
.drop:hover {
  border-color: var(--el-color-primary);
}
.drop-title {
  margin: 10px 0 4px;
  font-size: 15px;
  color: var(--el-text-color-regular);
}
.drop-sub {
  font-size: 12px;
}

.editor {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: wrap;
}

/* 预览 */
.preview-col {
  flex: 1 1 360px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stage {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 280px;
  padding: 14px;
  border-radius: 14px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--card-border);
}
.preview {
  display: block;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
  cursor: grab;
  touch-action: none;
  background: #fff;
}
.preview:active {
  cursor: grabbing;
}
.preview.brushing {
  cursor: crosshair;
}
.preview-tools,
.brush-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.brush-bar {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--card-border);
}

/* 设置面板 */
.settings {
  flex: 1 1 340px;
  min-width: 300px;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.block {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--el-bg-color);
}
.block-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.row:last-child {
  margin-bottom: 0;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
  width: 40px;
  text-align: right;
  flex: none;
}
.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tip {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

/* 色板 */
.swatches {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.swatch {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s, border-color 0.15s;
  padding: 0;
}
.swatch:hover {
  transform: scale(1.08);
}
.swatch.on {
  border-color: var(--el-color-primary);
}
</style>
