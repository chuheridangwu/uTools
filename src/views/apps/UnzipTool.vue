<script setup lang="ts">
/**
 * 在线解压(ZIP)
 * 纯前端解析 ZIP 中央目录,支持 store(0) 与 deflate(8) 两种算法:
 *  - 解压用浏览器原生 DecompressionStream('deflate-raw'),无需第三方库;
 *  - 导出用内置的「不压缩 ZIP 打包」实现,避免多文件逐个下载被浏览器拦截。
 * 文件只在内存中处理,不上传服务器;加密包 / ZIP64 / rar / 7z 暂不支持。
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Box, Delete, Document, Download, Folder, Search, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { baseName, formatSize } from '@/utils/common'

type EntryStatus = 'pending' | 'ok' | 'error' | 'skipped'

interface Entry {
  id: number
  name: string
  dir: boolean
  method: number
  compressedSize: number
  size: number
  offset: number
  encrypted: boolean
  data: Uint8Array<ArrayBuffer> | null
  status: EntryStatus
  error?: string
}

const entries = ref<Entry[]>([])
const zipBuffer = shallowRef<ArrayBuffer | null>(null)
const fileName = ref('')
const fileSize = ref(0)
const busy = ref(false)
const progress = ref(0)
const keyword = ref('')
const dragOver = ref(false)
const note = ref('')
const previewId = ref<number | null>(null)
const previewText = ref('')
const previewUrl = ref('')

const TEXT_EXT = /\.(txt|md|json|js|ts|css|html?|xml|yml|yaml|csv|log|ini|conf|sh|py|java|c|cpp|go|rs|sql|vue|svg)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|ico)$/i

const files = computed(() => entries.value.filter((e) => !e.dir))
const shown = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return entries.value
  return entries.value.filter((e) => e.name.toLowerCase().includes(k))
})
const okCount = computed(() => files.value.filter((e) => e.status === 'ok').length)
const totalSize = computed(() => files.value.reduce((n, e) => n + e.size, 0))
const hasData = computed(() => okCount.value > 0)

const previewEntry = computed(() => entries.value.find((e) => e.id === previewId.value) ?? null)

/* ------------------------------ ZIP 解析 ------------------------------ */

const u16 = (dv: DataView, o: number) => dv.getUint16(o, true)
const u32 = (dv: DataView, o: number) => dv.getUint32(o, true)

