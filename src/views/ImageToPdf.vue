<script setup lang="ts">
/**
 * 图片转 PDF
 * 使用 jsPDF 把多张图片按顺序合成为多页 PDF(jspdf 已在依赖中);
 * 每页尺寸可选 A4/原始/自定义,自动按图片比例留白。
 */
import type { UploadFile } from 'element-plus'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { jsPDF } from 'jspdf'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import { loadImage } from '@/utils/image'

interface Item {
  file: File
  img: HTMLImageElement
}

const items = ref<Item[]>([])
const pageSize = ref<'a4' | 'image'>('a4')
const orientation = ref<'p' | 'l'>('p')
const margin = ref(20)
const busy = ref(false)

const PT = { a4: { w: 595.28, h: 841.89 } } // A4 单位 pt

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
  const a = items.value
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

const total = computed(() => items.value.length)

async function generate() {
  if (!items.value.length) {
    ElMessage.warning('请先添加图片')
    return
  }
  busy.value = true
  try {
    let doc: jsPDF | null = null
    for (const it of items.value) {
      // 页面尺寸
      let pw: number
      let ph: number
      if (pageSize.value === 'image') {
        pw = it.img.naturalWidth
        ph = it.img.naturalHeight
      } else {
        pw = PT.a4.w
        ph = PT.a4.h
      }
      const landscape = orientation.value === 'l' && pageSize.value === 'a4'
      if (landscape) {
        const t = pw
        pw = ph
        ph = t
      }
      if (!doc) {
        doc = new jsPDF({ unit: 'pt', format: [pw, ph], orientation: landscape ? 'landscape' : 'portrait' })
      } else {
        doc.addPage([pw, ph], landscape ? 'landscape' : 'portrait')
      }
      // 图片在页内等比适配
      const m = pageSize.value === 'image' ? 0 : margin.value
      const availW = pw - m * 2
      const availH = ph - m * 2
      const scale = Math.min(availW / it.img.naturalWidth, availH / it.img.naturalHeight)
      const dw = it.img.naturalWidth * scale
      const dh = it.img.naturalHeight * scale
      // JPEG 需要 canvas 转换;PNG 可直接用文件
      let dataUrl: string
      let fmt: 'JPEG' | 'PNG'
      if (it.file.type === 'image/png') {
        dataUrl = await fileToDataUrl(it.file)
        fmt = 'PNG'
      } else {
        dataUrl = await imageToJpegDataUrl(it.img)
        fmt = 'JPEG'
      }
      doc.addImage(dataUrl, fmt, (pw - dw) / 2, (ph - dh) / 2, dw, dh)
    }
    const blob = doc!.output('blob')
    downloadBlob(blob, `images-${Date.now()}.pdf`)
    ElMessage.success('PDF 已生成')
  } finally {
    busy.value = false
  }
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(f)
  })
}

function imageToJpegDataUrl(img: HTMLImageElement): Promise<string> {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0)
  return Promise.resolve(c.toDataURL('image/jpeg', 0.92))
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => { const raw = f.raw; if (!raw) return; onFiles([raw as File]) }
</script>

<template>
  <ToolPage>
    <template #title>图片转 PDF</template>
    <template #desc>把若干图片按顺序合成为多页 PDF,每页等比留白,支持 A4 或按图片尺寸成页。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>图片列表</span>
        </div>
      </template>
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="onUploadChange">
        <div class="drop">拖入多张图片</div>
      </el-upload>
    </el-card>

    <el-card v-if="items.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>PDF 设置</span>
          <el-button type="primary" size="small" :loading="busy" @click="generate">生成并下载 PDF</el-button>
        </div>
      </template>
      <el-row :gutter="12">
        <el-col :span="8">
          页面尺寸
          <el-select v-model="pageSize" class="mt8" style="width: 100%">
            <el-option value="a4" label="A4 固定页" />
            <el-option value="image" label="按图片尺寸成页" />
          </el-select>
        </el-col>
        <el-col :span="8" v-if="pageSize === 'a4'">
          方向
          <el-radio-group v-model="orientation" class="mt8">
            <el-radio-button value="p">纵向</el-radio-button>
            <el-radio-button value="l">横向</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="8" v-if="pageSize === 'a4'">
          边距 {{ margin }} pt
          <el-slider v-model="margin" :min="0" :max="80" class="mt8" />
        </el-col>
      </el-row>
    </el-card>

    <div v-if="items.length" class="mt12 thumbs">
      <div v-for="(it, i) in items" :key="i" class="thumb">
        <img :src="it.img.src" :alt="it.file.name" />
        <div class="ord">#{{ i + 1 }}</div>
        <div class="bar">
          <el-button size="small" text :disabled="i === 0" @click="move(i, -1)">↑</el-button>
          <el-button size="small" text :disabled="i === total - 1" @click="move(i, 1)">↓</el-button>
        </div>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.drop { padding: 24px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.thumbs { display: flex; gap: 10px; flex-wrap: wrap; }
.thumb { position: relative; width: 110px; }
.thumb img { width: 110px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--card-border); }
.ord { position: absolute; top: 2px; left: 4px; font-size: 11px; color: #fff; background: rgba(0, 0, 0, 0.5); padding: 1px 6px; border-radius: 6px; }
.bar { display: flex; justify-content: center; }
</style>
