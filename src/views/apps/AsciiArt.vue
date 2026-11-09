<script setup lang="ts">
/**
 * 图片转字符画
 * 上传或拖入图片,按亮度映射为字符,生成可复制的 ASCII 字符画;
 * 可调节输出宽度、字符集与反色,并可下载为文本文件。
 */
import { onBeforeUnmount, ref } from 'vue'
import { CopyDocument, Download, Picture, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const CHARSETS = {
  classic: ' .:-=+*#%@',
  blocks: ' .:;+=xX$@',
  simple: ' .*#@',
  dense: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
}

const width = ref(100)
const charsetKey = ref<keyof typeof CHARSETS>('classic')
const invert = ref(false)
const ascii = ref('')
const imgSrc = ref('')
const imgName = ref('')
const fontRatio = 0.5
const fileRef = ref<HTMLInputElement>()
let imgEl: HTMLImageElement | null = null

function pickFile() {
  fileRef.value?.click()
}

async function convert() {
  if (!imgEl) {
    ElMessage.info('请先上传图片')
    return
  }
  const img = imgEl
  const w = Math.max(20, Math.min(240, width.value))
  const h = Math.max(1, Math.round((img.height / img.width) * w * fontRatio))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  const chars = CHARSETS[charsetKey.value]
  let out = ''
  for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      if (a < 128) lum = 1
      if (invert.value) lum = 1 - lum
      const idx = Math.min(chars.length - 1, Math.max(0, Math.round((1 - lum) * (chars.length - 1))))
      line += chars[idx]
    }
    out += line.replace(/\s+$/, '') + '\n'
  }
  ascii.value = out
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) loadFile(file)
}

function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  imgName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    imgSrc.value = String(reader.result)
    const img = new Image()
    img.onload = () => {
      imgEl = img
      convert()
    }
    img.src = imgSrc.value
  }
  reader.readAsDataURL(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

async function copyAscii() {
  if (!ascii.value) return
  await copyText(ascii.value)
  ElMessage.success('已复制')
}

function download() {
  if (!ascii.value) return
  const blob = new Blob([ascii.value], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = (imgName.value.replace(/\.[^.]+$/, '') || 'art') + '.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

function reset() {
  imgSrc.value = ''
  imgName.value = ''
  ascii.value = ''
  imgEl = null
}

onBeforeUnmount(() => {
  imgEl = null
})
</script>

<template>
  <div class="aa">
    <div class="head">
      <div>
        <h3 class="title">图片转字符画</h3>
        <p class="sub">把图片按亮度转换成 ASCII 字符画,可复制或下载</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="CopyDocument" :disabled="!ascii" @click="copyAscii">复制</el-button>
        <el-button size="small" type="primary" :icon="Download" :disabled="!ascii" @click="download">下载 TXT</el-button>
      </div>
    </div>

    <div class="cols">
      <div class="left">
        <div
          class="drop"
          :class="{ has: imgSrc }"
          @dragover.prevent
          @drop="onDrop"
          @click="pickFile"
        >
          <img v-if="imgSrc" :src="imgSrc" class="preview" alt="preview" />
          <div v-else class="drop-hint">
            <el-icon :size="30"><Picture /></el-icon>
            <p>点击或拖拽图片到此处</p>
          </div>
        </div>
        <input ref="fileRef" type="file" accept="image/*" hidden @change="onFile" />

        <div class="opts">
          <div class="opt">
            <span class="o-l">宽度</span>
            <el-slider v-model="width" :min="20" :max="240" @change="convert" />
            <span class="o-v">{{ width }}</span>
          </div>
          <div class="opt">
            <span class="o-l">字符集</span>
            <el-radio-group v-model="charsetKey" size="small" @change="convert">
              <el-radio-button value="classic">经典</el-radio-button>
              <el-radio-button value="simple">简洁</el-radio-button>
              <el-radio-button value="blocks">方块</el-radio-button>
              <el-radio-button value="dense">密集</el-radio-button>
            </el-radio-group>
          </div>
          <div class="opt">
            <el-checkbox v-model="invert" @change="convert">反色</el-checkbox>
            <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
          </div>
        </div>
      </div>

      <pre class="out">{{ ascii || '字符画将显示在这里…' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.aa {
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
.cols {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
}
@media (max-width: 820px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 12px;
  min-height: 180px;
  display: grid;
  place-items: center;
  cursor: pointer;
  overflow: hidden;
  background: var(--el-fill-color-light);
}
.drop.has {
  border-style: solid;
}
.drop-hint {
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.drop-hint p {
  margin: 8px 0 0;
}
.preview {
  max-width: 100%;
  max-height: 220px;
  display: block;
}
.opts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 10px;
}
.o-l {
  width: 48px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.o-v {
  width: 34px;
  font-size: 12px;
  text-align: right;
  flex: none;
}
.opt :deep(.el-slider) {
  flex: 1;
}
.out {
  margin: 0;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  background: #0b1020;
  color: #cbd5e1;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 6px;
  line-height: 1;
  letter-spacing: 0;
  overflow: auto;
  max-height: 560px;
  white-space: pre;
}
</style>
