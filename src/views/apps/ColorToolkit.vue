<script setup lang="ts">
/**
 * 颜色工具
 * 颜色选择与格式互转:HEX / RGB / HSL,支持屏幕取色(EyeDropper API)、
 * 一键复制各格式,并展示较亮/较暗的搭配色。
 */
import { computed, ref } from 'vue'
import { CopyDocument, Aim } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const color = ref('#6366f1')

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

const rgb = computed(() => hexToRgb(color.value))
const hsl = computed(() => rgbToHsl(...rgb.value))

const HEX = computed(() => color.value.toUpperCase())
const RGB = computed(() => `rgb(${rgb.value[0]}, ${rgb.value[1]}, ${rgb.value[2]})`)
const HSL = computed(() => `hsl(${hsl.value[0]}, ${hsl.value[1]}%, ${hsl.value[2]}%)`)

function shade(amount: number): string {
  const [r, g, b] = rgb.value
  const f = (n: number) => (amount < 0 ? n * (1 + amount) : n + (255 - n) * amount)
  return rgbToHex(f(r), f(g), f(b))
}

const shades = computed(() => [
  { name: '最亮', c: shade(0.6) },
  { name: '较亮', c: shade(0.3) },
  { name: '本色', c: color.value },
  { name: '较暗', c: shade(-0.2) },
  { name: '最暗', c: shade(-0.45) },
])

async function copy(v: string) {
  await copyText(v)
  ElMessage.success(`已复制 ${v}`)
}

async function pick() {
  const AnyWindow = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }
  if (!AnyWindow.EyeDropper) {
    ElMessage.info('当前浏览器不支持屏幕取色,请手动选择颜色')
    return
  }
  try {
    const dropper = new AnyWindow.EyeDropper()
    const res = await dropper.open()
    color.value = res.sRGBHex
    ElMessage.success('已取色 ' + res.sRGBHex)
  } catch {
    /* 用户取消 */
  }
}

function isLight(c: string): boolean {
  const [r, g, b] = hexToRgb(c)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}
</script>

<template>
  <div class="ct">
    <div class="head">
      <div>
        <h3 class="title">颜色工具</h3>
        <p class="sub">选择颜色并转换 HEX / RGB / HSL,支持屏幕取色</p>
      </div>
      <el-button size="small" :icon="Aim" @click="pick">屏幕取色</el-button>
    </div>

    <div class="cols">
      <div class="preview" :style="{ background: color, color: isLight(color) ? '#1f2937' : '#fff' }">
        <span class="pv-hex">{{ HEX }}</span>
      </div>

      <div class="detail">
        <div class="pick-row">
          <el-color-picker v-model="color" />
          <span class="pick-tip">点击色块选择,或使用右侧取色按钮</span>
        </div>

        <div class="fmt" @click="copy(HEX)">
          <span class="fmt-l">HEX</span><span class="fmt-v">{{ HEX }}</span><el-icon class="cp"><CopyDocument /></el-icon>
        </div>
        <div class="fmt" @click="copy(RGB)">
          <span class="fmt-l">RGB</span><span class="fmt-v">{{ RGB }}</span><el-icon class="cp"><CopyDocument /></el-icon>
        </div>
        <div class="fmt" @click="copy(HSL)">
          <span class="fmt-l">HSL</span><span class="fmt-v">{{ HSL }}</span><el-icon class="cp"><CopyDocument /></el-icon>
        </div>

        <div class="channels">
          <div class="ch"><span class="ch-l">R</span><span class="ch-v">{{ rgb[0] }}</span></div>
          <div class="ch"><span class="ch-l">G</span><span class="ch-v">{{ rgb[1] }}</span></div>
          <div class="ch"><span class="ch-l">B</span><span class="ch-v">{{ rgb[2] }}</span></div>
        </div>
      </div>
    </div>

    <div class="shades">
      <span class="sh-label">明暗搭配</span>
      <div class="sh-list">
        <div v-for="s in shades" :key="s.name" class="sh-item" @click="copy(s.c)">
          <div class="sh-c" :style="{ background: s.c, color: isLight(s.c) ? '#1f2937' : '#fff' }">{{ s.name }}</div>
          <span class="sh-hex">{{ s.c.toUpperCase() }}</span>
        </div>
      </div>
    </div>

    <p class="foot">提示:点击任意色块或格式行即可复制;屏幕取色需浏览器支持 EyeDropper API(Chrome/Edge)。</p>
  </div>
</template>

<style scoped>
.ct {
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
.cols {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 18px;
}
@media (max-width: 720px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.preview {
  border-radius: 14px;
  min-height: 220px;
  display: grid;
  place-items: center;
  border: 1px solid var(--card-border);
  transition: background 0.2s;
}
.pv-hex {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pick-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pick-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.fmt {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.fmt:hover {
  border-color: var(--el-color-primary);
}
.fmt-l {
  width: 40px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.fmt-v {
  flex: 1;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.cp {
  color: var(--el-text-color-placeholder);
}
.channels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ch {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 12px;
  text-align: center;
}
.ch-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-right: 6px;
}
.ch-v {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.shades {
  margin-top: 18px;
}
.sh-label {
  font-size: 13px;
  font-weight: 600;
  display: block;
  margin-bottom: 10px;
}
.sh-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.sh-item {
  cursor: pointer;
}
.sh-c {
  border-radius: 10px;
  height: 60px;
  display: grid;
  place-items: center;
  font-size: 12px;
  border: 1px solid var(--card-border);
}
.sh-hex {
  display: block;
  text-align: center;
  font-size: 11px;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
