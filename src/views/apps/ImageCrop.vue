<script setup lang="ts">
/**
 * 图片裁切
 * 上传图片后按比例(1:1 / 4:3 / 16:9 / 9:16 / 3:4)在取景框内拖动取景,
 * 支持滚轮与滑杆缩放、圆形(透明背景)输出;导出 PNG / JPEG / WebP 并下载。
 */
import { computed, reactive, ref } from 'vue'
import { Download, RefreshLeft, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const fileRef = ref<HTMLInputElement>()
const imgSrc = ref('')
const imgName = ref('')
const dragging = ref(false)

const RATIOS = [
  { key: '1:1', label: '1:1 头像', w: 1, h: 1 },
  { key: '4:3', label: '4:3', w: 4, h: 3 },
  { key: '16:9', label: '16:9', w: 16, h: 9 },
  { key: '9:16', label: '9:16 竖屏', w: 9, h: 16 },
  { key: '3:4', label: '3:4', w: 3, h: 4 },
]

const cfg = reactive({
  probe: 320,     // 取景框基准边长
  ratioKey: '1:1',
  circle: false,
  zoom: 1,
  offsetX: 0,     // 平移(px,预览坐标,取值 ≤0)
  offsetY: 0,
  format: 'png',
})

const ratio = computed(() => RATIOS.find((r) => r.key === cfg.ratioKey) || RATIOS[0])

/** 取景框宽高:横图取长边 = probe,竖图取高边 = probe */
const frameW = computed(() => {
  const r = ratio.value
  return r.w >= r.h ? cfg.probe : Math.round((cfg.probe * r.w) / r.h)
})
const frameH = computed(() => {
  const r = ratio.value
  return r.h >= r.w ? cfg.probe : Math.round((cfg.probe * r.h) / r.w)
})

function clamp(v: number, slack: number): number {
  if (slack <= 0) return 0
  return Math.max(-slack, Math.min(0, v))
}

/** 取景框内显示的图片尺寸(cover + zoom) */
const shown = computed(() => {
  const rw = frameW.value / (imgMeta.value?.w || 1)
  const rh = frameH.value / (imgMeta.value?.h || 1)
  const base = Math.max(rw, rh)
  return { w: (imgMeta.value?.w || 1) * base * cfg.zoom, h: (imgMeta.value?.h || 1) * base * cfg.zoom }
})

function pickFile() {
  fileRef.value?.click()
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) loadFile(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
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
    cfg.zoom = 1
    cfg.offsetX = 0
    cfg.offsetY = 0
  }
  reader.readAsDataURL(file)
}

interface Meta {
  w: number
  h: number
}
// 必须用 ref:computed 中读取模块级普通变量不会建立依赖,图片加载后首次渲染尺寸不更新
const imgMeta = ref<Meta | null>(null)

function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement
  imgMeta.value = { w: img.naturalWidth, h: img.naturalHeight }
}

/* ------------------------------ 拖动取景 ------------------------------ */
let startMX = 0
let startMY = 0
let startOX = 0
let startOY = 0

function onDown(e: PointerEvent) {
  if (!imgSrc.value) return
  dragging.value = true
  startMX = e.clientX
  startMY = e.clientY
  startOX = cfg.offsetX
  startOY = cfg.offsetY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (!dragging.value) return
  cfg.offsetX = clamp(startOX + e.clientX - startMX, shown.value.w - frameW.value)
  cfg.offsetY = clamp(startOY + e.clientY - startMY, shown.value.h - frameH.value)
}

function onUp() {
  dragging.value = false
}

function changeRatio(key: string) {
  cfg.ratioKey = key
  cfg.zoom = 1
  cfg.offsetX = 0
  cfg.offsetY = 0
}

function onZoom() {
  cfg.offsetX = clamp(cfg.offsetX, shown.value.w - frameW.value)
  cfg.offsetY = clamp(cfg.offsetY, shown.value.h - frameH.value)
}

function wheelZoom(e: WheelEvent) {
  if (!imgSrc.value) return
  e.preventDefault()
  cfg.zoom = Math.max(1, Math.min(4, cfg.zoom * (e.deltaY < 0 ? 1.08 : 0.92)))
  onZoom()
}

