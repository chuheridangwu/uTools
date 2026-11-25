<script setup lang="ts">
/**
 * PDF 工具箱
 * 纯前端(不上传)PDF 处理:合并、页面整理(排序/旋转/删除/拆分)、水印与页码、阅读。
 *  - 页面解析与预览:pdfjs-dist(与 PDF 转图片共用带垫片的 worker)
 *  - 文档重写/绘制:pdf-lib
 *  - 多文件导出:utils/zip.ts(store 模式 ZIP)
 * 限制:加密 PDF 不支持(会提示);水印/页码用 canvas 转图片绘制,因此中文无需嵌入字体。
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { PDFDocument, degrees } from 'pdf-lib'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import ToolPage from '@/components/ToolPage.vue'
import { buildZip, downloadBlob } from '@/utils/zip'

/* ------------------------------ 通用状态 ------------------------------ */
type TabKey = 'merge' | 'organize' | 'stamp' | 'protect' | 'read'
const activeTab = ref<TabKey>('merge')
const busy = ref(false)
const busyText = ref('')

/** 文件选择框引用:按钮 @click 主动触发(不能用 <label> 包 <el-button>,button 是交互元素,label 不会转发点击) */
const mergeInput = ref<HTMLInputElement>()
const organizeInput = ref<HTMLInputElement>()
const stampInput = ref<HTMLInputElement>()
const protectInput = ref<HTMLInputElement>()
const readInput = ref<HTMLInputElement>()

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

/* ------------------------------ pdf.js 懒加载 ------------------------------ */
let pdfjs: typeof import('pdfjs-dist') | null = null
async function loadPdfjs() {
  if (pdfjs) return pdfjs
  const [{ installPdfPolyfills }, lib] = await Promise.all([
    import('@/utils/pdfPolyfills'),
    import('pdfjs-dist'),
  ])
  installPdfPolyfills()
  try {
    // 用 ?worker&url 取得「带垫片的自定义 worker」产物地址,再以 workerSrc 交给 pdf.js 自行创建。
    // 相比手动 new Worker + GlobalWorkerOptions.workerPort,workerSrc 由 pdf.js 掌控 worker
    // 生命周期与消息通道,配合 Vite 的模块 worker 产物更稳(实测不会出现 worker 只回 ready、
    // 后续 GetDocRequest 无响应而卡死的情况)。
    const customWorkerUrl = (await import('../pdfWorker.ts?worker&url')).default
    lib.GlobalWorkerOptions.workerSrc = customWorkerUrl
  } catch (e) {
    console.warn('[pdf-toolkit] 自定义 worker 不可用,退回官方 worker:', e)
    const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = workerUrl.default
  }
  pdfjs = lib
  return lib
}

/* ====================================================================== *
 * 一、合并 PDF
 * ====================================================================== */
interface MergeItem {
  id: string
  name: string
  size: number
  bytes: Uint8Array
  pages: number
}
const mergeList = ref<MergeItem[]>([])
let mergeSeq = 0

async function onMergePick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // FileList 是活引用,先快照再清空
  if (!files.length) return
  busy.value = true
  try {
    const lib = await loadPdfjs()
    for (const f of files) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const doc = await lib.getDocument({ data: bytes.slice() }).promise
        mergeList.value.push({ id: `m${++mergeSeq}`, name: f.name, size: f.size, bytes, pages: doc.numPages })
        void doc.cleanup()
      } catch {
        ElMessage.error(`「${f.name}」解析失败(可能已加密),已跳过`)
      }
    }
  } finally {
    busy.value = false
  }
}

function moveMerge(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= mergeList.value.length) return
  const list = mergeList.value
  ;[list[i], list[j]] = [list[j], list[i]]
}

function removeMerge(i: number) {
  mergeList.value.splice(i, 1)
}

const mergeTotalPages = computed(() => mergeList.value.reduce((n, m) => n + m.pages, 0))

