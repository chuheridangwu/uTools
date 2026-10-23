<script setup lang="ts">
/**
 * 图片批量处理
 * 对一批图片统一做 缩放/压缩/格式转换,列出体积收益并一键全部下载(打包为逐个下载)。
 * 与 ImageConverter 的差别:这里强调"统一规则 + 收益统计 + 全部下载"。
 */
import type { UploadFile } from 'element-plus'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob, formatBytes } from '@/utils/common'
import { calcTargetSize, canvasToBlob, drawImageTo, loadImage, renameWithExt } from '@/utils/image'

interface Row {
  file: File
  img: HTMLImageElement
  blob?: Blob
  w?: number
  h?: number
}

const rows = ref<Row[]>([])
const fmt = ref<'image/jpeg' | 'image/webp' | 'image/png'>('image/jpeg')
const quality = ref(80)
const resizeMode = ref<'percent' | 'width'>('percent')
const percent = ref(60)
const targetWidth = ref(1280)
const busy = ref(false)

function onFiles(files: FileList | File[]) {
  Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .forEach(async (f) => {
      try {
        rows.value.push({ file: f, img: await loadImage(f) })
      } catch {
        ElMessage.warning(`${f.name} 加载失败`)
      }
    })
}

function opts() {
  return resizeMode.value === 'percent' ? { mode: 'percent' as const, percent: percent.value } : { mode: 'width' as const, width: targetWidth.value }
}

async function processOne(r: Row): Promise<void> {
  const { width, height } = calcTargetSize(r.img.naturalWidth, r.img.naturalHeight, opts())
  const canvas = drawImageTo(r.img, width, height, fmt.value === 'image/jpeg' ? '#ffffff' : undefined)
  const q = fmt.value === 'image/png' ? undefined : quality.value / 100
  r.blob = await canvasToBlob(canvas, fmt.value, q)
  r.w = width
  r.h = height
}

async function processAll() {
  if (!rows.value.length) return ElMessage.warning('请先添加图片')
  busy.value = true
  try {
    for (const r of rows.value) await processOne(r)
    ElMessage.success('处理完成')
  } finally {
    busy.value = false
  }
}

async function downloadAll() {
  busy.value = true
  try {
    for (const r of rows.value) {
      if (!r.blob) await processOne(r)
      await new Promise((res) => setTimeout(res, 120))
      downloadBlob(r.blob!, renameWithExt(r.file.name, fmt.value))
    }
  } finally {
    busy.value = false
  }
}

const totalIn = computed(() => rows.value.reduce((s, r) => s + r.file.size, 0))
const totalOut = computed(() => rows.value.reduce((s, r) => s + (r.blob?.size ?? 0), 0))
const saved = computed(() => Math.max(0, totalIn.value - totalOut.value))
const savedPct = computed(() => (totalIn.value ? Math.round((saved.value / totalIn.value) * 100) : 0))

/** 预览地址帮助函数(模板中无法直接使用全局 URL 构造器) */
const objUrlOf = (b: Blob) => URL.createObjectURL(b)

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFiles([f.raw as File])
</script>

<template>
  <ToolPage>
    <template #title>图片批量处理</template>
    <template #desc>批量按 统一缩放/压缩/格式 处理图片,列出体积收益后一键下载全部结果。</template>

    <el-card shadow="never">
      <template #header>加入图片</template>
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" :on-change="onUploadChange" accept="image/*">
        <div class="drop">拖入多张图片或点击上传</div>
      </el-upload>
    </el-card>

    <el-card v-if="rows.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>批量规则</span>
          <span>
            <el-button type="primary" size="small" :loading="busy" @click="processAll">统一处理</el-button>
            <el-button size="small" :loading="busy" @click="downloadAll">全部下载</el-button>
          </span>
        </div>
      </template>
      <el-row :gutter="12">
        <el-col :span="8">
          目标格式
          <el-select v-model="fmt" class="mt8" style="width: 100%">
            <el-option value="image/jpeg" label="JPEG" />
            <el-option value="image/webp" label="WebP" />
            <el-option value="image/png" label="PNG" />
          </el-select>
        </el-col>
        <el-col :span="8">
          缩放方式
          <el-radio-group v-model="resizeMode" class="mt8" size="small">
            <el-radio-button value="percent">按百分比</el-radio-button>
            <el-radio-button value="width">按固定宽度</el-radio-button>
          </el-radio-group>
          <div class="mt8">
            <el-input-number v-if="resizeMode === 'percent'" v-model="percent" :min="1" :max="100" size="small" style="width: 130px" />
            <el-input-number v-else v-model="targetWidth" :min="16" :max="8192" size="small" style="width: 130px" />
            <span class="muted small" style="margin-left: 8px">{{ resizeMode === 'percent' ? '%' : 'px(高度等比)' }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          质量(fmt 有损时生效)
          <el-slider v-model="quality" :min="10" :max="100" class="mt8" />
        </el-col>
      </el-row>
    </el-card>

    <div v-if="rows.length" class="mt12 list">
      <div v-for="(r, i) in rows" :key="i" class="row">
        <img class="mini" :src="objUrlOf(r.blob ?? r.file)" :alt="r.file.name" />
        <div class="flex1">
          <div class="mono name">{{ r.file.name }}</div>
          <div class="muted small">
            {{ r.img.naturalWidth }}×{{ r.img.naturalHeight }} · {{ formatBytes(r.file.size) }}
            <template v-if="r.blob"> → {{ r.w }}×{{ r.h }} · <b>{{ formatBytes(r.blob.size) }}</b></template>
          </div>
        </div>
        <el-progress
          v-if="r.blob"
          type="circle"
          :percentage="Math.max(1, Math.round((1 - r.blob.size / r.file.size) * 100))"
          :width="40"
          :stroke-width="4"
          :color="r.blob.size < r.file.size ? '#67c23a' : '#f56c6c'"
        />
      </div>
    </div>

    <div v-if="rows.length" class="mt12 stats">
      原始 {{ formatBytes(totalIn) }} → 处理后 {{ formatBytes(totalOut) }},累计节省 {{ formatBytes(saved) }}({{ savedPct }}%)
    </div>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.drop { padding: 28px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.list { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; padding: 8px; border: 1px solid var(--card-border); border-radius: 10px; }
.mini { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; background: var(--el-fill-color-lighter); }
.flex1 { flex: 1; min-width: 0; }
.name { font-size: 12.5px; margin-bottom: 4px; }
.small { font-size: 12px; }
.stats { text-align: center; color: var(--el-text-color-secondary); font-size: 13px; }
</style>
