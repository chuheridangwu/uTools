<script setup lang="ts">
/**
 * GIF 动图制作
 * 使用 gifenc 引擎本地编码:选多张图片 → 设定帧率/尺寸 → 合成并预览 GIF。
 * 帧数据按 RGBA 拿到 ImageData 后走 gifenc 的 quantize/applyPalette/writeFrame 流程。
 */
import type { UploadFile } from 'element-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import { loadImage } from '@/utils/image'

// gifenc 的 ESM 导出:GIFEncoder 系列(这里是函数式 API)
// frame 数据: Uint8ClampedArray RGBA → 每帧调 writeFrame;结束时 bytes() 拿 Uint8Array。

interface Item {
  file: File
  img: HTMLImageElement
  url: string
}

const items = ref<Item[]>([])
const targetWidth = ref(480)
const fps = ref(10)
const loops = ref(0) // 0 = 无限循环
const bgColor = ref('#ffffff')
const busy = ref(false)
const gifUrl = ref('')

function onFiles(files: FileList | File[]) {
  Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .forEach(async (f) => {
      try {
        const img = await loadImage(f)
        items.value.push({ file: f, img, url: img.src })
      } catch {
        ElMessage.warning(`${f.name} 加载失败`)
      }
    })
}

function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= items.value.length) return
  const a = items.value
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

function removeItem(i: number) {
  items.value.splice(i, 1)
}

function clearAll() {
  items.value = []
  gifUrl.value = ''
}

/** 用 gifenc 合成 GIF Blob */
async function buildGif(): Promise<Blob> {
  if (!items.value.length) throw new Error('没有图片')
  const w = Math.max(16, targetWidth.value)
  // 用第一帧决定高度基准,但允许每帧等比缩放(高度可能不同,统一以第一张比例为基准会对不齐)
  // 简单做法:每帧都缩放到目标宽度,高度按第一张图比例 → 统一画布,不满的地方用背景填
  const ratio = items.value[0].img.naturalHeight / items.value[0].img.naturalWidth
  const h = Math.max(16, Math.round(w * ratio))
  const bg = hexToRgb(bgColor.value)

  const frames: Array<{ data: Uint8Array; palette: number[][] }> = []
  // 先把每帧都画到统一的 RGB 缓冲
  for (const it of items.value) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, w, h)
    const dh = Math.round((it.img.naturalHeight / it.img.naturalWidth) * w)
    const scale = Math.min(w / it.img.naturalWidth, h / it.img.naturalHeight)
    const dw = it.img.naturalWidth * scale
    ctx.drawImage(it.img, 0, Math.max(0, (h - dh) / 2), dw, dh)
    const id = ctx.getImageData(0, 0, w, h)
    const palette = quantize(id.data, 256)
    const indexed = applyPalette(id.data, palette)
    frames.push({ data: indexed, palette })
  }
  const delay = Math.round(1000 / Math.max(1, fps.value))
  const encoder = GIFEncoder()
  encoder.setRepeat(loops.value) // 0 = 无限
  for (const f of frames) {
    encoder.writeFrame(f.data, w, h, {
      palette: f.palette,
      delay,
    })
  }
  encoder.finish()
  const bytes = encoder.bytes()
  return new Blob([bytes as unknown as BlobPart], { type: 'image/gif' })
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '')
  const n = parseInt(s.length === 3 ? s.replace(/(.)/g, '$1$1') : s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function generate() {
  if (!items.value.length) return ElMessage.warning('请先添加图片')
  busy.value = true
  try {
    const blob = await buildGif()
    if (gifUrl.value) URL.revokeObjectURL(gifUrl.value)
    gifUrl.value = URL.createObjectURL(blob)
    ;(window as unknown as { __lastGif?: Blob }).__lastGif = blob
    ElMessage.success('GIF 已生成')
  } catch (e) {
    ElMessage.error(`生成失败: ${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

function download() {
  const b = (window as unknown as { __lastGif?: Blob }).__lastGif
  if (b) downloadBlob(b, `gif-${Date.now()}.gif`)
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => { const raw = f.raw; if (!raw) return; onFiles([raw as File]) }
</script>

<template>
  <ToolPage>
    <template #title>GIF 制作</template>
    <template #desc>把多张图片按帧顺序合成 GIF 动图,可调帧率与目标宽度,使用 gifenc 引擎本地编码。</template>

    <el-card shadow="never">
      <template #header>帧图片</template>
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="onUploadChange">
        <div class="drop">拖入多张图片作为帧</div>
      </el-upload>
    </el-card>

    <el-row v-if="items.length" :gutter="16" class="mt12">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>参数</span>
              <span>
                <el-button size="small" type="primary" :loading="busy" @click="generate">生成 GIF</el-button>
                <el-button size="small" :disabled="!gifUrl" @click="download">下载</el-button>
              </span>
            </div>
          </template>
          <div class="form">
            <div class="lab">目标宽度 {{ targetWidth }} px</div>
            <el-slider v-model="targetWidth" :min="64" :max="1280" size="small" />
            <div class="lab">帧率 {{ fps }} fps(每帧 {{ Math.round(1000 / Math.max(1, fps)) }}ms)</div>
            <el-slider v-model="fps" :min="1" :max="30" size="small" />
            <div class="lab">循环次数</div>
            <el-radio-group v-model="loops" size="small">
              <el-radio-button :value="0">无限</el-radio-button>
              <el-radio-button :value="1">一次</el-radio-button>
              <el-radio-button :value="3">三次</el-radio-button>
            </el-radio-group>
            <div class="lab">背景色</div>
            <el-color-picker v-model="bgColor" size="small" />
          </div>
        </el-card>

        <el-card v-if="gifUrl" shadow="never" class="mt12">
          <template #header>预览</template>
          <div class="stage">
            <img :src="gifUrl" class="gif" alt="GIF 预览" />
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <div class="thumbs">
          <div v-for="(it, i) in items" :key="i" class="thumb">
            <img :src="it.img.src" :alt="it.file.name" />
            <div class="ord">#{{ i + 1 }}</div>
            <div class="bar">
              <el-button size="small" text :disabled="i === 0" @click="move(i, -1)">↑</el-button>
              <el-button size="small" text :disabled="i === items.length - 1" @click="move(i, 1)">↓</el-button>
              <el-button size="small" text type="danger" @click="removeItem(i)">删</el-button>
            </div>
          </div>
        </div>
        <el-button size="small" @click="clearAll" class="mt8">清空列表</el-button>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.drop { padding: 24px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.form { display: flex; flex-direction: column; gap: 4px; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; }
.stage { display: flex; align-items: center; justify-content: center; padding: 10px; background: var(--el-fill-color-lighter); border-radius: 8px; }
.gif { max-width: 100%; max-height: 320px; }
.thumbs { display: flex; gap: 10px; flex-wrap: wrap; }
.thumb { width: 96px; }
.thumb img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--card-border); }
.thumb { position: relative; }
.ord { position: absolute; top: 2px; left: 4px; font-size: 10px; color: #fff; background: rgba(0, 0, 0, 0.45); padding: 1px 5px; border-radius: 6px; }
.bar { display: flex; justify-content: center; }
</style>