function decodeName(bytes: Uint8Array<ArrayBuffer>, utf8: boolean): string {
  if (utf8) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { /* fallthrough */ }
  }
  // 很多工具(macOS zip 等)写 UTF-8 文件名却不置 0x800 标志:先按严格 UTF-8 试,再退回 GBK
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch { /* not utf-8 */ }
  try {
    return new TextDecoder('gbk').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

function parseZip(buf: ArrayBuffer): Entry[] {
  const dv = new DataView(buf)
  const len = buf.byteLength
  if (len < 22) throw new Error('文件太小,不是有效的 ZIP')

  let eocd = -1
  const from = Math.max(0, len - 65557)
  for (let i = len - 22; i >= from; i--) {
    if (u32(dv, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('未找到 ZIP 目录结尾,可能不是 ZIP 文件')

  const total = u16(dv, eocd + 10)
  const cdOffset = u32(dv, eocd + 16)
  if (total === 0xffff || cdOffset === 0xffffffff) throw new Error('暂不支持 ZIP64 格式')

  let p = cdOffset
  const list: Entry[] = []
  for (let i = 0; i < total; i++) {
    if (p + 46 > len) throw new Error('ZIP 目录越界,文件可能已损坏')
    if (u32(dv, p) !== 0x02014b50) throw new Error('ZIP 目录结构损坏')
    const flags = u16(dv, p + 8)
    const method = u16(dv, p + 10)
    const csize = u32(dv, p + 20)
    const usize = u32(dv, p + 24)
    const nameLen = u16(dv, p + 28)
    const extraLen = u16(dv, p + 30)
    const commentLen = u16(dv, p + 32)
    const offset = u32(dv, p + 42)
    if (csize === 0xffffffff || usize === 0xffffffff) throw new Error('暂不支持 ZIP64 格式')
    const name = decodeName(new Uint8Array(buf, p + 46, nameLen), (flags & 0x800) !== 0)
    const dir = name.endsWith('/')
    list.push({
      id: i,
      name,
      dir,
      method,
      compressedSize: csize,
      size: usize,
      offset,
      encrypted: (flags & 1) !== 0,
      data: null,
      status: dir ? 'skipped' : 'pending',
    })
    p += 46 + nameLen + extraLen + commentLen
  }
  return list
}

async function extractOne(entry: Entry): Promise<void> {
  const buf = zipBuffer.value
  if (!buf || entry.dir) return
  if (entry.encrypted) {
    entry.status = 'error'
    entry.error = '加密压缩包暂不支持'
    return
  }
  if (entry.method !== 0 && entry.method !== 8) {
    entry.status = 'error'
    entry.error = `不支持的压缩算法(${entry.method})`
    return
  }
  try {
    const dv = new DataView(buf)
    if (u32(dv, entry.offset) !== 0x04034b50) throw new Error('本地文件头损坏')
    const nameLen = u16(dv, entry.offset + 26)
    const extraLen = u16(dv, entry.offset + 28)
    const start = entry.offset + 30 + nameLen + extraLen
    if (start + entry.compressedSize > buf.byteLength) throw new Error('数据超出文件范围')
    const raw = new Uint8Array(buf.slice(start, start + entry.compressedSize))
    let out: Uint8Array<ArrayBuffer>
    if (entry.method === 0) {
      out = raw
    } else {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      out = new Uint8Array(await new Response(stream).arrayBuffer())
    }
    entry.data = out
    entry.status = 'ok'
  } catch (e) {
    entry.status = 'error'
    entry.error = e instanceof Error ? e.message : String(e)
  }
}

/* ------------------------------ 文件载入 ------------------------------ */

async function loadFile(file: File | undefined | null) {
  if (!file) return
  if (!/\.zip$/i.test(file.name)) {
    ElMessage.warning('目前只支持 .zip 压缩包')
    return
  }
  if (file.size > 300 * 1024 * 1024) {
    ElMessage.warning('文件超过 300MB,浏览器内存可能不足')
  }
  clearAll()
  busy.value = true
  fileName.value = file.name
  fileSize.value = file.size
  try {
    const buf = await file.arrayBuffer()
    zipBuffer.value = buf
    const list = parseZip(buf)
    entries.value = list
    if (!list.length) {
      note.value = '压缩包内没有文件'
      busy.value = false
      return
    }
    const targets = list.filter((e) => !e.dir)
    let done = 0
    for (let i = 0; i < entries.value.length; i++) {
      const e = entries.value[i]
      if (e.dir) continue
      await extractOne(e)
      done++
      progress.value = Math.round((done / targets.length) * 100)
    }
    const failed = entries.value.filter((e) => e.status === 'error').length
    note.value = failed
      ? `解压完成:${failed} 个文件失败(多为加密或特殊压缩算法)`
      : `解压完成:${targets.length} 个文件`
  } catch (e) {
    note.value = e instanceof Error ? e.message : String(e)
    entries.value = []
    zipBuffer.value = null
  } finally {
    busy.value = false
  }
}

function onPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  void loadFile(file)
}

function onDrop(ev: DragEvent) {
  dragOver.value = false
  const file = ev.dataTransfer?.files?.[0]
  void loadFile(file)
}

function clearAll() {
  entries.value = []
  zipBuffer.value = null
  fileName.value = ''
  fileSize.value = 0
  progress.value = 0
  note.value = ''
  keyword.value = ''
  closePreview()
}

/* ------------------------------ 预览 / 下载 ------------------------------ */

function closePreview() {
  previewId.value = null
  previewText.value = ''
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function mimeOf(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
    json: 'application/json', txt: 'text/plain;charset=utf-8', md: 'text/markdown;charset=utf-8',
    html: 'text/html;charset=utf-8', css: 'text/css;charset=utf-8', js: 'text/javascript;charset=utf-8',
    csv: 'text/csv;charset=utf-8', zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}

function openPreview(e: Entry) {
  if (!e.data) return
  closePreview()
  previewId.value = e.id
  if (IMAGE_EXT.test(e.name)) {
    previewUrl.value = URL.createObjectURL(new Blob([e.data], { type: mimeOf(e.name) }))
  } else if (TEXT_EXT.test(e.name)) {
    const slice = e.data.length > 200 * 1024 ? e.data.slice(0, 200 * 1024) : e.data
    previewText.value = new TextDecoder('utf-8').decode(slice)
  }
}

function downloadEntry(e: Entry) {
  if (!e.data) {
    ElMessage.info('该文件未成功解压')
    return
  }
  const url = URL.createObjectURL(new Blob([e.data], { type: mimeOf(e.name) }))
  const a = document.createElement('a')
  a.href = url
  a.download = baseName(e.name) || 'file'
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/* ------------------------------ 重新打包导出 ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 用 store(不压缩)写一个 ZIP,只为把多个文件一次性交给浏览器 */
function buildZip(list: Entry[]): Blob {
  const enc = new TextEncoder()
  const local: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff
  let offset = 0

  for (const f of list) {
    const data = f.data
    if (!data) continue
    const nameBytes = enc.encode(f.name)
    const crc = crc32(data)

    const lh = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    lh.set(nameBytes, 30)

    const ch = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    ch.set(nameBytes, 46)

    local.push(lh, data)
    central.push(ch)
    offset += lh.length + data.length
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, list.length, true)
  ev.setUint16(10, list.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...local, ...central, eocd], { type: 'application/zip' })
}

function exportZip() {
  const list = files.value.filter((e) => e.status === 'ok' && e.data)
  if (!list.length) {
    ElMessage.info('没有可导出的文件')
    return
  }
  const blob = buildZip(list)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `unzipped-${Date.now()}.zip`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  ElMessage.success(`已打包 ${list.length} 个文件`)
}

onBeforeUnmount(closePreview)
</script>

<template>
  <div class="uz">
    <div class="head">
      <div>
        <h3 class="title">在线解压</h3>
        <p class="sub">本地解压 ZIP(store / deflate),可预览、单文件下载或重新打包导出</p>
      </div>
      <el-button v-if="entries.length || note" size="small" :icon="Delete" @click="clearAll">清空</el-button>
    </div>

    <div
      class="drop"
      :class="{ over: dragOver, small: entries.length > 0 }"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept=".zip,application/zip" hidden @change="onPick" />
      <el-icon :size="entries.length ? 22 : 30"><UploadFilled /></el-icon>
      <div class="drop-title">{{ entries.length ? '换一个 ZIP' : '点击选择或拖入 ZIP 文件' }}</div>
      <div class="drop-sub">只在浏览器内存中处理,不上传;支持加密包检测与解压失败提示</div>
    </div>

    <div v-if="busy" class="progress">
      <div class="bar"><div class="bar-in" :style="{ width: progress + '%' }" /></div>
      <span class="p-text">解压中 {{ progress }}%</span>
    </div>

    <div v-if="fileName && !busy" class="filebar">
      <el-icon><Box /></el-icon>
      <span class="fname">{{ fileName }}</span>
      <span class="fmeta">{{ formatSize(fileSize) }} · {{ files.length }} 个文件 · 解压后 {{ formatSize(totalSize) }}</span>
      <span class="spacer" />
      <el-button size="small" type="primary" :icon="Download" :disabled="!hasData" @click="exportZip">打包导出 ZIP</el-button>
    </div>

    <div v-if="note" class="note" :class="{ bad: note.includes('失败') || note.includes('不支持') || note.includes('损坏') }">{{ note }}</div>

    <div v-if="entries.length" class="list-head">
      <el-input v-model="keyword" class="search" :prefix-icon="Search" placeholder="筛选文件名" clearable />
      <span class="cnt">{{ shown.length }} / {{ entries.length }}</span>
    </div>

    <div v-if="entries.length" class="tree">
      <div
        v-for="e in shown"
        :key="e.id"
        class="row"
        :class="{ dir: e.dir, active: previewId === e.id, err: e.status === 'error' }"
      >
        <el-icon class="ico"><Folder v-if="e.dir" /><Document v-else /></el-icon>
        <button class="name" :title="e.name" @click="!e.dir && openPreview(e)">{{ e.name }}</button>
        <span class="size">{{ e.dir ? '—' : formatSize(e.size) }}</span>
        <span v-if="e.status === 'error'" class="chip err" :title="e.error">{{ e.error }}</span>
        <span v-else-if="e.dir" class="chip dir">目录</span>
        <span v-else-if="e.status === 'ok'" class="chip ok">已解压</span>
        <span v-else class="chip">待处理</span>
        <button v-if="!e.dir && e.status === 'ok'" class="dl" title="下载" @click="downloadEntry(e)">
          <el-icon><Download /></el-icon>
        </button>
      </div>
    </div>

    <div v-if="previewEntry" class="preview">
      <div class="preview-head">
        <span class="p-name">{{ previewEntry.name }}</span>
        <span class="spacer" />
        <el-button size="small" :icon="Download" @click="downloadEntry(previewEntry)">下载</el-button>
        <el-button size="small" text @click="closePreview">关闭预览</el-button>
      </div>
      <img v-if="previewUrl" class="p-img" :src="previewUrl" alt="预览" />
      <pre v-else-if="previewText" class="p-text">{{ previewText }}</pre>
      <div v-else class="p-none">该类型不支持预览,可直接下载查看</div>
    </div>

    <p class="foot">
      说明:支持 ZIP 的 store 与 deflate(浏览器原生解压);加密包、ZIP64、rar / 7z 暂不支持。解压结果只存在内存,刷新即清空。
    </p>
  </div>
</template>

<style scoped>
.uz {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
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
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 14px;
  padding: 34px 20px;
  text-align: center;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  transition: border-color 0.15s, background 0.15s;
}
.drop.small {
  padding: 16px;
}
.drop.over,
.drop:hover {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}
.drop-title {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
.drop-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  overflow: hidden;
}
.bar-in {
  height: 100%;
  background: var(--el-color-primary);
  transition: width 0.15s;
}
.p-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.filebar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 12px;
}
.fname {
  font-weight: 600;
  word-break: break-all;
}
.fmeta {
  color: var(--el-text-color-secondary);
}
.spacer {
  flex: 1;
}
.note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.note.bad {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 10%, transparent);
}
.list-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 8px;
}
.search {
  max-width: 260px;
}
.cnt {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}
.tree {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--card-border);
  font-size: 12.5px;
}
.row:last-child {
  border-bottom: none;
}
.row:hover {
  background: var(--el-fill-color-light);
}
.row.active {
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
}
.row.dir {
  color: var(--el-text-color-secondary);
}
.ico {
  flex: none;
  color: var(--el-text-color-placeholder);
}
.name {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row.dir .name {
  cursor: default;
}
.size {
  flex: none;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}
.chip {
  flex: none;
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 8px;
  border: 1px solid var(--card-border);
  color: var(--el-text-color-secondary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip.ok {
  color: #16a34a;
  border-color: color-mix(in srgb, #16a34a 35%, transparent);
}
.chip.err {
  color: #ef4444;
  border-color: color-mix(in srgb, #ef4444 35%, transparent);
}
.chip.dir {
  color: var(--el-text-color-placeholder);
}
.dl {
  flex: none;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
}
.preview {
  margin-top: 12px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
}
.preview-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.p-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-img {
  max-width: 100%;
  max-height: 360px;
  display: block;
  border-radius: 8px;
}
.p-text {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  font-size: 11.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px 12px;
}
.p-none {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  padding: 10px 0;
}
.foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  line-height: 1.7;
}
</style>
