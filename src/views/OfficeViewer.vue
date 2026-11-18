<script setup lang="ts">
/**
 * Office 文档预览
 * 本地(不上传)解析并预览 Word / Excel:
 *  - .docx 用 docx-preview 还原排版渲染
 *  - .xls / .xlsx / .csv 用 SheetJS 解析,多工作表切换,表格化展示
 *  - WPS「图片嵌入单元格」(DISPIMG 公式):提取私有 ETCellImageData 流里的图片,
 *    按公式 ID 回填到对应单元格;无公式引用的图片在下方画廊集中展示
 *  - .doc(97-2003 二进制格式)浏览器无法可靠解析,给出另存为 .docx 的提示
 */
import type { UploadFile } from 'element-plus'
import { computed, ref, useTemplateRef } from 'vue'
import { ElMessage } from 'element-plus'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import { readZip } from '@/utils/zip'
import ToolPage from '@/components/ToolPage.vue'

type Kind = 'docx' | 'excel' | 'csv' | 'doc' | 'unknown'

/** 嵌入图片(WPS「图片嵌入单元格」/ xlsx 内嵌图形),objectURL 需在替换时 revoke */
interface CellImage {
  name: string
  url: string
  width: number
  height: number
  /** WPS DISPIMG ID(cNvPr 的 name,如 ID_00DA…),用于回填单元格 */
  id?: string
}

const file = ref<File | null>(null)
const kind = ref<Kind>('unknown')
const loading = ref(false)
const errMsg = ref('')

/** 嵌入图片列表(全部)与 DISPIMG ID → 图片映射 */
const cellImages = ref<CellImage[]>([])
const dispImgs = ref<Map<string, CellImage>>(new Map())

/** 大图查看:当前展示的图片 URL */
const viewerUrl = ref('')

/** Excel 状态:工作表名列表与当前表 */
const sheetNames = ref<string[]>([])
const activeSheet = ref('')
const sheetRows = ref(0)
const sheetCols = ref(0)
/** 当前表的 HTML(自建:含合并单元格与回填图片) */
const tableHtml = ref('')

/** 工作簿缓存(8MB 大文件切换工作表时避免重复解析) */
let cachedWb: XLSX.WorkBook | null = null

/** docx 渲染容器 */
const docxBody = useTemplateRef<HTMLDivElement>('docxBody')

