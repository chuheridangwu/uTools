<script setup lang="ts">
/**
 * 九宫格切图
 * 上传图片后按正方形裁剪并切成 3×3(或 2×2 / 3×1)小图,
 * 可单独或批量下载,适合朋友圈、微博等九宫格发布。
 */
import { reactive, ref } from 'vue'
import { Download, Picture, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const fileRef = ref<HTMLInputElement>()
const imgSrc = ref('')
const imgName = ref('')
const tiles = ref<string[]>([])
const preview = reactive<{ cols: number; rows: number; count: number }>({ cols: 3, rows: 3, count: 9 })

const modes = [
  { key: '3x3', cols: 3, rows: 3, label: '九宫格 3×3' },
  { key: '2x2', cols: 2, rows: 2, label: '四宫格 2×2' },
  { key: '3x1', cols: 3, rows: 1, label: '横三格 3×1' },
  { key: '1x3', cols: 1, rows: 3, label: '竖三格 1×3' },
]
const modeKey = ref('3x3')

function pickFile() {
  fileRef.value?.click()
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
  imgName.value = file.name.replace(/\.[^.]+$/, '')
  const reader = new FileReader()
  reader.onload = () => {
    imgSrc.value = String(reader.result)
    const img = new Image()
    img.onload = () => cut(img)
    img.src = imgSrc.value
  }
  reader.readAsDataURL(file)
}

function cut(img: HTMLImageElement) {
  const m = modes.find((x) => x.key === modeKey.value) || modes[0]
  preview.cols = m.cols
  preview.rows = m.rows
  preview.count = m.cols * m.rows

  // 居中裁剪为正方形(保持较短边)
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side)

  const out: string[] = []
  const tw = Math.floor(side / m.cols)
  const th = Math.floor(side / m.rows)
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const tc = document.createElement('canvas')
      tc.width = tw
      tc.height = th
      const tctx = tc.getContext('2d')!
      tctx.drawImage(canvas, c * tw, r * th, tw, th, 0, 0, tw, th)
      out.push(tc.toDataURL('image/png'))
    }
  }
  tiles.value = out
}

function regen() {
  if (!imgSrc.value) return
  const img = new Image()
  img.onload = () => cut(img)
  img.src = imgSrc.value
}

function downloadOne(dataUrl: string, i: number) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${imgName.value || 'tile'}_${i + 1}.png`
  a.click()
}

function downloadAll() {
  if (!tiles.value.length) return
  tiles.value.forEach((t, i) => {
    window.setTimeout(() => downloadOne(t, i), i * 150)
  })
  ElMessage.success(`已开始下载 ${tiles.value.length} 张图片`)
}

function reset() {
  imgSrc.value = ''
  imgName.value = ''
  tiles.value = []
}
</script>

<template>
  <div class="ng">
    <div class="head">
      <div>
        <h3 class="title">九宫格切图</h3>
        <p class="sub">把图片居中裁剪并切成宫格,一键下载用于发布</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="Download" :disabled="!tiles.length" @click="downloadAll">批量下载</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
      </div>
    </div>

    <div class="modes">
      <el-radio-group v-model="modeKey" size="small" @change="regen">
        <el-radio-button v-for="m in modes" :key="m.key" :value="m.key">{{ m.label }}</el-radio-button>
      </el-radio-group>
    </div>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onFile" />
    <div v-if="!imgSrc" class="drop" @click="pickFile">
      <el-icon :size="34"><Picture /></el-icon>
      <p>点击选择图片</p>
    </div>

    <template v-else>
      <div class="source">
        <img :src="imgSrc" class="src-img" alt="source" />
        <div class="src-meta">
          <div class="m-name">{{ imgName || '图片' }}</div>
          <div class="m-info">已生成 {{ tiles.length }} 张宫格(共 {{ preview.cols }} × {{ preview.rows }})</div>
          <el-button size="small" @click="pickFile">更换图片</el-button>
        </div>
      </div>

      <div class="grid" :style="{ gridTemplateColumns: 'repeat(' + preview.cols + ', 1fr)' }">
        <div v-for="(t, i) in tiles" :key="i" class="tile" @click="downloadOne(t, i)">
          <img :src="t" :alt="'tile ' + (i + 1)" />
          <span class="tile-idx">{{ i + 1 }}</span>
          <span class="tile-dl"><el-icon><Download /></el-icon></span>
        </div>
      </div>

      <p class="foot">提示:切图前会以图片中心裁剪为正方形;点击任意小图即可单独下载,也可点右上角批量下载。</p>
    </template>
  </div>
</template>

<style scoped>
.ng {
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
.modes {
  margin-bottom: 16px;
}
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 14px;
  min-height: 200px;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}
.drop p {
  margin: 8px 0 0;
  font-size: 13px;
}
.source {
  display: flex;
  gap: 16px;
  align-items: center;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
}
.src-img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  flex: none;
}
.src-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.m-name {
  font-size: 15px;
  font-weight: 600;
}
.m-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.grid {
  display: grid;
  gap: 8px;
  max-width: 560px;
}
.tile {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--card-border);
}
.tile img {
  width: 100%;
  display: block;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
.tile-idx {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 11px;
  background: rgb(0 0 0 / 45%);
  color: #fff;
  padding: 1px 6px;
  border-radius: 6px;
}
.tile-dl {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 22px;
  background: rgb(0 0 0 / 35%);
  opacity: 0;
  transition: opacity 0.15s;
}
.tile:hover .tile-dl {
  opacity: 1;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