/* ------------------------------ 导出 ------------------------------ */
async function exportCrop() {
  if (!imgSrc.value) {
    ElMessage.info('请先上传图片')
    return
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = imgSrc.value
  })
  const { w: iw, h: ih } = { w: img.naturalWidth, h: img.naturalHeight }
  imgMeta.value = { w: iw, h: ih }

  // 原图坐标系中的取景区域
  const rw = frameW.value / iw
  const rh = frameH.value / ih
  const base = Math.max(rw, rh)
  const shownW = iw * base * cfg.zoom
  const shownH = ih * base * cfg.zoom
  const sx = (-cfg.offsetX / shownW) * iw
  const sy = (-cfg.offsetY / shownH) * ih
  const sw = (frameW.value / shownW) * iw
  const sh = (frameH.value / shownH) * ih

  // 输出尺寸:按比例,短边 512
  const side = 512
  const outW = frameW.value >= frameH.value ? side : Math.round((side * frameW.value) / frameH.value)
  const outH = frameH.value >= frameW.value ? side : Math.round((side * frameH.value) / frameW.value)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  if (cfg.circle) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), sw, sh, 0, 0, outW, outH)
  ctx.restore?.()

  const type = 'image/' + cfg.format
  let url: string
  try {
    url = canvas.toDataURL(type, 0.95)
  } catch {
    const fb = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!fb) {
      ElMessage.error('导出失败')
      return
    }
    url = URL.createObjectURL(fb)
  }
  const ext = cfg.format
  const a = document.createElement('a')
  a.href = url
  a.download = (imgName.value.replace(/\.[^.]+$/, '') || 'crop') + `_crop_${outW}x${outH}.` + ext
  a.click()
  ElMessage.success(`已导出 ${outW} × ${outH}`)
}

function reset() {
  imgSrc.value = ''
  imgName.value = ''
  imgMeta.value = null
  cfg.zoom = 1
  cfg.offsetX = 0
  cfg.offsetY = 0
}
</script>

<template>
  <div class="crp">
    <div class="head">
      <div>
        <h3 class="title">图片裁切</h3>
        <p class="sub">按比例裁切头像素材,支持圆形输出与滚轮缩放</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="Download" :disabled="!imgSrc" @click="exportCrop">导出裁切</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
      </div>
    </div>

    <div class="tools">
      <el-radio-group v-model="cfg.ratioKey" size="small" @change="changeRatio">
        <el-radio-button v-for="r in RATIOS" :key="r.key" :value="r.key">{{ r.label }}</el-radio-button>
      </el-radio-group>
      <el-checkbox v-model="cfg.circle">圆形输出(保留透明背景)</el-checkbox>
    </div>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onFile" />

    <div v-if="!imgSrc" class="drop" @click="pickFile" @dragover.prevent @drop="onDrop">
      <el-icon :size="34"><Switch /></el-icon>
      <p>点击或拖拽图片到此处</p>
    </div>

    <div v-else class="stage">
      <div
        class="frame"
        :class="{ circle: cfg.circle, dragging }"
        :style="{ width: frameW + 'px', height: frameH + 'px' }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel="wheelZoom"
      >
        <img
          :src="imgSrc"
          class="pix"
          alt=""
          draggable="false"
          @load="onImgLoad"
          :style="{ width: shown.w + 'px', height: shown.h + 'px', left: cfg.offsetX + 'px', top: cfg.offsetY + 'px' }"
        />
      </div>

      <div class="side">
        <div class="hint">在取景框内拖动调整位置,滚轮或下方滑杆缩放画面,右侧按钮导出。</div>
        <div class="row">
          <span class="lbl">缩放</span>
          <el-slider v-model="cfg.zoom" :min="1" :max="4" :step="0.05" style="flex: 1" @input="onZoom" />
          <span class="zv">{{ cfg.zoom.toFixed(2) }}×</span>
        </div>
        <div class="row">
          <span class="lbl">导出格式</span>
          <el-radio-group v-model="cfg.format" size="small">
            <el-radio-button value="png">PNG</el-radio-button>
            <el-radio-button value="jpeg">JPEG</el-radio-button>
            <el-radio-button value="webp">WebP</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <el-button size="small" :icon="Switch" @click="pickFile">更换图片</el-button>
        </div>
      </div>
    </div>

    <p class="foot">输出短边固定 512 px;圆形输出建议搭配 PNG / WebP 以保留透明背景;WebP 在部分环境可能回退为 PNG。</p>
  </div>
</template>

<style scoped>
.crp {
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
.tools {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
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
  margin: 10px 0 0;
  font-size: 13px;
}
.stage {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.frame {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: var(--el-fill-color);
  position: relative;
  cursor: grab;
  touch-action: none;
  flex: none;
}
.frame.dragging {
  cursor: grabbing;
}
.frame.circle {
  border-radius: 50%;
}
.pix {
  position: absolute;
  user-select: none;
  -webkit-user-drag: none;
  max-width: none;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 240px;
}
.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.zv {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 48px;
  flex: none;
}
.foot {
  margin-top: 18px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
