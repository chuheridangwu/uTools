<script setup lang="ts">
/**
 * PDF 转图片(P1)
 * 逐页渲染:pdfjs-dist(mozilla)本地解析 → canvas → PNG/JPG blob;不上传服务器。
 * 多页 PDF 每页一张;可选拼接成竖向 / 横向长图(用已生成 blob 逐页重绘,内存友好)。
 * 多文件导出走 utils/zip.ts(纯前端 store ZIP,复用「在线解压」实现)。
 * 限制:加密 PDF 不支持;拼接总尺寸超过浏览器 canvas 上限时提示降低倍率/减少页数。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Picture, RefreshLeft } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { buildZip, downloadBlob } from '@/utils/zip'

/* ------------------------------ 状态 ------------------------------ */
const fileInput = ref<HTMLInputElement>()
interface PageImg {
  page: number
  blob: Blob
  blobUrl: string
  thumbUrl: string
  w: number
  h: number
}
const fileName = ref('')
const fileSize = ref(0)
const numPages = ref(0)
const pages = ref<PageImg[]>([])
const busy = ref(false)
const progress = ref(0)
const progressText = ref('')
const stitchMode = ref<'none' | 'v' | 'h'>('none')
const stitchUrl = ref('')
const stitchSize = ref<{ w: number; h: number } | null>(null)
const stitchBusy = ref(false)
const dragging = ref(false)
/** 当前文件引用(改设置后重新转换用) */
let lastFile: File | null = null

/** 输出设置 */
const fmt = ref<'png' | 'jpg'>('png')
const jpgQuality = ref(0.9)
const scale = ref(2)
const rangeText = ref('')

const hasData = computed(() => pages.value.length > 0)
const totalBytes = computed(() => pages.value.reduce((n, p) => n + p.blob.size, 0))

/* ------------------------------ pdf.js 懒加载 ------------------------------ */
let pdfjs: typeof import('pdfjs-dist') | null = null
async function loadPdfjs() {
  if (pdfjs) return pdfjs
  const [lib, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  lib.GlobalWorkerOptions.workerSrc = workerUrl.default
  pdfjs = lib
  return lib
}

/* ------------------------------ 选择文件 ------------------------------ */
function onPick() { fileInput.value?.click() }

function onFileChange(e: Event) {
  // FileList 是活引用:先快照再清空 input(踩坑 14)
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  ;(e.target as HTMLInputElement).value = ''
  if (files[0]) void loadPdf(files[0])
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) void loadPdf(f)
}

async function loadPdf(file: File, isNew = true) {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    ElMessage.warning('请选择 PDF 文件')
    return
  }
  reset()
  lastFile = file
  fileName.value = file.name.replace(/\.pdf$/i, '')
  fileSize.value = file.size
  busy.value = true
  progressText.value = '正在解析 PDF…'
  try {
    const lib = await loadPdfjs()
    const buf = await file.arrayBuffer()
    const task = lib.getDocument({ data: buf })
    const doc = await task.promise
    numPages.value = doc.numPages
    busy.value = false
    // 新文件清空范围;按当前设置重新转换时保留
    if (isNew) rangeText.value = ''
    // 自动开始全部转换
    await convert(doc)
    void task.destroy()
  } catch (e) {
    busy.value = false
    const name = (e as { name?: string }).name
    if (name === 'PasswordException') {
      ElMessage.error('该 PDF 有密码保护,暂不支持加密文件')
    } else {
      console.warn('[pdf2img]', e)
      ElMessage.error('PDF 解析失败,文件可能已损坏')
    }
    numPages.value = 0
  }
}

/** 解析页码范围表达式,如 "1-3,5,8";空 = 全部;支持开区间 "4-" */
function parseRange(text: string, total: number): number[] {
  const t = text.trim()
  if (!t) return Array.from({ length: total }, (_, i) => i + 1)
  const out = new Set<number>()
  for (const part of t.split(/[,，]/)) {
    const m = part.trim().match(/^(\d*)(?:\s*-\s*(\d*))?$/)
    if (!m) continue
    const from = m[1] ? parseInt(m[1], 10) : 1
    const to = m[2] ? parseInt(m[2], 10) : total
    for (let i = Math.max(1, from); i <= Math.min(total, to); i++) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}

/* ------------------------------ 逐页转换 ------------------------------ */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? new Blob()), fmt.value === 'jpg' ? 'image/jpeg' : 'image/png', jpgQuality.value)
  })
}