const fileName = computed(() => file.value?.name ?? '')
const fileSize = computed(() => {
  const n = file.value?.size ?? 0
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`
})

/** 没有被 DISPIMG 公式引用的图片(画廊兜底展示) */
const spareImages = computed(() => {
  const used = new Set(dispImgs.value.values())
  return cellImages.value.filter((im) => !used.has(im))
})

const KIND_LABEL: Record<Kind, string> = {
  docx: 'Word 文档',
  excel: 'Excel 工作簿',
  csv: 'CSV 表格',
  doc: 'Word 97-2003',
  unknown: '未知类型',
}

/** 释放已生成的嵌入图片 objectURL */
function revokeImages() {
  for (const im of cellImages.value) URL.revokeObjectURL(im.url)
  cellImages.value = []
  dispImgs.value = new Map()
  viewerUrl.value = ''
}

/**
 * 提取电子表格嵌入图片:
 *  - .xlsx / .xls(xlsx 包):ZIP 本身,取 xl/media/*
 *  - WPS xls:私有 OLE 流 ETCellImageData 内是 ZIP(内含 xl/cellImages.xml + xl/media/*)
 * 有 cellImages.xml 时按其 rId 顺序排列,并记录 cNvPr name(DISPIMG ID)用于回填;
 * 否则按文件名自然排序。
 */
async function extractCellImages(buf: ArrayBuffer, isXls: boolean) {
  revokeImages()
  try {
    let entries: Map<string, Uint8Array> | null = null
    if (isXls) {
      // WPS 私有流:OLE 复合文档里找 ETCellImageData(CFB.read 需 Uint8Array + type)
      const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' })
      const et = XLSX.CFB.find(cfb, 'ETCellImageData')
      if (et?.content) {
        const raw = et.content instanceof Uint8Array ? et.content : new Uint8Array(et.content)
        entries = await readZip(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
      }
    } else {
      entries = await readZip(buf)
    }
    if (!entries?.size) return

    // 媒体文件:xl/media/ 下的图片
    const media = [...entries.keys()].filter((n) => n.startsWith('xl/media/') && /\.(png|jpe?g|gif|bmp|webp)$/i.test(n))
    if (!media.length) return

    // 解析 cellImages.xml:每个 cellImage 的 DISPIMG ID(cNvPr name)与 rId → media 路径
    const order: Array<{ target: string; id?: string }> = []
    const cellXml = entries.get('xl/cellImages.xml')
    const relsXml = entries.get('xl/_rels/cellImages.xml.rels')
    if (cellXml && relsXml) {
      const rels = new Map<string, string>()
      const relText = new TextDecoder().decode(relsXml)
      for (const m of relText.matchAll(/Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) rels.set(m[1], m[2])
      const cellText = new TextDecoder().decode(cellXml)
      for (const block of cellText.matchAll(/<etc:cellImage>([\s\S]*?)<\/etc:cellImage>/g)) {
        const embed = /r:embed="([^"]+)"/.exec(block[1])?.[1]
        const id = /name="(ID_[^"]+)"/.exec(block[1])?.[1]
        const target = embed ? rels.get(embed) : undefined
        if (target) order.push({ target, id })
      }
    }

    // 排序:先按文档声明顺序,再补上未声明的媒体(按文件名自然排序)
    const declared = order.map((o) => 'xl/' + o.target.replace(/^\.\//, '')).filter((n) => media.includes(n))
    const rest = media
      .filter((n) => !declared.includes(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const sorted = [...declared, ...rest]
    const idByTarget = new Map(order.map((o) => [o.target, o.id]))

    const list: CellImage[] = []
    const idMap = new Map<string, CellImage>()
    for (const name of sorted) {
      const blob = new Blob([entries.get(name) as unknown as BlobPart], { type: guessMime(name) })
      const url = URL.createObjectURL(blob)
      const dim = await imageSize(url)
      const relTarget = name.slice('xl/'.length)
      const im: CellImage = {
        name: name.split('/').pop() ?? name,
        url,
        width: dim.w,
        height: dim.h,
        id: idByTarget.get(relTarget),
      }
      list.push(im)
      if (im.id) idMap.set(im.id, im)
    }
    cellImages.value = list
    dispImgs.value = idMap
  } catch {
    // 嵌入图片提取失败不影响表格展示
  }
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'bmp') return 'image/bmp'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/** 读取图片真实宽高(用于缩略图占位) */
function imageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 0, h: 0 })
    img.src = url
  })
}

function detectKind(name: string): Kind {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'docx') return 'docx'
  if (ext === 'xls' || ext === 'xlsx') return 'excel'
  if (ext === 'csv' || ext === 'tsv') return 'csv'
  if (ext === 'doc') return 'doc'
  return 'unknown'
}

/* ------------------------------------------------------------------ *
 * 自建表格 HTML:支持合并单元格,并把 DISPIMG 公式回填为对应图片
 * ------------------------------------------------------------------ */

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 单元格里的 DISPIMG 公式 ID;普通文本返回 null */
function dispIdOf(cell: XLSX.CellObject | undefined): string | null {
  if (!cell) return null
  const m = /DISPIMG\(\s*"([^"]+)"/.exec(String(cell.f ?? cell.w ?? cell.v ?? ''))
  return m ? m[1] : null
}

function buildSheetHtml(sheet: XLSX.WorkSheet, idMap: Map<string, CellImage>): string {
  if (!sheet['!ref']) return ''
  const range = XLSX.utils.decode_range(sheet['!ref'])

  // 合并单元格:左上角带 rowspan/colspan,其余格子跳过
  const skip = new Set<string>()
  const spans = new Map<string, { rs: number; cs: number }>()
  for (const m of (sheet['!merges'] ?? []) as XLSX.Range[]) {
    spans.set(`${m.s.r},${m.s.c}`, { rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 })
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) skip.add(`${r},${c}`)
      }
    }
  }

  let html = '<table><tbody>'
  for (let r = range.s.r; r <= range.e.r; r++) {
    html += '<tr>'
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = `${r},${c}`
      if (skip.has(key)) continue
      const sp = spans.get(key)
      const attrs = sp ? ` rowspan="${sp.rs}" colspan="${sp.cs}"` : ''
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined

      // DISPIMG 公式 → 回填对应图片(点击可放大)
      const id = dispIdOf(cell)
      const im = id ? idMap.get(id) : undefined
      if (im) {
        html += `<td${attrs} class="has-img"><img src="${im.url}" alt="${escHtml(im.name)}"></td>`
        continue
      }

      const text = cell ? String(cell.w ?? cell.v ?? '') : ''
      html += `<td${attrs}>${escHtml(text)}</td>`
    }
    html += '</tr>'
  }
  return html + '</tbody></table>'
}

/** 表格内图片点击放大(事件委托) */
function onTableClick(e: MouseEvent) {
  const img = (e.target as HTMLElement | null)?.closest?.('td.has-img img') as HTMLImageElement | null
  if (img) viewerUrl.value = img.getAttribute('src') ?? ''
}

/** 渲染 Excel / CSV:解析工作簿 → 默认显示第一个表,切换时重新生成 HTML */
function renderExcel(buf: ArrayBuffer) {
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true })
  if (!wb.SheetNames.length) throw new Error('工作簿中没有工作表')
  cachedWb = wb
  sheetNames.value = wb.SheetNames
  activeSheet.value = wb.SheetNames[0]
  showSheet()
}

/** 切换/首次展示某个工作表(使用缓存的解析结果) */
function showSheet() {
  const sheet = cachedWb?.Sheets[activeSheet.value]
  if (!sheet) return
  tableHtml.value = buildSheetHtml(sheet, dispImgs.value)
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
  sheetRows.value = range ? range.e.r - range.s.r + 1 : 0
  sheetCols.value = range ? range.e.c - range.s.c + 1 : 0
}

async function onFile(f: File) {
  file.value = f
  errMsg.value = ''
  tableHtml.value = ''
  sheetNames.value = []
  cachedWb = null
  revokeImages()
  kind.value = detectKind(f.name)

  if (kind.value === 'unknown') {
    errMsg.value = '暂不支持该格式,请选择 .docx / .xls / .xlsx / .csv 文件'
    return
  }
  if (kind.value === 'doc') {
    errMsg.value = '.doc 是 97-2003 二进制格式,浏览器无法可靠解析;请用 Word/WPS 另存为 .docx 后再预览'
    return
  }

  loading.value = true
  try {
    const buf = await f.arrayBuffer()
    if (kind.value === 'docx') {
      if (!docxBody.value) throw new Error('渲染容器未就绪')
      await renderAsync(buf, docxBody.value, undefined, {
        inWrapper: true,
        ignoreLastRenderedPageBreak: false,
        experimental: false,
        useBase64URL: true,
      })
    } else {
      // 先提取嵌入图片(建立 DISPIMG ID → URL 映射),再建表回填到原位
      await extractCellImages(buf, f.name.toLowerCase().endsWith('.xls'))
      renderExcel(buf)
    }
  } catch (e) {
    errMsg.value = `解析失败: ${(e as Error).message ?? e}`
    ElMessage.error(errMsg.value)
  } finally {
    loading.value = false
  }
}

function clearFile() {
  file.value = null
  kind.value = 'unknown'
  errMsg.value = ''
  tableHtml.value = ''
  sheetNames.value = []
  cachedWb = null
  revokeImages()
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>Office 文档预览</template>
    <template #desc>在浏览器本地预览 Word(.docx)与 Excel(.xls/.xlsx)/CSV,文件不上传;多工作表切换,Word 按原始排版渲染,WPS 嵌入单元格图片自动回填原位(点击放大)。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>选择文件(本地解析,不联网上传)</span>
          <span v-if="file" class="meta">
            <el-tag size="small" :type="errMsg ? 'danger' : 'primary'">{{ KIND_LABEL[kind] }}</el-tag>
            <span class="muted">{{ fileName }} · {{ fileSize }}</span>
            <el-button size="small" @click="clearFile">清除</el-button>
          </span>
        </div>
      </template>

      <el-upload
        v-if="!file"
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".docx,.doc,.xls,.xlsx,.csv,.tsv"
        :on-change="onUploadChange"
      >
        <div class="drop">拖入 .docx / .xls / .xlsx / .csv 文件,或点击选择</div>
      </el-upload>
      <p v-else class="hint">文档已在下方展示,点击「清除」可重新选择其他文件。</p>

      <el-alert v-if="errMsg" :title="errMsg" type="warning" :closable="false" class="mt12" />
      <div v-if="loading" class="loading" v-loading="true" element-loading-text="正在解析文档…" />
    </el-card>

    <!-- Word:docx-preview 按原始排版渲染(分页、表格、图片、样式) -->
    <el-card v-if="file && kind === 'docx' && !errMsg" shadow="never" class="mt12">
      <template #header><span>文档内容</span></template>
      <div class="docx-scroll">
        <div ref="docxBody" class="docx-body" />
      </div>
    </el-card>

    <!-- Excel/CSV:工作表切换 + 表格(嵌入单元格图片已回填原位) -->
    <el-card v-if="file && (kind === 'excel' || kind === 'csv') && !errMsg" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>{{ fileName }} · {{ sheetRows }} 行 × {{ sheetCols }} 列</span>
          <span v-if="cellImages.length" class="muted">嵌入图片 {{ cellImages.length }} 张已回填,点击可放大</span>
          <span v-else-if="sheetNames.length > 1" class="muted">共 {{ sheetNames.length }} 个工作表</span>
        </div>
      </template>
      <el-tabs v-if="sheetNames.length > 1" v-model="activeSheet" @tab-change="showSheet()">
        <el-tab-pane v-for="n in sheetNames" :key="n" :label="n" :name="n" />
      </el-tabs>
      <div class="sheet-scroll" @click="onTableClick">
        <div class="sheet-table" v-html="tableHtml" />
      </div>
    </el-card>

    <!-- 未回填的嵌入图片:无 DISPIMG 公式引用的图片(如浮动图片)兜底集中展示 -->
    <el-card v-if="spareImages.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>未回填的嵌入图片 · {{ spareImages.length }} 张</span>
          <span class="muted">这些图片在原文件中没有对应的单元格公式引用,故集中展示</span>
        </div>
      </template>
      <div class="img-grid">
        <div v-for="im in spareImages" :key="im.url" class="img-item">
          <el-image :src="im.url" fit="cover" lazy @click="viewerUrl = im.url">
            <template #placeholder><div class="img-loading" v-loading="true" /></template>
            <template #error><div class="img-error">加载失败</div></template>
          </el-image>
          <p class="img-meta">{{ im.name }} · {{ im.width }}×{{ im.height }}</p>
        </div>
      </div>
    </el-card>

    <!-- 大图查看(表格内与画廊共用) -->
    <el-image-viewer
      v-if="viewerUrl"
      :url-list="[viewerUrl]"
      @close="viewerUrl = ''"
      @switch="viewerUrl = ''"
    />
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.meta { display: inline-flex; align-items: center; gap: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.drop { padding: 24px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.hint { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; }
.loading { height: 160px; }

.docx-scroll {
  max-height: clamp(360px, calc(100vh - 330px), 2000px);
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 12px;
}
/* docx-preview 自带 .docx-wrapper 深灰底,这里调淡并居中页面 */
.docx-scroll :deep(.docx-wrapper) {
  background: transparent;
  padding: 0;
}
.docx-scroll :deep(.docx-wrapper > section.docx) {
  margin: 0 auto 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  background: #fff;
}

/* 全屏页面下表格区域尽量吃满视口高度 */
.sheet-scroll {
  max-height: clamp(360px, calc(100vh - 330px), 2000px);
  overflow: auto;
}
.sheet-table :deep(table) {
  border-collapse: collapse;
  font-size: 13px;
}
.sheet-table :deep(td) {
  border: 1px solid var(--el-border-color-lighter);
  padding: 5px 10px;
  min-width: 80px;
  vertical-align: middle;
}
.sheet-table :deep(tr:first-child td) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}
/* 回填的嵌入单元格图片:限制在合理展示尺寸,点击可看原图 */
.sheet-table :deep(td.has-img) {
  padding: 4px;
  background: #fff;
}
.sheet-table :deep(td.has-img img) {
  display: block;
  max-width: 360px;
  max-height: 240px;
  cursor: zoom-in;
  border-radius: 2px;
}

.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.img-item :deep(.el-image) {
  display: block;
  width: 100%;
  height: 160px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  cursor: zoom-in;
}
.img-loading,
.img-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.img-meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
