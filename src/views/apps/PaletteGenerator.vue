<script setup lang="ts">
/**
 * 配色方案
 * 以基准色生成同色系 / 邻近 / 互补 / 三分 / 四方等和谐配色,
 * 点击色块即可复制 HEX。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

/* ------------------------------ 颜色工具 ------------------------------ */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
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
  return [h, s, l]
}
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

const base = ref('#6366f1')
const hsl = computed(() => rgbToHsl(...hexToRgb(base.value)))

interface Scheme {
  name: string
  colors: string[]
}

const schemes = computed<Scheme[]>(() => {
  const [h, s, l] = hsl.value
  const clampL = (v: number) => Math.max(0.08, Math.min(0.92, v))
  return [
    { name: '同色系', colors: [clampL(l - 0.3), clampL(l - 0.15), l, clampL(l + 0.15), clampL(l + 0.3)].map((v) => hslToHex(h, s, v)) },
    { name: '邻近色', colors: [-40, -20, 0, 20, 40].map((d) => hslToHex(h + d, s, l)) },
    { name: '互补色', colors: [hslToHex(h, s, l), hslToHex(h, s, clampL(l + 0.16)), hslToHex(h + 180, s, l), hslToHex(h + 180, s, clampL(l - 0.12)), hslToHex(h + 180, s, clampL(l + 0.16))] },
    { name: '三分色', colors: [0, 0, 120, 240, 240].map((d) => hslToHex(h + d, s, l)) },
    { name: '四方色', colors: [0, 90, 180, 270, 180].map((d) => hslToHex(h + d, s, l)) },
    { name: '深浅阶梯', colors: [-0.35, -0.18, 0, 0.18, 0.35].map((d) => hslToHex(h, s, clampL(l + d))) },
  ]
})

async function copy(c: string) {
  await copyText(c)
  ElMessage.success(`已复制 ${c}`)
}

function isLight(c: string): boolean {
  const [r, g, b] = hexToRgb(c)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}
</script>

<template>
  <div class="pal">
    <div class="head">
      <div>
        <h3 class="title">配色方案</h3>
        <p class="sub">以基准色生成多种和谐配色,点击色块复制 HEX</p>
      </div>
      <div class="base-pick">
        <span class="bp-label">基准色</span>
        <el-color-picker v-model="base" />
        <span class="bp-hex">{{ base }}</span>
      </div>
    </div>

    <div class="schemes">
      <div v-for="sc in schemes" :key="sc.name" class="scheme">
        <div class="sc-name">{{ sc.name }}</div>
        <div class="swatches">
          <div
            v-for="(c, i) in sc.colors"
            :key="i"
            class="sw"
            :style="{ background: c, color: isLight(c) ? '#1f2937' : '#fff' }"
            @click="copy(c)"
          >
            <span class="sw-hex">{{ c.toUpperCase() }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="foot">提示:点击任一色块即可复制其 HEX 值;配色基于 HSL 色轮和谐规律生成,仅作参考。</p>
  </div>
</template>

<style scoped>
.pal {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
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
.base-pick {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bp-label,
.bp-hex {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.schemes {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.scheme {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
}
.sc-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.swatches {
  display: flex;
  border-radius: 10px;
  overflow: hidden;
}
.sw {
  flex: 1;
  height: 64px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  cursor: pointer;
  transition: flex 0.2s;
}
.sw:hover {
  flex: 1.4;
}
.sw-hex {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
