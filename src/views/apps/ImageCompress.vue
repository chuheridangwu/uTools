<script setup lang="ts">
/**
 * 图片压缩
 * 批量压缩 JPEG / PNG / WebP:调节质量与最大宽度,实时显示压缩前后
 * 体积与节省比例,可单独下载或一键打包下载,全部在本机完成不上传。
 */
import { reactive, ref } from 'vue'
import { Download, Picture, RefreshLeft, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Item {
  id: string
  name: string
  type: string
  original: Blob
  compressed: Blob | null
  url: string
  outUrl: string
  quality: number
  maxW: number
  format: string
  busy: boolean
  error?: string
}

const fileRef = ref<HTMLInputElement>()
const items = ref<Item[]>([])
const globalCfg = reactive({ quality: 80, maxW: 0, format: 'keep' })

function pickFiles() {
  fileRef.value?.click()
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files || [])
  input.value = ''
  if (!list.length) return
  for (const f of list) addItem(f)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const list = Array.from(e.dataTransfer?.files || [])
  for (const f of list) if (f.type.startsWith('image/')) addItem(f)
}

function addItem(file: Blob) {
  items.value.push({
    id: 'i' + Date.now() + Math.random().toString(36).slice(2, 6),
    name: (file as File).name || 'image',
    type: file.type || 'image/png',
    original: file,
    compressed: null,
    url: URL.createObjectURL(file),
    outUrl: '',
    quality: globalCfg.quality,
    maxW: globalCfg.maxW,
    format: globalCfg.format,
    busy: true,
  })
  compress(items.value[items.value.length - 1])
}

async function compress(it: Item) {
  // 使用 items.value 中的响应式代理,保证压缩完成状态能刷新到界面
  const target = items.value.find((x) => x.id === it.id) || it
  target.busy = true
  target.error = undefined
  try {
    const bmp = await createImageBitmap(target.original)
    const maxW = target.maxW
    const scale = maxW > 0 && bmp.width > maxW ? maxW / bmp.width : 1
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()

    let type = target.format === 'keep' ? target.type : 'image/' + target.format
    let quality: number | undefined
    if (type === 'image/png') {
      quality = undefined
    } else {
      quality = target.quality / 100
    }
    // Safari 不支持 toBlob('image/webp') 时回退 jpeg
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    if (!blob) {
      type = 'image/jpeg'
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    }
    if (!blob) throw new Error('编码失败')
    if (target.outUrl) URL.revokeObjectURL(target.outUrl)
    target.compressed = blob
    target.outUrl = URL.createObjectURL(blob)
    target.busy = false
  } catch {
    target.busy = false
    target.error = '压缩失败,该图片可能不被支持'
  }
}

