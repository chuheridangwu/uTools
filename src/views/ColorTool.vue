<script setup lang="ts">
/**
 * 颜色工具
 * HEX / RGB / HSL / CMYK 互相换算,生成深浅色阶,校验 WCAG 文本对比度,支持系统吸管取色。
 */
import type { UploadFile } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

interface Rgb { r: number; g: number; b: number }
interface Hsl { h: number; s: number; l: number }

const hex = ref('#6366f1')

/* ─────────── 换算函数 ─────────── */

function hexToRgb(h: string): Rgb {
  let s = h.replace('#', '').trim()
  if (s.length === 3) s = s.replace(/(.)/g, '$1$1')
  const n = parseInt(s, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const R = (r /= 255)
  const G = (g /= 255)
  const B = (b /= 255)
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  let hh = 0
  if (max !== min) {
    const d = max - min
    hh =
      max === R ? ((G - B) / d + (G < B ? 6 : 0)) :
      max === G ? (B - R) / d + 2 : (R - G) / d + 4
    hh *= 60
  }
  const l = (max + min) / 2
  const s = max === min ? 0 : d(max, min) / (1 - Math.abs(2 * l - 1))
  return { h: Math.round(hh), s: Math.round(s * 100), l: Math.round(l * 100) }
}
function d(a: number, b: number): number {
  return Math.max(a, b) - Math.min(a, b)
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const S = s / 100
  const L = l / 100
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = L - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

/** CMYK 近似转换(C0 M1 Y2 K3 数值 0-100) */
function rgbToCmyk({ r, g, b }: Rgb): [number, number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const k = 1 - Math.max(R, G, B)
  if (k >= 1) return [0, 0, 0, 100]
  const c = ((1 - R - k) / (1 - k)) * 100
  const m = ((1 - G - k) / (1 - k)) * 100
  const y = ((1 - B - k) / (1 - k)) * 100
  return [c, m, y, k * 100].map((x) => Math.round(x)) as [number, number, number, number]
}

/* ─────────── 结果计算 ─────────── */

const rgb = computed<Rgb>(() => hexToRgb(hex.value))
const hsl = computed<Hsl>(() => rgbToHsl(rgb.value))
const rgbStr = computed(() => `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})`)
const cmykStr = computed(() => {
  const [c, m, y, k] = rgbToCmyk(rgb.value)
  return `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`
})

/** 亮度(对比度计算用)。sRGB 相对亮度简化版 */
function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const contrastWhite = computed(() => {
  const l = luminance(rgb.value)
  return Math.round(((1.05) / (l + 0.05)) * 100) / 100
})
const contrastBlack = computed(() => {
  const l = luminance(rgb.value)
  return Math.round(((l + 0.05) / 0.05) * 100) / 100
})
/** WCAG AA 阈值 4.5:1(Normal) / 3:1(Large),这里给出与黑白文字的判定 */
const goodOnBlack = computed(() => contrastWhite.value >= 4.5)
const goodOnWhite = computed(() => contrastBlack.value >= 4.5)

/** 深浅色阶:基于 HSL 的 亮度稳梯度(上下 ±15%) */
const shades = computed(() => {
  const base = hsl.value
  const lStep = Math.round((100 / 11) * 100) / 100 // 大约 9.09
  return Array.from({ length: 11 }, (_, i) => {
    const l = Math.max(0, Math.min(100, lStep * i))
    const c = hslToRgb({ h: base.h, s: base.s, l })
    return { l: Math.round(l), hex: rgbToHex(c) }
  }).filter((x) => x.hex !== rgbToHex(rgb.value) || true)
})

/* ─────────── 交互 ─────────── */

const hasPicker = ref(typeof (window as any).EyeDropper !== 'undefined')

// 系统吸管取色(Chromium 独有 API)
async function pickSystem() {
  try {
    const ed = new (window as any).EyeDropper()
    const { sRGBHex } = await ed.open()
    hex.value = sRGBHex
  } catch {
    ElMessage.info('已取消取色')
  }
}

/** 图片取色:点击图片任意像素读颜色 */
const imgInput = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasImg = ref(false)

function onImgFile(f: File) {
  const img = new Image()
  img.onload = () => {
    const c = canvasRef.value!
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    hasImg.value = true
  }
  img.src = URL.createObjectURL(f)
}

function handleClick(e: MouseEvent) {
  if (!hasImg.value) return
  const c = canvasRef.value!
  const ctx = c.getContext('2d')!
  const rect = c.getBoundingClientRect()
  const x = Math.round(((e.clientX - rect.left) / rect.width) * c.width)
  const y = Math.round(((e.clientY - rect.top) / rect.height) * c.height)
  const p = ctx.getImageData(x, y, 1, 1)
  hex.value = rgbToHex({ r: p.data[0], g: p.data[1], b: p.data[2] })
}

const PRESETS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#ef4444', '#0ea5e9', '#00b7a7', '#e11d48']

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onImgFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>颜色工具</template>
    <template #desc>取色器与 HEX / RGB / HSL / CMYK 换算,生成深浅色阶,校验 WCAG 文本对比度。</template>

    <el-card shadow="never">
      <template #header>颜色输入</template>
      <div class="inrow">
        <el-color-picker v-model="hex" size="large" />
        <el-input v-model="hex" size="small" class="mono" style="width: 150px" />
        <el-button size="small" @click="pickSystem" :disabled="!hasPicker">
          {{ hasPicker ? '屏幕取色' : '浏览器不支持屏幕取色' }}
        </el-button>
        <span class="muted small">预设色板:</span>
        <span
          v-for="c in PRESETS"
          :key="c"
          class="sw"
          :style="{ background: c }"
          @click="hex = c"
        ></span>
      </div>
    </el-card>

    <el-row :gutter="12" class="mt12">
      <el-col :span="7">
        <el-card shadow="never">
          <template #header>换算</template>
          <div class="vals">
            <div class="row"><span class="k">HEX</span><code class="v mono" @click="copyText(hex.toUpperCase())">{{ hex.toUpperCase() }}</code></div>
            <div class="row"><span class="k">RGB</span><code class="v mono" @click="copyText(rgbStr)">{{ rgbStr }}</code></div>
            <div class="row"><span class="k">HSL</span><code class="v mono" @click="copyText(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)">hsl({{ hsl.h }}, {{ hsl.s }}%, {{ hsl.l }}%)</code></div>
            <div class="row"><span class="k">CMYK</span><code class="v mono" @click="copyText(cmykStr)">{{ cmykStr }}</code></div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt12">
          <template #header>对比度(WCAG)</template>
          <div class="ct">
            <div class="box" :style="{ background: hex, color: '#000' }">
              黑字 <span class="r">{{ goodOnWhite ? 'AA ✓' : '✗' }}</span>
              <span class="small muted">对比度 {{ contrastBlack }}</span>
            </div>
            <div class="box" :style="{ background: hex, color: '#fff' }">
              白字 <span class="r">{{ goodOnBlack ? 'AA ✓' : '✗' }}</span>
              <span class="small muted">对比度 {{ contrastWhite }}</span>
            </div>
            <div class="muted small">AA 正文阈值 4.5:1,大字 3:1;AAA 正文 7:1。</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="17">
        <el-card shadow="never">
          <template #header>深浅色阶(固定 H,滑动 L)</template>
          <div class="grad">
            <div v-for="(s, i) in shades" :key="i" class="gcell">
              <div class="gsq" :style="{ background: s.hex }" @click="hex = s.hex"></div>
              <div class="gl small muted">{{ s.l }}%</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt12">
          <template #header>
            <div class="head">
              <span>图片取色(点击画布)</span>
              <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="onUploadChange">
                <el-button size="small">选择图片</el-button>
              </el-upload>
            </div>
          </template>
          <div class="pick">
            <canvas v-show="hasImg" ref="canvasRef" class="cvs" @click="handleClick"></canvas>
            <div v-if="!hasImg" class="muted small">上传图片后点击即可取色</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.mt8 { margin-top: 8px; }
.inrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sw { width: 18px; height: 18px; border-radius: 4px; display: inline-block; cursor: pointer; border: 1px solid var(--card-border); }
.vals { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 10px; }
.k { width: 48px; font-size: 12px; color: var(--el-text-color-secondary); }
.v { font-size: 12.5px; cursor: pointer; padding: 3px 8px; background: var(--el-fill-color-lighter); border-radius: 4px; }
.ct { display: flex; flex-direction: column; gap: 8px; }
.box { padding: 12px; border-radius: 8px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
.r { font-size: 12px; }
.grad { display: flex; gap: 6px; }
.gcell { flex: 1; text-align: center; }
.gsq { height: 48px; border-radius: 6px; cursor: pointer; }
.gl { margin-top: 4px; font-size: 11px; }
.pick { min-height: 180px; }
.cvs { max-width: 100%; max-height: 300px; cursor: crosshair; }
.head { display: flex; justify-content: space-between; align-items: center; }
.small { font-size: 12px; }
</style>