/** 生成小缩略图 dataURL(限制 220px,避免多页时内存暴涨) */
function makeThumb(canvas: HTMLCanvasElement): string {
  const max = 220
  const ratio = Math.min(1, max / Math.max(canvas.width, canvas.height))
  const t = document.createElement('canvas')
  t.width = Math.max(1, Math.round(canvas.width * ratio))
  t.height = Math.max(1, Math.round(canvas.height * ratio))
  t.getContext('2d')?.drawImage(canvas, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.7)
}

async function convert(doc: import('pdfjs-dist').PDFDocumentProxy | null) {
  if (!doc) return
  const pageList = parseRange(rangeText.value, doc.numPages)
  if (!pageList.length) { ElMessage.warning('页码范围无效'); return }
  busy.value = true
  pages.value = []
  progress.value = 0
  try {
    for (let idx = 0; idx < pageList.length; idx++) {
      const pageNo = pageList[idx]
      progress.value = Math.round((idx / pageList.length) * 100)
      progressText.value = `正在转换第 ${pageNo} 页(${idx + 1}/${pageList.length})`
      const page = await doc.getPage(pageNo)
      const viewport = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')!
      // JPG 需要白底(透明区域会变黑)
      if (fmt.value === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const blob = await canvasToBlob(canvas)
      pages.value.push({
        page: pageNo,
        blob,
        blobUrl: URL.createObjectURL(blob),
        thumbUrl: makeThumb(canvas),
        w: canvas.width,
        h: canvas.height,
      })
    }
    progress.value = 100
    progressText.value = `完成,共 ${pageList.length} 张`
    // 拼接模式下自动生成长图
    if (stitchMode.value !== 'none') await renderStitch()
  } catch (e) {
    console.warn('[pdf2img]', e)
    progressText.value = '转换中断'
    ElMessage.error('转换出错,请重试或降低清晰度倍率')
  } finally {
    busy.value = false
  }
}

function reConvert() {
  if (!lastFile) return
  void loadPdf(lastFile, false)
}

/* ------------------------------ 拼接长图 ------------------------------ */
async function renderStitch() {
  if (stitchMode.value === 'none') { stitchUrl.value = ''; stitchSize.value = null; return }
  const list = pages.value
  if (!list.length) return
  stitchBusy.value = true
  try {
    // 目标尺寸:竖向 = 宽取最大、高求和;横向 = 高取最大、宽求和
    const w = stitchMode.value === 'v' ? Math.max(...list.map((p) => p.w)) : list.reduce((n, p) => n + p.w, 0)
    const h = stitchMode.value === 'v' ? list.reduce((n, p) => n + p.h, 0) : Math.max(...list.map((p) => p.h))
    // 浏览器 canvas 上限(单边 32767 / 面积 2.68 亿像素),超出直接提示
    if (w > 32767 || h > 32767 || w * h > 268435456) {
      ElMessage.error('拼接尺寸超出浏览器画布上限,请减少页数、换用不拼接或降低清晰度倍率')
      stitchBusy.value = false
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    let offset = 0
    for (const p of list) {
      // 用已生成的 blob 逐页重绘:同一时间内存里只有一张位图
      const bmp = await createImageBitmap(p.blob)
      if (stitchMode.value === 'v') {
        const x = Math.round((w - p.w) / 2)
        ctx.drawImage(bmp, x, offset)
        offset += p.h
      } else {
        const y = Math.round((h - p.h) / 2)
        ctx.drawImage(bmp, offset, y)
        offset += p.w
      }
      bmp.close()
    }
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), fmt.value === 'jpg' ? 'image/jpeg' : 'image/png', jpgQuality.value))
    if (stitchUrl.value) URL.revokeObjectURL(stitchUrl.value)
    stitchUrl.value = URL.createObjectURL(blob)
    stitchSize.value = { w, h }
  } catch (e) {
    console.warn('[pdf2img stitch]', e)
    ElMessage.error('拼接失败,请降低清晰度倍率或减少页数')
  } finally {
    stitchBusy.value = false
  }
}

async function onStitchModeChange() {
  if (stitchMode.value === 'none') { stitchUrl.value = ''; stitchSize.value = null; return }
  if (hasData.value) await renderStitch()
}