function reapplyAll() {
  for (const it of items.value) {
    it.quality = globalCfg.quality
    it.maxW = globalCfg.maxW
    it.format = globalCfg.format
    void compress(it)
  }
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

function savedPct(it: Item): number | null {
  if (!it.compressed) return null
  const d = 1 - it.compressed.size / it.original.size
  return Math.round(d * 100)
}

function download(it: Item) {
  if (!it.compressed) return
  const ext = it.compressed.type.split('/')[1].replace('jpeg', 'jpg')
  const a = document.createElement('a')
  a.href = it.outUrl
  a.download = it.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext
  a.click()
}

function downloadAll() {
  const ok = items.value.filter((it) => it.compressed)
  if (!ok.length) return
  ok.forEach((it, i) => window.setTimeout(() => download(it), i * 150))
  ElMessage.success(`已开始下载 ${ok.length} 张`)
}

function remove(it: Item) {
  URL.revokeObjectURL(it.url)
  if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  items.value = items.value.filter((x) => x.id !== it.id)
}

function clearAll() {
  for (const it of items.value) {
    URL.revokeObjectURL(it.url)
    if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  }
  items.value = []
}
</script>

<template>
  <div class="ic">
    <div class="head">
      <div>
        <h3 class="title">图片压缩</h3>
        <p class="sub">批量压缩图片,调节质量与最大宽度,支持 WebP 输出</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="Download" :disabled="!items.some((i) => i.compressed)" @click="downloadAll">全部下载</el-button>
        <el-button size="small" :icon="RefreshLeft" :disabled="!items.length" @click="clearAll">清空</el-button>
      </div>
    </div>

    <div class="cfg">
      <span class="lbl">质量</span>
      <el-slider v-model="globalCfg.quality" :min="10" :max="100" style="width: 200px" />
      <span class="val">{{ globalCfg.quality }}%</span>
      <span class="lbl">最大宽度</span>
      <el-select v-model="globalCfg.maxW" style="width: 120px">
        <el-option :value="0" label="保持原尺寸" />
        <el-option v-for="w in [1920, 1280, 1080, 800, 640, 400]" :key="w" :value="w" :label="w + ' px'" />
      </el-select>
      <span class="lbl">输出格式</span>
      <el-select v-model="globalCfg.format" style="width: 110px">
        <el-option value="keep" label="与原图一致" />
        <el-option value="jpeg" label="JPEG" />
        <el-option value="png" label="PNG" />
        <el-option value="webp" label="WebP" />
      </el-select>
      <el-button size="small" :disabled="!items.length" @click="reapplyAll">应用到全部</el-button>
    </div>

    <div v-if="!items.length" class="drop" @click="pickFiles" @dragover.prevent @drop="onDrop">
      <el-icon :size="36"><UploadFilled /></el-icon>
      <p>点击或拖拽图片到此处(支持多选)</p>
    </div>
    <input ref="fileRef" type="file" accept="image/*" multiple hidden @change="onPick" />

    <div v-if="items.length" class="list">
      <div v-for="it in items" :key="it.id" class="row">
        <img class="thumb" :src="it.url" alt="" />
        <div class="info">
          <div class="name">{{ it.name }}</div>
          <div class="sizes">
            原图 {{ fmtSize(it.original.size) }}
            <template v-if="it.compressed">
              → <b :style="{ color: savedPct(it)! >= 0 ? '#16a34a' : '#ef4444' }">{{ fmtSize(it.compressed.size) }}</b>
              <span class="pct" :style="{ color: savedPct(it)! >= 0 ? '#16a34a' : '#ef4444' }">
                {{ savedPct(it)! >= 0 ? '省 ' + savedPct(it) + '%' : '增 ' + -savedPct(it)! + '%' }}
              </span>
            </template>
            <span v-else-if="it.busy" class="busy">压缩中…</span>
            <span v-else-if="it.error" class="err">{{ it.error }}</span>
          </div>
        </div>
        <div class="ops">
          <el-button size="small" text :icon="Picture" @click="pickFiles" />
          <el-button size="small" type="primary" :disabled="!it.compressed" @click="download(it)">下载</el-button>
          <el-button size="small" text :icon="RefreshLeft" @click="compress(it)" />
        </div>
      </div>
      <div class="add" @click="pickFiles">
        <el-icon><Picture /></el-icon>继续添加图片
      </div>
    </div>

    <p class="foot">说明:PNG 为无损格式,质量参数仅影响 JPEG / WebP;把 PNG 转为 JPEG / WebP 通常可大幅减小体积;图片全程在本机内存中处理。</p>
  </div>
</template>

<style scoped>
.ic {
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
.acts {
  display: flex;
  gap: 8px;
}
.cfg {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 42px;
}
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 14px;
  min-height: 180px;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
  transition: border-color 0.15s;
}
.drop:hover {
  border-color: var(--el-color-primary);
}
.drop p {
  margin: 10px 0 0;
  font-size: 13px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
}
.thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex: none;
  background: var(--el-fill-color);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}
.sizes {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sizes b {
  font-variant-numeric: tabular-nums;
}
.pct {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}
.busy {
  color: var(--el-text-color-placeholder);
}
.err {
  color: #ef4444;
}
.ops {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--card-border);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
