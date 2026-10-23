<script setup lang="ts">
/**
 * 长图拼接
 * 多张图片按顺序拼接为一张长图:横向或纵向,可设定 间距/对齐/背景色/最大宽度。
 */
import type { UploadFile } from 'element-plus'
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import { canvasToBlob, loadImage, renameWithExt } from '@/utils/image'

interface Item {
  file: File
  img: HTMLImageElement
}

const items = ref<Item[]>([])
const direction = ref<'vertical' | 'horizontal'>('vertical')
const gap = ref(10)
const alignment = ref<'start' | 'center' | 'end'>('center')
const bgColor = ref('#ffffff')
const maxWidth = ref(1080)

const canvasRef = ref<HTMLCanvasElement | null>(null)

function onFiles(files: FileList | File[]) {
  Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .forEach(async (f) => {
      try {
        items.value.push({ file: f, img: await loadImage(f) })
      } catch {
        ElMessage.warning(`${f.name} 加载失败`)
      }
    })
}

function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
}

function clearAll() {
  items.value = []
}

/** 根据参数计算目标尺寸 */
const outSize = computed(() => {
  const imgs = items.value.map((it) => it.img)
  if (!imgs.length) return { w: 0, h: 0 }
  if (direction.value === 'vertical') {
    const w = Math.min(maxWidth.value, Math.max(...imgs.map((i) => i.naturalWidth)))
    const scaled = imgs.map((i) => ({ w, h: Math.round((i.naturalHeight / i.naturalWidth) * w) }))
    return { w, h: scaled.reduce((s, x) => s + x.h, 0) + gap.value * (imgs.length - 1) }
  }
  // 横向:以最小高度为准缩放
  const h = Math.min(...imgs.map((i) => i.naturalHeight))
  const scaled = imgs.map((i) => ({ h, w: Math.round((i.naturalWidth / i.naturalHeight) * h) }))
  return { w: scaled.reduce((s, x) => s + x.w, 0) + gap.value * (imgs.length - 1), h }
})

function render() {
  const c = canvasRef.value
  if (!c || !items.value.length) return
  const { w, h } = outSize.value
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, w, h)

  let cursor = 0
  for (const it of items.value) {
    const src = it.img
    if (direction.value === 'vertical') {
      const dh = Math.round((src.naturalHeight / src.naturalWidth) * w)
      ctx.drawImage(src, 0, cursor, w, dh)
      cursor += dh + gap.value
    } else {
      const dh = Math.min(...items.value.map((x) => x.img.naturalHeight))
      const dw = Math.round((src.naturalWidth / src.naturalHeight) * dh)
      const yOff = alignment.value === 'start' ? 0 : alignment.value === 'end' ? h - dh : (h - dh) / 2
      ctx.drawImage(src, cursor, yOff, dw, dh)
      cursor += dw + gap.value
    }
  }
}

/** 拼接并下载 */
async function download() {
  const c = canvasRef.value
  if (!c || !items.value.length) return
  const blob = await canvasToBlob(c, 'image/png')
  downloadBlob(blob, `stitch-${Date.now()}.png`)
}

watch([items.value, direction, gap, alignment, bgColor, maxWidth], () => render(), { deep: true })

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => { const raw = f.raw; if (!raw) return; onFiles([raw as File]) }
</script>

<template>
  <ToolPage>
    <template #title>长图拼接</template>
    <template #desc>多张图片按顺序拼接成一张长图,支持纵向/横向、间距、对齐与背景色,实时预览。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>加入图片(按列表顺序拼接)</span>
          <el-button v-if="items.length" size="small" @click="clearAll">清空</el-button>
        </div>
      </template>
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="onUploadChange">
        <div class="drop">拖入多张图片</div>
      </el-upload>
    </el-card>

    <el-row v-if="items.length" :gutter="16" class="mt12">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>拼接设置</template>
          <div class="form">
            <div class="lab">方向</div>
            <el-radio-group v-model="direction" size="small">
              <el-radio-button value="vertical">纵向(长条)</el-radio-button>
              <el-radio-button value="horizontal">横向(宽幅)</el-radio-button>
            </el-radio-group>
            <div class="lab">间距 {{ gap }} px</div>
            <el-slider v-model="gap" :min="0" :max="100" size="small" />
            <div class="lab" v-if="direction === 'vertical'">限制宽度 {{ maxWidth }} px</div>
            <el-slider v-if="direction === 'vertical'" v-model="maxWidth" :min="240" :max="3000" size="small" />
            <div class="lab" v-if="direction === 'horizontal'">对齐</div>
            <el-radio-group v-if="direction === 'horizontal'" v-model="alignment" size="small">
              <el-radio-button value="start">顶对齐</el-radio-button>
              <el-radio-button value="center">居中</el-radio-button>
              <el-radio-button value="end">底对齐</el-radio-button>
            </el-radio-group>
            <div class="lab">背景色</div>
            <el-color-picker v-model="bgColor" size="small" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never" :body-style="{ padding: '0' }">
          <template #header>
            <div class="head">
              <span>预览({{ outSize.w }}×{{ outSize.h }})</span>
              <el-button type="primary" size="small" @click="download">下载长图</el-button>
            </div>
          </template>
          <div class="stage">
            <canvas ref="canvasRef"></canvas>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div v-if="items.length" class="mt12 thumbs">
      <div v-for="(it, i) in items" :key="i" class="thumb">
        <img :src="it.img.src" :alt="it.file.name" />
        <div class="bar">
          <el-button size="small" text :disabled="i === 0" @click="move(i, -1)">上移</el-button>
          <el-button size="small" text :disabled="i === items.length - 1" @click="move(i, 1)">下移</el-button>
        </div>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.drop { padding: 24px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.form { display: flex; flex-direction: column; gap: 4px; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; }
.stage { max-height: 460px; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 12px; background: var(--el-fill-color-lighter); }
.stage canvas { max-width: 100%; }
.thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
.thumb { width: 96px; text-align: center; }
.thumb img { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; }
.bar { display: flex; justify-content: center; }
</style>