/* ------------------------------ 导出 ------------------------------ */
function pageName(p: PageImg): string {
  const ext = fmt.value === 'jpg' ? 'jpg' : 'png'
  return `${fileName.value || 'pdf'}-第${String(p.page).padStart(3, '0')}页.${ext}`
}

function downloadPage(p: PageImg) { downloadBlob(p.blob, pageName(p)) }

function downloadAll(): void {
  if (!hasData.value) return
  const list = pages.value.map((p) => ({ name: pageName(p), data: new Uint8Array(p.w * p.h) }))
  void (async () => {
    // Blob → ArrayBuffer → Uint8Array(zip 打包需要字节)
    for (let i = 0; i < list.length; i++) {
      list[i].data = new Uint8Array(await pages.value[i].blob.arrayBuffer())
    }
    downloadBlob(buildZip(list), `${fileName.value || 'pdf'}-图片-${Date.now()}.zip`)
    ElMessage.success(`已打包 ${list.length} 张图片`)
  })()
}

function downloadStitch() {
  if (!stitchUrl.value) return
  const ext = fmt.value === 'jpg' ? 'jpg' : 'png'
  const dir = stitchMode.value === 'v' ? '竖向' : '横向'
  // 直接用 a[download] 指向 blobUrl 即可
  const a = document.createElement('a')
  a.href = stitchUrl.value
  a.download = `${fileName.value || 'pdf'}-长图-${dir}.${ext}`
  a.click()
  ElMessage.success('长图已下载')
}

/* ------------------------------ 重置 ------------------------------ */
function reset() {
  for (const p of pages.value) URL.revokeObjectURL(p.blobUrl)
  if (stitchUrl.value) URL.revokeObjectURL(stitchUrl.value)
  pages.value = []
  stitchUrl.value = ''
  stitchSize.value = null
  numPages.value = 0
  fileName.value = ''
  fileSize.value = 0
  lastFile = null
}

onBeforeUnmount(() => {
  for (const p of pages.value) URL.revokeObjectURL(p.blobUrl)
  if (stitchUrl.value) URL.revokeObjectURL(stitchUrl.value)
})
</script>

