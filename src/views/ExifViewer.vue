<script setup lang="ts">
/**
 * EXIF 查看
 * 使用 exifr 解析照片元数据:相机、镜头、曝光、ISO、焦距、GPS、拍摄时间等,本地读取不上传。
 */
import type { UploadFile } from 'element-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as exifr from 'exifr'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

interface Row {
  group: string
  key: string
  value: string
}

const file = ref<File | null>(null)
const rows = ref<Row[]>([])
const thumbUrl = ref('')
/** 解析到的 GPS 经纬度,用于高德链接 */
const gps = ref<{ lat: number; lon: number } | null>(null)

const KERNEL_KEYS: Record<string, string> = {
  Make: '厂商',
  Model: '型号',
  LensModel: '镜头',
  LensMake: '镜头厂商',
  FNumber: '光圈',
  ExposureTime: '曝光时间',
  ExposureProgram: '曝光程序',
  ISO: 'ISO',
  ISOSpeedRatings: 'ISO',
  FocalLength: '焦距',
  ColorSpace: '色域',
  WhiteBalance: '白平衡',
  Flash: '闪光灯',
  MeteringMode: '测光',
  CreateDate: '拍摄时间',
  DateTimeOriginal: '原始时间',
  ModifyDate: '修改时间',
  Orientation: '方向',
  Software: '软件',
}

/** 有些值需要加工(如曝光时间 1/125) */
function fmtVal(k: string, v: unknown): string {
  if (v == null) return ''
  if (k === 'ExposureTime' && typeof v === 'number') {
    if (v < 1) return `1/${Math.round(1 / v)} s`
    return `${v} s`
  }
  if (k === 'FocrLength' && typeof v === 'number') return `${v} mm`
  if (k === 'FNumber' && typeof v === 'number') return `f/${v}`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function onFile(f: File) {
  file.value = f
  gps.value = null
  rows.value = []
  try {
    // 分两块解析:ht_ 通用 exif 块 + GPS 块
    const data = await exifr.parse(f, { tiff: true, exif: true, gps: true, interop: true, translateValues: true })
    if (!data) {
      ElMessage.warning('未解析到 EXIF 数据')
      return
    }
    const groupMap: Record<string, Array<[string, string]>> = {}
    const push = (g: string, k: string, v: string) => {
      if (!v) return
      ;(groupMap[g] ??= []).push([k, v])
    }
    // 优先的kernel字段逐条呈现
    for (const [k, name] of Object.entries(KERNEL_KEYS)) {
      if (data[k] != null) push('核心', name, fmtVal(k, data[k]))
    }
    // 其余 exif 键兜底列出
    for (const [k, v] of Object.entries(data)) {
      if (KERNEL_KEYS[k]) continue
      if (k.startsWith('Thumbnail')) continue
      if (k === 'GPSLatitude' || k === 'GPSLongitude') continue
      if (k === 'latitude' || k === 'longitude') {
        const lat = data.latitude ?? k === 'latitude' ? v : undefined as number | undefined
        void lat
        continue
      }
      if (typeof v === 'object' || typeof v === 'function') continue
      push('其他', k, fmtVal(k, v))
    }
    if (data.latitude != null && data.longitude != null) {
      gps.value = { lat: data.latitude, lon: data.longitude }
      push('核心', 'GPS 纬度', data.latitude.toFixed(6))
      push('核心', 'GPS 经度', data.longitude.toFixed(6))
    }
    rows.value = Object.entries(groupMap).flatMap(([g, items]) => items.map(([k, v]) => ({ group: g, key: k, value: v })))
    // 缩略图预览
    thumbUrl.value = URL.createObjectURL(f)
  } catch (e) {
    ElMessage.error(`解析失败: ${(e as Error).message}`)
  }
}

/** 导出 JSON */
function exportJson() {
  const obj = Object.fromEntries(rows.value.map((r) => [`${r.group}.${r.key}`, r.value]))
  downloadText('exif.json', JSON.stringify(obj, null, 2))
}

function copyEl(k: string, v: string) {
  copyText(v)
  ElMessage.success(`${k} 已复制`)
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>EXIF 查看</template>
    <template #desc>本地读取 JPG/HEIC 等照片的 EXIF 元数据:相机、曝光、ISO、焦距、GPS,不上传原图。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>照片</span>
          <span>
            <el-upload :show-file-list="false" :auto-upload="false" accept="image/jpeg,image/heic,image/heif,image/png" :on-change="onUploadChange">
              <el-button size="small" type="primary">选择照片</el-button>
            </el-upload>
            <el-button size="small" :disabled="!rows.length" @click="copyText(rows.map(r => `${r.key}: ${r.value}`).join('\n'))">复制全部</el-button>
            <el-button size="small" :disabled="!rows.length" @click="exportJson">导出 JSON</el-button>
          </span>
        </div>
      </template>
      <template v-if="file">
        <div class="preview">
          <img v-if="thumbUrl" :src="thumbUrl" :alt="file.name" class="ph" />
          <div class="mini-info">
            <div class="mono">{{ file.name }}</div>
            <div class="muted small">{{ (file.size / 1024).toFixed(1) }} KB</div>
          </div>
        </div>

        <el-empty v-if="!rows.length" description="该照片没有可读取的 EXIF" class="mt12" />
        <el-descriptions v-else :column="2" border class="mt12" size="small">
          <el-descriptions-item
            v-for="(r, i) in rows"
            :key="i"
            :label="r.key"
            label-class-name="el"
            :class-name="r.group === '核心' ? 'kw' : 'oth'"
          >
            <span @click="copyEl(r.key, r.value)" class="clickable">{{ r.value }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="先选择一张照片" />
    </el-card>

    <el-alert v-if="gps" class="mt8" type="info" :closable="false">
      <template #title>GPS 坐标</template>
      {{ gps.lat.toFixed(6) }}, {{ gps.lon.toFixed(6) }}
      <a class="pl" :href="`https://ditu.amap.com/search?query=${gps.lat.toFixed(6)},${gps.lon.toFixed(6)}`" target="_blank" rel="noopener">高德地图打开</a>
      <a class="pl" :href="`https://www.google.com/maps?q=${gps.lat},${gps.lon}`" target="_blank" rel="noopener">
        Google Maps
      </a>
    </el-alert>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.preview { display: flex; align-items: center; gap: 12px; }
.ph { max-width: 260px; max-height: 180px; object-fit: contain; border-radius: 6px; border: 1px solid var(--card-border); }
.mini-info { font-size: 12px; }
.small { font-size: 11px; }
.clickable { cursor: pointer; }
.kw { background: var(--el-color-primary-light-9); }
.oth { color: var(--el-text-color-secondary); }
.pl { margin-left: 12px; color: var(--el-color-primary); }
</style>
