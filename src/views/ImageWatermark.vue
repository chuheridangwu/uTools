<script setup lang="ts">
/**
 * 图片水印
 * 在图片上叠加文字水印,支持九宫格定位 + 全局平铺、透明度、旋转、颜色与字号,实时预览并导出。
 */
import type { UploadFile } from 'element-plus'
import { ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import { canvasToBlob, loadImage, renameWithExt } from '@/utils/image'

const file = ref<File | null>(null)
let srcImage: HTMLImageElement | null = null

const text = ref('© 2026 uTools 在线工具站')
const fontSize = ref(24)
const color = ref('#ffffff')
const opacity = ref(35)
const rotate = ref(-30)
const position = ref<'br' | 'bl' | 'tr' | 'tl' | 'c' | 'bc' | 'tc' | 'tr2' | 'tile'>('br')
const margin = ref(24)
const fmt = ref<'image/png' | 'image/jpeg' | 'image/webp'>('image/png')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewUrl = ref('')

const POS_LABELS: Array<{ v: typeof position.value; l: string }> = [
  { v: 'tl', l: '左上' }, { v: 'tc', l: '上中' }, { v: 'tr', l: '右上' },
  { v: 'bl', l: '左下' }, { v: 'bc', l: '下中' }, { v: 'br', l: '右下' },
  { v: 'c', l: '居中' }, { v: 'tile', l: '平铺' },
]

async function onFile(f: File) {
  try {
    srcImage = await loadImage(f)
    file.value = f
    render()
  } catch {
    ElMessage.warning('图片加载失败')
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotate.value * Math.PI) / 180)
  ctx.globalAlpha = opacity.value / 100
  ctx.fillStyle = color.value
  ctx.font = `${fontSize.value}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.value, 0, 0)
  ctx.restore()
}

function render() {
  const c = canvasRef.value
  if (!c || !srcImage) return
  c.width = srcImage.naturalWidth
  c.height = srcImage.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(srcImage, 0, 0)

  ctx.font = `${fontSize.value}px sans-serif`
  const tw = ctx.measureText(text.value).width
  const W = c.width
  const H = c.height
  const m = margin.value

  if (position.value === 'tile') {
    // 平铺:按文字宽高的 3.5 倍为网格间隔铺满
    const gx = tw * 3.5
    const gy = fontSize.value * 5
    for (let y = -H; y < H * 2; y += gy) {
      for (let x = -W; x < W * 2; x += gx) drawMarker(ctx, x + (Math.round(y / gy) % 2) * (gx / 2), y)
    }
  } else {
    const anchors: Record<string, [number, number]> = {
      tl: [m, m], tc: [(W - tw) / 2, m], tr: [W - tw - m, m],
      bl: [m, H - m], bc: [(W - tw) / 2, H - m], br: [W - tw - m, H - m - fontSize.value * 0.6],
      c: [(W - tw) / 2, H / 2],
    }
    const [x, y] = anchors[position.value] ?? anchors.br
    drawMarker(ctx, x, y)
  }
  previewUrl.value = c.toDataURL('image/png')
}

function download() {
  const c = canvasRef.value
  if (!c || !file.value) return
  canvasToBlob(c, fmt.value, fmt.value === 'image/png' ? undefined : 0.92).then((b) =>
    downloadBlob(b, renameWithExt(file.value!.name, fmt.value)),
  )
}

watch([text, fontSize, color, opacity, rotate, position, margin], () => render(), { deep: true })
onBeforeUnmount(() => { /* 释放无外部资源 */ })

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>图片水印</template>
    <template #desc>叠加文字水印:九宫格定位或全局平铺,支持透明度/旋转/颜色/字号,实时预览后导出。</template>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" :body-style="{ padding: '0' }">
          <template #header>
            <div class="head">
              <span>预览</span>
              <span>
                <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="onUploadChange">
                  <el-button size="small" type="primary">选择图片</el-button>
                </el-upload>
                <el-button size="small" :disabled="!file" @click="download">下载</el-button>
                <el-select v-model="fmt" size="small" style="width: 100px" :disabled="!file">
                  <el-option value="image/png" label="PNG" />
                  <el-option value="image/jpeg" label="JPEG" />
                  <el-option value="image/webp" label="WebP" />
                </el-select>
              </span>
            </div>
          </template>
          <div class="stage">
            <canvas ref="canvasRef" v-show="file"></canvas>
            <div v-if="!file" class="empty muted">先选择一张图片</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never">
          <template #header>水印设置</template>
          <div class="form">
            <div class="lab">水印文字</div>
            <el-input v-model="text" size="small" />
            <div class="lab">字号 {{ fontSize }} px</div>
            <el-slider v-model="fontSize" :min="10" :max="120" size="small" />
            <div class="lab">透明度 {{ opacity }}%</div>
            <el-slider v-model="opacity" :min="5" :max="100" size="small" />
            <div class="lab">旋转 {{ rotate }}°</div>
            <el-slider v-model="rotate" :min="-90" :max="90" size="small" />
            <div class="lab">颜色</div>
            <el-color-picker v-model="color" size="small" />
            <div class="lab" v-if="position !== 'tile'">边距 {{ margin }} px</div>
            <el-slider v-if="position !== 'tile'" v-model="margin" :min="0" :max="200" size="small" />
            <div class="lab">位置</div>
            <div class="posgrid">
              <el-button v-for="p in POS_LABELS" :key="p.v" size="small" :type="position === p.v ? 'primary' : 'info'" plain @click="position = p.v">
                {{ p.l }}
              </el-button>
            </div>
          </div>
        </el-card>
        <el-alert class="mt8" type="info" :closable="false">
          <template #title>平铺说明</template>
          选择“平铺”会以文字宽高的倍数为间隔铺满整张图,适合版权声明类水印。
        </el-alert>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.stage { min-height: 380px; display: flex; align-items: center; justify-content: center; padding: 12px; background: var(--el-fill-color-lighter); }
.stage canvas { max-width: 100%; max-height: 480px; }
.empty { font-size: 13px; }
.form { display: flex; flex-direction: column; gap: 4px; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 6px; }
.posgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
</style>