<template>
  <ToolPage>
    <template #title>PDF 转图片</template>
    <template #desc>
      逐页把 PDF 渲染为 PNG / JPG,多页 PDF 每页一张;可选拼接成竖向或横向长图,多图一键打包 ZIP。全部本地完成,不上传。
    </template>

    <!-- 选择文件 -->
    <div
      class="drop"
      :class="{ dragging }"
      @click="onPick"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="onFileChange" />
      <el-icon :size="30"><Picture /></el-icon>
      <div class="drop-title">{{ numPages ? '换一个 PDF' : '点击选择或拖入 PDF 文件' }}</div>
      <div v-if="numPages" class="drop-info">{{ fileName }}.pdf · {{ (fileSize / 1024).toFixed(0) }} KB · 共 {{ numPages }} 页</div>
      <div v-else class="drop-info">支持多页 PDF;加密 PDF 暂不支持</div>
    </div>

    <!-- 设置 -->
    <div v-if="numPages" class="settings">
      <div class="s-row">
        <span class="s-label">页码范围</span>
        <input v-model="rangeText" class="s-input" placeholder="留空 = 全部;示例:1-3,5" @keydown.enter="reConvert" />
      </div>
      <div class="s-row">
        <span class="s-label">格式</span>
        <el-radio-group :model-value="fmt" size="small" @update:model-value="(v: string | number | boolean | undefined) => (fmt = v as 'png' | 'jpg')">
          <el-radio-button value="png">PNG(无损)</el-radio-button>
          <el-radio-button value="jpg">JPG(更小)</el-radio-button>
        </el-radio-group>
        <template v-if="fmt === 'jpg'">
          <span class="s-label" style="margin-left: 12px">质量</span>
          <el-slider v-model="jpgQuality" :min="0.5" :max="1" :step="0.05" style="width: 140px" />
        </template>
      </div>
      <div class="s-row">
        <span class="s-label">清晰度</span>
        <el-radio-group :model-value="scale" size="small" @update:model-value="(v: string | number | boolean | undefined) => (scale = v as number)">
          <el-radio-button :value="1">1x(72 DPI)</el-radio-button>
          <el-radio-button :value="2">2x(144 DPI)</el-radio-button>
          <el-radio-button :value="3">3x(216 DPI)</el-radio-button>
        </el-radio-group>
      </div>
      <div class="s-row">
        <span class="s-label">拼接长图</span>
        <el-radio-group :model-value="stitchMode" size="small" :disabled="busy" @update:model-value="(v: string | number | boolean | undefined) => { stitchMode = v as 'none' | 'v' | 'h'; void onStitchModeChange() }">
          <el-radio-button value="none">不拼接</el-radio-button>
          <el-radio-button value="v">竖向长图</el-radio-button>
          <el-radio-button value="h">横向长图</el-radio-button>
        </el-radio-group>
      </div>
      <div class="s-row">
        <span class="s-label" />
        <el-button type="primary" size="small" :icon="RefreshLeft" :loading="busy" @click="reConvert">按当前设置重新转换</el-button>
        <el-button size="small" :icon="Download" :disabled="!hasData || busy" @click="downloadAll">全部打包 ZIP({{ pages.length }} 张)</el-button>
        <span v-if="hasData" class="s-sub">共 {{ formatKB(totalBytes) }}</span>
      </div>
      <div v-if="busy" class="s-progress">
        <el-progress :percentage="progress" :stroke-width="8" />
        <span class="s-sub">{{ progressText }}</span>
      </div>
    </div>

    <!-- 拼接结果 -->
    <div v-if="stitchUrl" class="stitch-box">
      <div class="sec-label">
        长图预览({{ stitchMode === 'v' ? '竖向' : '横向' }}
        <template v-if="stitchSize">· {{ stitchSize.w }} × {{ stitchSize.h }} px</template>)
      </div>
      <div class="stitch-wrap">
        <img :src="stitchUrl" :class="stitchMode === 'v' ? 'stitch-v' : 'stitch-h'" alt="长图预览" />
      </div>
      <el-button type="primary" size="small" :icon="Download" :disabled="stitchBusy" @click="downloadStitch">下载长图</el-button>
    </div>

    <!-- 单页结果 -->
    <div v-if="hasData" class="grid">
      <div class="sec-label">每页一张({{ pages.length }} 张)</div>
      <div class="grid-inner">
        <div v-for="p in pages" :key="p.page" class="cell">
          <img :src="p.thumbUrl" loading="lazy" alt="" />
          <div class="cell-meta">
            <span>第 {{ p.page }} 页 · {{ p.w }}×{{ p.h }}</span>
            <el-button text size="small" type="primary" @click="downloadPage(p)">下载</el-button>
          </div>
        </div>
      </div>
    </div>
  </ToolPage>
</template>

<script lang="ts">
function formatKB(n: number): string {
  return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB'
}
export default { name: 'PdfToImage' }
</script>

<style scoped>
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 16px;
  border: 1.5px dashed var(--card-border, #dcdfe6);
  border-radius: 14px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: border-color 0.2s, background 0.2s;
}
.drop:hover, .drop.dragging { border-color: var(--brand, #409eff); background: var(--el-color-primary-light-9); }
.drop-title { font-size: 14px; color: var(--el-text-color-primary); }
.drop-info { font-size: 12px; }

.settings {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--card-border, #dcdfe6);
  border-radius: 14px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.s-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.s-label { width: 64px; flex: none; font-size: 13px; color: var(--el-text-color-secondary); }
.s-input {
  height: 30px;
  width: 220px;
  padding: 0 10px;
  border: 1px solid var(--card-border, #dcdfe6);
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  outline: none;
}
.s-input:focus { border-color: var(--brand, #409eff); }
.s-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.s-progress { display: flex; align-items: center; gap: 12px; }
.s-progress .el-progress { flex: 1; }

.sec-label { font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); margin: 18px 0 10px; }

.stitch-box { margin-top: 6px; }
.stitch-wrap {
  margin-bottom: 10px;
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--card-border, #dcdfe6);
  border-radius: 12px;
  background: var(--el-fill-color-light);
  padding: 10px;
  display: flex;
  justify-content: center;
}
.stitch-v { max-height: 400px; }
.stitch-h { max-width: 100%; }

.grid-inner {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.cell {
  border: 1px solid var(--card-border, #dcdfe6);
  border-radius: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
}
.cell img {
  display: block;
  width: 100%;
  height: 150px;
  object-fit: contain;
  background: var(--el-fill-color-light, #f5f7fa);
}
.cell-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
