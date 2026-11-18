<script setup lang="ts">
/**
 * Office 文档预览
 * 本地(不上传)解析并预览 Word / Excel:
 *  - .docx 用 docx-preview 还原排版渲染
 *  - .xls / .xlsx / .csv 用 SheetJS 解析,多工作表切换,表格化展示
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

/** 嵌入图片(WPS"图片嵌入单元格"/xlsx 内嵌图形),objectURL 需在替换时 revoke */
interface CellImage {
  name: string
  url: string
  width: number
  height: number
}

const file = ref<File | null>(null)
const kind = ref<Kind>('unknown')
const loading = ref(false)
const errMsg = ref('')

/** 嵌入图片列表 */
const cellImages = ref<CellImage[]>([])
const activeImage = ref('')

/** Excel 状态:工作表名列表与当前表 */
const sheetNames = ref<string[]>([])
const activeSheet = ref('')
const sheetRows = ref(0)
const sheetCols = ref(0)
/** 当前表的 HTML(xlsx 的 sheet_to_html 产物) */
const tableHtml = ref('')

/** docx 渲染容器 */
const docxBody = useTemplateRef<HTMLDivElement>('docxBody')

const fileName = computed(() => file.value?.name ?? '')
const fileSize = computed(() => {
  const n = file.value?.size ?? 0
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`
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
  activeImage.value = ''
}

/**
 * 提取电子表格嵌入图片:
 *  - .xlsx / .xls(xlsx 包):ZIP 本身,取 xl/media/*
 *  - WPS xls:私有 OLE 流 ETCellImageData 内是 ZIP(内含 xl/cellImages.xml + xl/media/*)
 * 有 cellImages.xml 时按其 rId 顺序排列;否则按文件名自然排序。
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

    // 解析 rId → media 路径(cellImages.xml.rels),保证顺序与文档一致
    const order: string[] = []
    const cellXml = entries.get('xl/cellImages.xml')
    const relsXml = entries.get('xl/_rels/cellImages.xml.rels')
    if (cellXml && relsXml) {
      const rels = new Map<string, string>()
      const relText = new TextDecoder().decode(relsXml)
      for (const m of relText.matchAll(/Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) rels.set(m[1], m[2])
      const cellText = new TextDecoder().decode(cellXml)
      for (const m of cellText.matchAll(/r:embed="([^"]+)"/g)) {
        const target = rels.get(m[1])
        if (target) order.push('xl/' + target.replace(/^\.\//, '').replace(/^media\//, 'media/'))
      }
    }
    const sorted = [...new Set([...order, ...media.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))])]
      .filter((n) => media.includes(n))

    const list: CellImage[] = []
    for (const name of sorted) {
      const blob = new Blob([entries.get(name) as unknown as BlobPart], { type: guessMime(name) })
      const url = URL.createObjectURL(blob)
      const dim = await imageSize(url)
      list.push({ name: name.split('/').pop() ?? name, url, width: dim.w, height: dim.h })
    }
    cellImages.value = list
    activeImage.value = list[0]?.url ?? ''
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

/** 渲染 Excel / CSV:解析工作簿 → 默认显示第一个表,切换时重新生成 HTML */
function renderExcel(buf: ArrayBuffer) {
  const wb = XLSX.read(buf, { type: 'array' })
  if (!wb.SheetNames.length) throw new Error('工作簿中没有工作表')
  sheetNames.value = wb.SheetNames
  activeSheet.value = wb.SheetNames[0]
  showSheet(wb)
}

/** 切换/首次展示某个工作表 */
function showSheet(wb?: XLSX.WorkBook) {
  const book = wb ?? XLSX.read(file.value as unknown as ArrayBuffer, { type: 'array' })
  const sheet = book.Sheets[activeSheet.value]
  if (!sheet) return
  tableHtml.value = XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' })
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
  sheetRows.value = range ? range.e.r - range.s.r + 1 : 0
  sheetCols.value = range ? range.e.c - range.s.c + 1 : 0
}

async function onFile(f: File) {
  file.value = f
  errMsg.value = ''
  tableHtml.value = ''
  sheetNames.value = []
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
      renderExcel(buf)
      // 表格之外的嵌入图片(WPS"图片嵌入单元格"/xlsx 内嵌图形)单独提取展示
      await extractCellImages(buf, f.name.toLowerCase().endsWith('.xls'))
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
  revokeImages()
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>Office 文档预览</template>
    <template #desc>在浏览器本地预览 Word(.docx)与 Excel(.xls/.xlsx)/CSV,文件不上传;多工作表切换,Word 按原始排版渲染。</template>

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

    <!-- Excel/CSV:工作表切换 + 表格 -->
    <el-card v-if="file && (kind === 'excel' || kind === 'csv') && !errMsg" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>{{ fileName }} · {{ sheetRows }} 行 × {{ sheetCols }} 列</span>
          <span v-if="sheetNames.length > 1" class="muted">共 {{ sheetNames.length }} 个工作表</span>
        </div>
      </template>
      <el-tabs v-if="sheetNames.length > 1" v-model="activeSheet" @tab-change="showSheet()">
        <el-tab-pane v-for="n in sheetNames" :key="n" :label="n" :name="n" />
      </el-tabs>
      <div class="sheet-scroll">
        <div class="sheet-table" v-html="tableHtml" />
      </div>
    </el-card>

    <!-- 嵌入图片:WPS"图片嵌入单元格"或 xlsx 内嵌图形,单独提取展示 -->
    <el-card v-if="cellImages.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>嵌入图片 · {{ cellImages.length }} 张</span>
          <span class="muted">图片为"嵌入单元格"类型,原文件未记录所在行列,故集中展示</span>
        </div>
      </template>
      <div class="img-grid">
        <div v-for="(im, i) in cellImages" :key="im.url" class="img-item">
          <el-image
            :src="im.url"
            :preview-src-list="cellImages.map((x) => x.url)"
            :initial-index="i"
            :preview-teleported="true"
            fit="cover"
            lazy
          >
            <template #placeholder><div class="img-loading" v-loading="true" /></template>
            <template #error><div class="img-error">加载失败</div></template>
          </el-image>
          <p class="img-meta">{{ im.name }} · {{ im.width }}×{{ im.height }}</p>
        </div>
      </div>
    </el-card>
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
  max-height: 70vh;
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

.sheet-scroll {
  max-height: 70vh;
  overflow: auto;
}
/* SheetJS sheet_to_html 生成的 table 样式 */
.sheet-table :deep(table) {
  border-collapse: collapse;
  font-size: 13px;
}
.sheet-table :deep(td) {
  border: 1px solid var(--el-border-color-lighter);
  padding: 5px 10px;
  min-width: 80px;
  white-space: nowrap;
}
.sheet-table :deep(tr:first-child td) {
  background: var(--el-fill-color-light);
  font-weight: 600;
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