async function doMerge() {
  if (mergeList.value.length < 2) {
    ElMessage.warning('至少选择 2 个 PDF 才能合并')
    return
  }
  busy.value = true
  busyText.value = '正在合并…'
  try {
    const out = await PDFDocument.create()
    for (const item of mergeList.value) {
      const src = await PDFDocument.load(item.bytes, { ignoreEncryption: true })
      const copied = await out.copyPages(src, src.getPageIndices())
      copied.forEach((p) => out.addPage(p))
    }
    const bytes = await out.save()
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `合并-${mergeList.value.length}个文件.pdf`)
    ElMessage.success(`已合并 ${mergeList.value.length} 个文件,共 ${mergeTotalPages.value} 页`)
  } catch (err) {
    ElMessage.error(`合并失败: ${(err as Error).message}`)
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/* ====================================================================== *
 * 二/三/四:工作 PDF(单文件) —— 页面整理 / 水印页码 / 阅读 共用
 * ====================================================================== */
interface WorkPage {
  index: number
  thumb: string
  rotation: number
  selected: boolean
}
const workFile = ref<File | null>(null)
const workBytes = ref<Uint8Array | null>(null)
const workPages = ref<WorkPage[]>([])
const workDoc = shallowRef<PDFDocumentProxy | null>(null)
const thumbProgress = ref('')

async function onWorkPick(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  // 解密模式:加密 Tab 里选择 .enc 文件时,不解析为 PDF,只登记文件
  const isEnc = /\.enc$/i.test(f.name)
  if (isEnc) {
    workFile.value = f
    workBytes.value = null
    workPages.value = []
    workDoc.value?.cleanup()
    workDoc.value = null
    protectMode.value = 'decrypt'
    ElMessage.info('已选择 .enc 文件,请输入密码解密')
    return
  }
  busy.value = true
  busyText.value = '正在解析 PDF…'
  workPages.value = []
  workFile.value = f
  workBytes.value = null
  workDoc.value?.cleanup()
  workDoc.value = null
  try {
    const lib = await loadPdfjs()
    const bytes = new Uint8Array(await f.arrayBuffer())
    const doc = await lib.getDocument({ data: bytes.slice() }).promise
    workDoc.value = doc
    workBytes.value = bytes
    await renderThumbs(doc)
    viewerPage.value = 1
    viewerScale.value = 1
    void renderViewer()
  } catch (err) {
    ElMessage.error(`PDF 解析失败(可能已加密): ${(err as Error).message}`)
    workFile.value = null
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/** 渲染缩略图(页面整理用):宽度约 150px,逐页串行,避免占满内存 */
async function renderThumbs(doc: PDFDocumentProxy) {
  const list: WorkPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    thumbProgress.value = `正在生成缩略图 ${i}/${doc.numPages}…`
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = 150 / base.width
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(vp.width))
    canvas.height = Math.max(1, Math.floor(vp.height))
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, canvas }).promise
    list.push({ index: i - 1, thumb: canvas.toDataURL('image/jpeg', 0.7), rotation: 0, selected: true })
  }
  workPages.value = list
  thumbProgress.value = ''
}

const selectedCount = computed(() => workPages.value.filter((p) => p.selected).length)

function rotatePage(p: WorkPage, delta: number) {
  p.rotation = (p.rotation + delta + 360) % 360
}

function movePage(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= workPages.value.length) return
  const list = workPages.value
  ;[list[i], list[j]] = [list[j], list[i]]
}

function removePage(i: number) {
  workPages.value.splice(i, 1)
}

function selectAll(v: boolean) {
  workPages.value.forEach((p) => (p.selected = v))
}

