<script setup lang="ts">
/**
 * 图片格式转换
 * 浏览器本地完成 PNG/JPEG/WebP 互转:上传若干图片 → 设定格式/质量/缩放 → 单个或批量下载。
 */
import type { UploadFile } from 'element-plus'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { baseName, downloadBlob, formatBytes } from '@/utils/common'
import { calcTargetSize, canvasToBlob, drawImageTo, loadImage, renameWithExt } from '@/utils/image'

interface Item {
  file: File
  img: HTMLImageElement
  blob?: Blob
  sizeKb?: number
}

const items = ref<Item[]>([])
const targetFormat = ref<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp')
const quality = ref(90)
const resizeMode = ref<'none' | 'percent'>('none')
const percent = ref(100)
const busy = ref(false)

const acceptTypes = 'image/*'

async function onFiles(files: FileList | File[]) {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (!arr.length) return
  for (const f of arr) {
    try {
      const img = await loadImage(f)
      items.value.push({ file: f, img })
    } catch {
      ElMessage.warning(`${f.name} 无法加载`)
    }
  }
}

function opts() {
  return resizeMode.value === 'percent' ? { mode: 'percent' as const, percent: percent.value } : { mode: 'none' as const }
}

/** 单张转换,返回 Blob */
async function convertOne(it: Item): Promise<Blob> {
  const size = calcTargetSize(it.img.naturalWidth, it.img.naturalHeight, opts())
  const needBg = targetFormat.value === 'image/jpeg'
  const canvas = drawImageTo(it.img, size.width, size.height, needBg ? '#ffffff' : undefined)
  const q = targetFormat.value === 'image/png' ? undefined : quality.value / 100
  return canvasToBlob(canvas, targetFormat.value, q)
}

async function previewOne(it: Item) {
  it.blob = await convertOne(it)
  it.sizeKb = Math.round((it.blob.size / 1024) * 100) / 100
}

/** 全部转换 */
async function convertAll() {
  busy.value = true
  try {
    for (const it of items.value) await previewOne(it)
    ElMessage.success('全部转换完成')
  } finally {
    busy.value = false
  }
}

function downloadOne(it: Item) {
  if (!it.blob) return
  downloadBlob(it.blob, renameWithExt(it.file.name, targetFormat.value))
}

async function downloadAll() {
  busy.value = true
  try {
    for (const it of items.value) {
      if (!it.blob) it.blob = await convertOne(it)
      await new Promise((r) => setTimeout(r, 120)) // 避免浏览器拦截多文件下载
      downloadOne(it)
    }
  } finally {
    busy.value = false
  }
}

function removeItem(i: number) {
  items.value.splice(i, 1)
}

function clearAll() {
  items.value = []
}

const totalIn = computed(() => items.value.reduce((s, i) => s + i.file.size, 0))
const totalOut = computed(() => items.value.reduce((s, i) => s + (i.blob?.size ?? 0), 0))

/** 预览地址帮助函数(模板中无法直接使用全局 URL 构造器) */
const objUrlOf = (b: Blob) => URL.createObjectURL(b)

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFiles([f.raw as File])
</script>

<template>
  <ToolPage>
    <template #title>图片格式转换</template>
    <template #desc>PNG / JPEG / WebP 本地互转,可指定质量与缩放比例,单个预览或批量下载。</template>

    <el-card shadow="never">
      <template #header>输入图片</template>
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" :on-change="onUploadChange" :accept="acceptTypes">
        <div class="drop">拖入图片或点击上传(支持批量)</div>
      </el-upload>
      <div class="mt8" style="display: flex; gap: 8px">
        <el-button size="small" @click="clearAll" :disabled="!items.length">清空列表</el-button>
      </div>
    </el-card>

    <el-card v-if="items.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>转换选项</span>
          <el-button type="primary" size="small" :loading="busy" @click="convertAll">全部转换</el-button>
        </div>
      </template>
      <el-row :gutter="12">
        <el-col :span="6">目标格式
          <el-select v-model="targetFormat" class="mt8" style="width: 100%">
            <el-option value="image/png" label="PNG(无损)" />
            <el-option value="image/jpeg" label="JPEG(有损)" />
            <el-option value="image/webp" label="WebP(压缩率高)" />
          </el-select>
        </el-col>
        <el-col :span="6">质量(仅 JPEG/WebP)
          <el-slider v-model="quality" :min="10" :max="100" class="mt8" show-input />
        </el-col>
        <el-col :span="6">缩放比例
          <el-input-number v-model="percent" :min="1" :max="400" class="mt8" style="width: 130px" size="small" />
          <div class="muted small">100% = 保持原始尺寸</div>
        </el-col>
      </el-row>
    </el-card>

    <div v-if="items.length" class="mt12 grid">
      <el-card v-for="(it, i) in items" :key="i" shadow="never">
        <div class="thumb">
          <img :src="objUrlOf(it.blob ?? it.file)" :alt="it.file.name" />
        </div>
        <div class="name mono">{{ it.file.name }}</div>
        <div class="muted small">
          {{ it.img.naturalWidth }}×{{ it.img.naturalHeight }} · {{ formatBytes(it.file.size) }}
          <template v-if="it.blob"> → {{ formatBytes(it.blob.size) }}</template>
        </div>
        <div class="btns">
          <el-button size="small" :disabled="busy" @click="previewOne(it)">转换</el-button>
          <el-button size="small" type="primary" :disabled="!it.blob" @click="downloadOne(it)">下载</el-button>
          <el-button size="small" text @click="removeItem(i)">移除</el-button>
        </div>
      </el-card>
    </div>

    <div v-if="items.length" class="mt12">
      <el-button type="primary" :loading="busy" @click="downloadAll">全部下载</el-button>
      <span class="muted small" style="margin-left: 12px">
        共 {{ items.length }} 张,原始 {{ formatBytes(totalIn) }} → 转换后 {{ formatBytes(totalOut) }}
      </span>
    </div>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.drop { padding: 32px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.thumb { width: 100%; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; background: var(--el-fill-color-lighter); border-radius: 8px; overflow: hidden; }
.thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
.name { font-size: 12px; margin-top: 8px; word-break: break-all; }
.btns { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
.small { font-size: 12px; }
</style>