/** 用 pdf-lib 按当前顺序/旋转/选中状态导出单文件 */
async function exportOrganized() {
  if (!workBytes.value) return
  const kept = workPages.value.filter((p) => p.selected)
  if (!kept.length) {
    ElMessage.warning('请至少保留 1 页')
    return
  }
  busy.value = true
  busyText.value = '正在导出…'
  try {
    const bytes = await buildOrganizedBytes(kept)
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), baseName() + '-整理.pdf')
    ElMessage.success(`已导出 ${kept.length} 页`)
  } catch (err) {
    ElMessage.error(`导出失败: ${(err as Error).message}`)
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/** 拆分:每个保留页单独一个 PDF,打包 ZIP */
async function exportSplitZip() {
  if (!workBytes.value) return
  const kept = workPages.value.filter((p) => p.selected)
  if (!kept.length) {
    ElMessage.warning('请至少保留 1 页')
    return
  }
  busy.value = true
  busyText.value = '正在拆分…'
  try {
    const entries: Array<{ name: string; data: Uint8Array }> = []
    for (let i = 0; i < kept.length; i++) {
      const bytes = await buildOrganizedBytes([kept[i]])
      entries.push({ name: `${baseName()}-第${i + 1}页.pdf`, data: bytes })
    }
    downloadBlob(buildZip(entries), `${baseName()}-拆分.zip`)
    ElMessage.success(`已拆分为 ${entries.length} 个 PDF`)
  } catch (err) {
    ElMessage.error(`拆分失败: ${(err as Error).message}`)
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/** 按页面清单生成新 PDF(应用旋转) */
async function buildOrganizedBytes(kept: WorkPage[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(workBytes.value as Uint8Array, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, kept.map((p) => p.index))
  copied.forEach((page, i) => {
    const extra = kept[i].rotation
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360))
    out.addPage(page)
  })
  return out.save()
}

const baseName = () => (workFile.value?.name ?? 'document').replace(/\.pdf$/i, '')

/* ------------------------------ 水印 / 页码 ------------------------------ */
const wm = ref({
  text: '内部资料',
  fontSize: 42,
  color: '#ff0000',
  opacity: 0.18,
  rotate: 30,
  tile: true,
  spacing: 260,
})
const pn = ref({
  enabled: false,
  position: 'bottom-center' as 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left',
  start: 1,
  format: 'x' as 'x' | 'x/y' | '第x页' | '第x页/共y页',
  fontSize: 11,
  color: '#333333',
})

const PN_POSITIONS = [
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上角' },
  { value: 'top-left', label: '左上角' },
] as const

/** 把文字画到透明 canvas(可整体旋转),返回 base64 PNG 与显示尺寸 */
function textToPng(text: string, fontSize: number, color: string, rotateDeg = 0) {
  const dpr = 2
  const pad = 8 * dpr
  const probe = document.createElement('canvas').getContext('2d')!
  const font = `${fontSize * dpr}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
  probe.font = font
  const tw = Math.ceil(probe.measureText(text).width) + pad * 2
  const th = Math.ceil(fontSize * dpr * 1.5) + pad * 2
  const rad = (rotateDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const cw = Math.ceil(tw * cos + th * sin)
  const ch = Math.ceil(tw * sin + th * cos)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rad)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  return { base64: canvas.toDataURL('image/png').split(',')[1], w: cw / dpr, h: ch / dpr }
}

/** 水印图片在页面坐标中的尺寸 */
let wmImgSize = { w: 0, h: 0 }

async function applyStamp() {
  if (!workBytes.value) return
  busy.value = true
  busyText.value = '正在写入水印/页码…'
  try {
    const doc = await PDFDocument.load(workBytes.value, { ignoreEncryption: true })
    const pages = doc.getPages()
    const total = pages.length

    // 水印图片只生成一次
    let wmImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
    if (wm.value.text.trim()) {
      const png = textToPng(wm.value.text, wm.value.fontSize, wm.value.color, wm.value.rotate)
      wmImg = await doc.embedPng(png.base64)
      wmImgSize = { w: png.w, h: png.h }
    }

    for (let i = 0; i < total; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()

      // 水印:平铺或居中单点
      if (wmImg) {
        const w = wmImgSize.w
        const h = wmImgSize.h
        if (wm.value.tile) {
          const stepX = Math.max(wm.value.spacing, w * 1.2)
          const stepY = Math.max(wm.value.spacing, h * 1.2)
          for (let y = -h; y < height + h; y += stepY) {
            for (let x = -w; x < width + w; x += stepX) {
              page.drawImage(wmImg, { x: x + w / 2, y: y + h / 2, width: w, height: h, opacity: wm.value.opacity })
            }
          }
        } else {
          page.drawImage(wmImg, { x: width / 2 - w / 2, y: height / 2 - h / 2, width: w, height: h, opacity: wm.value.opacity })
        }
      }

      // 页码
      if (pn.value.enabled) {
        const n = pn.value.start + i
        const label = formatPageNo(n, total, pn.value.format)
        const png = textToPng(label, pn.value.fontSize, pn.value.color, 0)
        const img = await doc.embedPng(png.base64)
        const margin = 24
        const pos = pn.value.position
        const x = pos.endsWith('center') ? width / 2 - png.w / 2 : pos.endsWith('right') ? width - png.w - margin : margin
        const y = pos.startsWith('bottom') ? margin : height - png.h - margin
        page.drawImage(img, { x, y, width: png.w, height: png.h, opacity: 1 })
      }
    }

    const bytes = await doc.save()
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `${baseName()}-水印页码.pdf`)
    ElMessage.success('已生成新 PDF')
  } catch (err) {
    ElMessage.error(`处理失败: ${(err as Error).message}`)
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/** 水印图片在页面坐标中的尺寸 */

function formatPageNo(n: number, total: number, fmt: string): string {
  if (fmt === 'x/y') return `${n} / ${total}`
  if (fmt === '第x页') return `第 ${n} 页`
  if (fmt === '第x页/共y页') return `第 ${n} 页 / 共 ${total} 页`
  return String(n)
}

/* ====================================================================== *
 * 四、压缩(逐页重采样,可灰度)/ AES-GCM 加密(.enc)
 * ====================================================================== */
const compressCfg = ref({
  dpi: 120,          // 渲染 DPI(原稿常见 72-150;120 足够屏幕阅读)
  quality: 0.75,     // JPEG 质量
  grayscale: false,  // 转灰度(文本类文档体积再降一半)
})
const compressStats = ref<{ before: number; after: number } | null>(null)

async function compressPdf() {
  if (!workBytes.value && !workFile.value) {
    ElMessage.warning('请先选择 PDF')
    return
  }
  busy.value = true
  busyText.value = '正在压缩…'
  try {
    // 逐页用 pdf.js 渲染成 canvas,再重建文档
    const pj = await loadPdfjs()
    const src = workBytes.value!
    const doc = await pj.getDocument({ data: src.slice(0) }).promise
    const out = await PDFDocument.create()
    const dpiScale = compressCfg.value.dpi / 72
    for (let i = 1; i <= doc.numPages; i++) {
      busyText.value = `正在压缩 ${i}/${doc.numPages} 页…`
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: dpiScale })
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.floor(vp.width))
      c.height = Math.max(1, Math.floor(vp.height))
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: ctx, viewport: vp, background: '#ffffff' } as Parameters<typeof page.render>[0]).promise
      if (compressCfg.value.grayscale) toGrayscale(ctx, c.width, c.height)
      const jpeg = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b ?? new Blob()), 'image/jpeg', compressCfg.value.quality))
      const png = new Uint8Array(await jpeg.arrayBuffer())
      const img = await out.embedJpg(png)
      const origVp = page.getViewport({ scale: 1 })
      const p = out.addPage([origVp.width, origVp.height])
      p.drawImage(img, { x: 0, y: 0, width: origVp.width, height: origVp.height })
    }
    const bytes = await out.save({ useObjectStreams: true })
    const after = bytes.length
    const before = workBytes.value!.length
    compressStats.value = { before, after }
    const ext = compressCfg.value.grayscale ? '-压缩灰度' : '-压缩'
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), baseName() + ext + '.pdf')
    const pct = Math.max(0, Math.round((1 - after / before) * 100))
    ElMessage.success(`压缩完成:${fmtSize(before)} → ${fmtSize(after)}(省 ${pct}%)`)
    try { (doc as unknown as { destroy?: () => void }).destroy?.() } catch { /* 旧版本可能没有 */ }
  } catch (err) {
    ElMessage.error(`压缩失败: ${(err as Error).message}`)
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/** 就地灰度化 */
function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h)
  const px = d.data
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    px[i] = px[i + 1] = px[i + 2] = g
  }
  ctx.putImageData(d, 0, 0)
}

/* ====================================================================== *
 * 五、加密 / 解密(.enc,AES-GCM 256)
 * ====================================================================== */
const protectPwd = ref('')
const protectPwd2 = ref('')
const protectMode = ref<'encrypt' | 'decrypt'>('encrypt')

/** 文件 → AES-GCM 加密的 .enc(用户自留密码,解密也用本工具;非 PDF 权限密码) */
async function deriveKey(pwd: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function protectRun() {
  if (!workFile.value) {
    ElMessage.warning('请先选择 PDF')
    return
  }
  if (protectMode.value === 'encrypt') {
    if (protectPwd.value.length < 6) {
      ElMessage.warning('密码至少 6 位')
      return
    }
    if (protectPwd.value !== protectPwd2.value) {
      ElMessage.warning('两次输入的密码不一致')
      return
    }
    busy.value = true
    busyText.value = '正在加密…'
    try {
      const plain = new Uint8Array(await workFile.value.arrayBuffer())
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await deriveKey(protectPwd.value, salt)
      const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, plain as unknown as BufferSource))
      // 文件结构:magic(4) + salt(16) + iv(12) + cipher
      const magic = new TextEncoder().encode('UPDF')
      const payload = new Uint8Array(magic.length + salt.length + iv.length + enc.length)
      let o = 0
      payload.set(magic, o); o += magic.length
      payload.set(salt, o); o += salt.length
      payload.set(iv, o); o += iv.length
      payload.set(enc, o)
      downloadBlob(new Blob([payload as unknown as BlobPart], { type: 'application/octet-stream' }), baseName() + '.enc')
      ElMessage.success('已加密;请妥善保存密码,忘记密码无法恢复')
    } catch (e) {
      ElMessage.error(`加密失败: ${(e as Error).message}`)
    } finally {
      busy.value = false
      busyText.value = ''
    }
    return
  }
  // 解密
  if (!protectPwd.value) {
    ElMessage.warning('请输入密码')
    return
  }
  busy.value = true
  busyText.value = '正在解密…'
  try {
    const data = new Uint8Array(await workFile.value.arrayBuffer())
    const magic = new TextDecoder().decode(data.slice(0, 4))
    if (magic !== 'UPDF') throw new Error('不是本工具加密的 .enc 文件')
    const salt = data.slice(4, 20)
    const iv = data.slice(20, 32)
    const cipher = data.slice(32)
    const key = await deriveKey(protectPwd.value, salt)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, cipher as unknown as BufferSource)
    downloadBlob(new Blob([plain], { type: 'application/pdf' }), baseName().replace(/\.enc$/i, '') + '-解密.pdf')
    ElMessage.success('解密成功')
  } catch {
    ElMessage.error('解密失败:密码错误或文件已损坏')
  } finally {
    busy.value = false
    busyText.value = ''
  }
}

/* ====================================================================== *
 * 四、阅读器
 * ====================================================================== */
const viewerCanvas = ref<HTMLCanvasElement>()
const viewerPage = ref(1)
const viewerScale = ref(1)
const viewerRendering = ref(false)
let renderTask: RenderTask | null = null
let lastRenderedPage: PDFPageProxy | null = null

async function renderViewer() {
  const doc = workDoc.value
  const canvas = viewerCanvas.value
  if (!doc || !canvas) return
  try {
    renderTask?.cancel()
  } catch {
    /* 取消上一帧渲染 */
  }
  viewerRendering.value = true
  try {
    const page = await doc.getPage(viewerPage.value)
    lastRenderedPage = page
    const vp = page.getViewport({ scale: viewerScale.value })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(vp.width * dpr)
    canvas.height = Math.floor(vp.height * dpr)
    canvas.style.width = `${Math.floor(vp.width)}px`
    canvas.style.height = `${Math.floor(vp.height)}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderTask = page.render({ canvasContext: ctx, viewport: vp, canvas })
    await renderTask.promise
  } catch (e) {
    if ((e as Error)?.name !== 'RenderingCancelledException') {
      ElMessage.error(`渲染失败: ${(e as Error).message}`)
    }
  } finally {
    viewerRendering.value = false
  }
}

function gotoPage(delta: number) {
  const max = workDoc.value?.numPages ?? 1
  const next = Math.min(max, Math.max(1, viewerPage.value + delta))
  if (next === viewerPage.value) return
  viewerPage.value = next
  void renderViewer()
}

function onPageJump(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  const max = workDoc.value?.numPages ?? 1
  if (!Number.isFinite(v)) return
  viewerPage.value = Math.min(max, Math.max(1, Math.round(v)))
  void renderViewer()
}

function zoom(delta: number) {
  viewerScale.value = Math.min(4, Math.max(0.3, Math.round((viewerScale.value + delta) * 10) / 10))
  void renderViewer()
}

async function fitWidth() {
  if (!lastRenderedPage) return
  const base = lastRenderedPage.getViewport({ scale: 1 })
  const w = (document.querySelector('.viewer-stage') as HTMLElement | null)?.clientWidth ?? 800
  viewerScale.value = Math.max(0.3, Math.min(4, (w - 48) / base.width))
  await renderViewer()
}

onBeforeUnmount(() => {
  try {
    renderTask?.cancel()
  } catch {
    /* noop */
  }
  void workDoc.value?.cleanup()
})
</script>

<template>
  <ToolPage>
    <template #title>PDF 工具箱</template>
    <template #desc>合并、页面整理(排序/旋转/删除/拆分)、水印与页码、阅读;全部在浏览器本地完成,文件不上传。</template>

    <el-tabs v-model="activeTab" class="tabs">
      <!-- ───────────── 合并 ───────────── -->
      <el-tab-pane label="合并 PDF" name="merge">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>选择多个 PDF(可拖动顺序,合并后按列表顺序拼接)</span>
              <span class="muted">{{ mergeList.length }} 个文件 · {{ mergeTotalPages }} 页</span>
            </div>
          </template>

          <input ref="mergeInput" type="file" accept=".pdf" multiple hidden @change="onMergePick" />
          <el-button type="primary" :loading="busy" @click="mergeInput?.click()">选择 PDF 文件</el-button>

          <div v-if="mergeList.length" class="merge-list">
            <div v-for="(m, i) in mergeList" :key="m.id" class="merge-item">
              <span class="idx">{{ i + 1 }}</span>
              <div class="merge-info">
                <div class="merge-name">{{ m.name }}</div>
                <div class="muted">{{ m.pages }} 页 · {{ fmtSize(m.size) }}</div>
              </div>
              <el-button size="small" :disabled="i === 0" @click="moveMerge(i, -1)">上移</el-button>
              <el-button size="small" :disabled="i === mergeList.length - 1" @click="moveMerge(i, 1)">下移</el-button>
              <el-button size="small" type="danger" plain @click="removeMerge(i)">移除</el-button>
            </div>
            <div class="actions">
              <el-button type="primary" :loading="busy" @click="doMerge">合并并下载</el-button>
              <el-button @click="mergeList = []">清空列表</el-button>
            </div>
          </div>
          <el-empty v-else description="还没有选择文件" :image-size="80" />
        </el-card>
      </el-tab-pane>

      <!-- ───────────── 页面整理 ───────────── -->
      <el-tab-pane label="页面整理 / 拆分" name="organize">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>选择一个 PDF:勾选要保留的页,可旋转/调整顺序</span>
              <span v-if="workFile" class="muted">{{ workFile.name }} · {{ workPages.length }} 页</span>
            </div>
          </template>
          <div class="work-pick">
            <input ref="organizeInput" type="file" accept=".pdf" hidden @change="onWorkPick" />
            <el-button type="primary" :loading="busy" @click="organizeInput?.click()">选择 PDF</el-button>
            <template v-if="workPages.length">
              <el-button size="small" @click="selectAll(true)">全选</el-button>
              <el-button size="small" @click="selectAll(false)">全不选</el-button>
              <span class="muted">已选 {{ selectedCount }} / {{ workPages.length }} 页</span>
            </template>
          </div>

          <div v-if="workPages.length" class="page-grid">
            <div v-for="(p, i) in workPages" :key="p.thumb.slice(-24) + i" class="page-card" :class="{ off: !p.selected }">
              <el-checkbox v-model="p.selected" class="page-check" />
              <img :src="p.thumb" class="page-thumb" :style="{ transform: `rotate(${p.rotation}deg)` }" alt="" />
              <div class="page-ops">
                <el-button size="small" text @click="rotatePage(p, -90)" title="左转 90°">↺</el-button>
                <el-button size="small" text @click="rotatePage(p, 90)" title="右转 90°">↻</el-button>
                <el-button size="small" text :disabled="i === 0" @click="movePage(i, -1)" title="上移">↑</el-button>
                <el-button size="small" text :disabled="i === workPages.length - 1" @click="movePage(i, 1)" title="下移">↓</el-button>
                <el-button size="small" text type="danger" @click="removePage(i)" title="移除">✕</el-button>
              </div>
              <div class="page-no">第 {{ i + 1 }} 页</div>
            </div>
          </div>
          <p v-if="thumbProgress" class="muted">{{ thumbProgress }}</p>

          <div v-if="workPages.length" class="actions">
            <el-button type="primary" :loading="busy" @click="exportOrganized">导出整理后的 PDF</el-button>
            <el-button :loading="busy" @click="exportSplitZip">拆分:每页单独导出 ZIP</el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ───────────── 水印 / 页码 ───────────── -->
      <el-tab-pane label="水印 / 页码" name="stamp">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>给整个 PDF 加文字水印与页码(中文用 canvas 绘制,无需字体文件)</span>
              <span v-if="workFile" class="muted">{{ workFile.name }}</span>
            </div>
          </template>
          <div class="work-pick">
            <input ref="stampInput" type="file" accept=".pdf" hidden @change="onWorkPick" />
            <el-button type="primary" :loading="busy" @click="stampInput?.click()">选择 PDF</el-button>
          </div>

          <el-form label-width="96px" class="stamp-form" :disabled="!workBytes">
            <el-divider content-position="left">水印</el-divider>
            <el-form-item label="水印文字">
              <el-input v-model="wm.text" placeholder="留空则不加水印" style="max-width: 320px" />
            </el-form-item>
            <el-form-item label="字号 / 颜色">
              <el-input-number v-model="wm.fontSize" :min="10" :max="200" />
              <el-color-picker v-model="wm.color" class="ml8" />
            </el-form-item>
            <el-form-item label="透明度 / 旋转">
              <el-slider v-model="wm.opacity" :min="0.02" :max="1" :step="0.02" style="width: 200px" />
              <el-input-number v-model="wm.rotate" :min="-90" :max="90" :step="15" class="ml8" />
            </el-form-item>
            <el-form-item label="平铺">
              <el-switch v-model="wm.tile" />
              <span class="muted ml8">关闭则居中单个水印</span>
            </el-form-item>
            <el-form-item v-if="wm.tile" label="平铺间距">
              <el-input-number v-model="wm.spacing" :min="80" :max="800" :step="20" />
            </el-form-item>

            <el-divider content-position="left">页码</el-divider>
            <el-form-item label="启用页码">
              <el-switch v-model="pn.enabled" />
            </el-form-item>
            <template v-if="pn.enabled">
              <el-form-item label="位置">
                <el-select v-model="pn.position" style="width: 150px">
                  <el-option v-for="o in PN_POSITIONS" :key="o.value" :value="o.value" :label="o.label" />
                </el-select>
              </el-form-item>
              <el-form-item label="格式">
                <el-select v-model="pn.format" style="width: 180px">
                  <el-option value="x" label="1" />
                  <el-option value="x/y" label="1 / 10" />
                  <el-option value="第x页" label="第 1 页" />
                  <el-option value="第x页/共y页" label="第 1 页 / 共 10 页" />
                </el-select>
              </el-form-item>
              <el-form-item label="起始页号 / 字号">
                <el-input-number v-model="pn.start" :min="0" :max="9999" />
                <el-input-number v-model="pn.fontSize" :min="8" :max="24" class="ml8" />
                <el-color-picker v-model="pn.color" class="ml8" />
              </el-form-item>
            </template>
          </el-form>

          <div v-if="workBytes" class="actions">
            <el-button type="primary" :loading="busy" @click="applyStamp">生成并下载</el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ───────────── 加密 / 解密 + 压缩 ───────────── -->
      <el-tab-pane label="压缩 / 加密" name="protect">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>压缩(逐页重采样)与 AES-GCM 加密;全部本地完成</span>
              <span v-if="workFile" class="muted">{{ workFile.name }} · {{ fmtSize(workFile.size) }}</span>
            </div>
          </template>
          <div class="work-pick">
            <input ref="protectInput" type="file" accept=".pdf,.enc" hidden @change="onWorkPick" />
            <el-button type="primary" :loading="busy" @click="protectInput?.click()">选择 PDF / .enc</el-button>
          </div>

          <el-form label-width="100px" class="stamp-form">
            <el-divider content-position="left">压缩(栅格化重建,文字不可再选中)</el-divider>
            <el-form-item label="渲染 DPI">
              <el-select v-model="compressCfg.dpi" style="width: 140px">
                <el-option :value="96" label="96(更小,较模糊)" />
                <el-option :value="120" label="120(推荐)" />
                <el-option :value="150" label="150(较清晰)" />
                <el-option :value="200" label="200(接近原图)" />
              </el-select>
            </el-form-item>
            <el-form-item label="JPEG 质量">
              <el-slider v-model="compressCfg.quality" :min="0.3" :max="0.95" :step="0.05" style="width: 220px" />
              <span class="muted ml8">{{ Math.round(compressCfg.quality * 100) }}%</span>
            </el-form-item>
            <el-form-item label="灰度化">
              <el-switch v-model="compressCfg.grayscale" />
              <span class="muted ml8">文本扫描件再省约一半体积</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="busy" :disabled="!workFile" @click="compressPdf">开始压缩</el-button>
              <span v-if="compressStats" class="muted ml8">
                {{ fmtSize(compressStats.before) }} → {{ fmtSize(compressStats.after) }}
              </span>
            </el-form-item>

            <el-divider content-position="left">加密 / 解密(AES-GCM 256,密码自留)</el-divider>
            <el-form-item label="模式">
              <el-radio-group v-model="protectMode" size="small">
                <el-radio-button value="encrypt">加密(PDF → .enc)</el-radio-button>
                <el-radio-button value="decrypt">解密(.enc → PDF)</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="protectPwd" type="password" show-password style="max-width: 260px" placeholder="至少 6 位" />
            </el-form-item>
            <el-form-item v-if="protectMode === 'encrypt'" label="确认密码">
              <el-input v-model="protectPwd2" type="password" show-password style="max-width: 260px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="busy" :disabled="!workFile" @click="protectRun">
                {{ protectMode === 'encrypt' ? '加密并下载' : '解密并下载' }}
              </el-button>
            </el-form-item>
            <p class="tip" style="margin: 0; color: var(--el-text-color-placeholder); font-size: 12px">
              说明:这里的加密是用 AES-256-GCM 把整个 PDF 打包成 .enc 文件(需回本工具解密),不是 PDF 阅读器的口令保护——pdf-lib 暂不支持写标准 PDF 权限密码。
            </p>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- ───────────── 阅读 ───────────── -->
      <el-tab-pane label="阅读" name="read">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>本地阅读(滚轮滚动,可缩放)</span>
              <span v-if="workFile" class="muted">{{ workFile.name }}</span>
            </div>
          </template>
          <div class="work-pick">
            <input ref="readInput" type="file" accept=".pdf" hidden @change="onWorkPick" />
            <el-button type="primary" :loading="busy" @click="readInput?.click()">选择 PDF</el-button>
            <template v-if="workDoc">
              <el-button size="small" :disabled="viewerPage <= 1" @click="gotoPage(-1)">上一页</el-button>
              <span class="muted">
                <input class="page-input" type="number" :value="viewerPage" @change="onPageJump" />
                / {{ workDoc.numPages }}
              </span>
              <el-button size="small" :disabled="viewerPage >= workDoc.numPages" @click="gotoPage(1)">下一页</el-button>
              <el-button size="small" @click="zoom(-0.2)">缩小</el-button>
              <span class="muted">{{ Math.round(viewerScale * 100) }}%</span>
              <el-button size="small" @click="zoom(0.2)">放大</el-button>
              <el-button size="small" @click="fitWidth">适应宽度</el-button>
            </template>
          </div>

          <div v-if="workDoc" class="viewer-stage" v-loading="viewerRendering">
            <canvas ref="viewerCanvas" class="viewer-canvas" />
          </div>
          <el-empty v-else description="选择一个 PDF 开始阅读" :image-size="80" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 全局处理遮罩 -->
    <div v-if="busy && busyText" class="busy-mask" v-loading="true" :element-loading-text="busyText" />
  </ToolPage>
</template>

<style scoped>
.tabs { margin-top: -6px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.ml8 { margin-left: 8px; }
.actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
.work-pick { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }

/* 合并列表 */
.merge-list { margin-top: 14px; }
.merge-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
  background: var(--el-fill-color-blank);
}
.idx {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--el-color-primary); color: #fff; font-size: 12px; flex: none;
}
.merge-info { flex: 1; min-width: 0; }
.merge-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 页面网格 */
.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.page-card {
  position: relative;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
  background: var(--el-fill-color-blank);
  text-align: center;
}
.page-card.off { opacity: 0.45; }
.page-check { position: absolute; top: 6px; left: 6px; z-index: 1; }
.page-thumb {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  transition: transform 0.2s;
  background: var(--el-fill-color-lighter);
}
.page-ops { display: flex; justify-content: center; gap: 0; margin-top: 4px; }
.page-ops :deep(.el-button) { padding: 4px 6px; font-size: 13px; }
.page-no { font-size: 12px; color: var(--el-text-color-secondary); }

/* 表单 */
.stamp-form { margin-top: 4px; }

/* 阅读器 */
.viewer-stage {
  margin-top: 8px;
  max-height: clamp(360px, calc(100vh - 360px), 2000px);
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.viewer-canvas {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  max-width: 100%;
}
.page-input {
  width: 56px;
  padding: 2px 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  text-align: center;
  font-size: 13px;
  background: var(--el-fill-color-blank);
  color: inherit;
}

/* 全局处理遮罩 */
.busy-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.25);
}
</style>
