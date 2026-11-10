<script setup lang="ts">
/**
 * 随机头像生成
 * 三种风格:对称几何块(像素风)、首字母渐变、表情符号;
 * 种子驱动(同一种子结果一致),可调尺寸并下载 PNG,全部本地绘制。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type StyleKey = 'pixel' | 'letter' | 'emoji'

const STYLES: { key: StyleKey; label: string; desc: string }[] = [
  { key: 'pixel', label: '几何像素', desc: '左半随机、整体左右对称的 8-bit 色块' },
  { key: 'letter', label: '首字母', desc: '渐变底色 + 种子首字母,适合个人头像' },
  { key: 'emoji', label: '表情符号', desc: '随机表情搭配双色渐变底' },
]

const EMOJIS = ['😀', '😺', '🐶', '🦊', '🐼', '🐸', '🌈', '🚀', '⭐', '🍀', '🎧', '🎮', '🍜', '☕', '🐳', '🦉', '🌸', '🐢', '🐱', '🪐']
const PALETTES = [
  ['#6366f1', '#ec4899'],
  ['#0ea5e9', '#22d3ee'],
  ['#f59e0b', '#ef4444'],
  ['#16a34a', '#84cc16'],
  ['#8b5cf6', '#6366f1'],
  ['#f43f5e', '#fb923c'],
  ['#14b8a6', '#0ea5e9'],
]

const state = reactive({
  style: 'pixel' as StyleKey,
  seed: 'uTools',
  size: 256,
})

/** 种子 → 可复现伪随机函数(同一种子序列一致) */
function rng(seedStr: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickPalette(rand: () => number): [string, string] {
  const p = PALETTES[Math.floor(rand() * PALETTES.length)] || PALETTES[0]
  if (!p || p.length < 2) return ['#6366f1', '#ec4899']
  return [p[0], p[1]]
}

/** 几何像素风绘制:8×8 左右对称色块 */
function drawPixel(ctx: CanvasRenderingContext2D, s: number, rand: () => number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, s, s)
  const cells = 8
  const c = s / cells
  const drawHalf = (color: string, threshold: number) => {
    ctx.fillStyle = color
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells / 2; x++) {
        if (rand() > threshold) {
          ctx.fillRect(Math.round(x * c), Math.round(y * c), Math.ceil(c), Math.ceil(c))
          ctx.fillRect(Math.round((cells - 1 - x) * c), Math.round(y * c), Math.ceil(c), Math.ceil(c))
        }
      }
    }
  }
  const pal = pickPalette(rand)
  drawHalf(pal[0], 0.5)
  drawHalf(pal[1], 0.85)
}

function drawGradientBg(ctx: CanvasRenderingContext2D, s: number, rand: () => number) {
  const pal = pickPalette(rand)
  const g = ctx.createLinearGradient(0, 0, s, s)
  g.addColorStop(0, pal[0])
  g.addColorStop(1, pal[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
}

function drawLetter(ctx: CanvasRenderingContext2D, s: number, seed: string) {
  const ch = (seed.trim()[0] || 'U').toUpperCase()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${Math.round(s * 0.52)}px system-ui, "PingFang SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, s / 2, s / 2 + s * 0.02)
}

function drawEmoji(ctx: CanvasRenderingContext2D, s: number, rand: () => number) {
  const e = EMOJIS[Math.floor(rand() * EMOJIS.length)] || '😀'
  ctx.font = `${Math.round(s * 0.6)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(e, s / 2, s / 2 + s * 0.04)
}

function drawInto(ctx: CanvasRenderingContext2D, s: number, seed: string, style: StyleKey) {
  const rand = rng(style + '|' + seed)
  if (style === 'pixel') {
    drawPixel(ctx, s, rand)
    return
  }
  drawGradientBg(ctx, s, rand)
  if (style === 'letter') drawLetter(ctx, s, seed)
  else drawEmoji(ctx, s, rand)
}

/* ------------------------------ 主画布与备选 ------------------------------ */
const canvasRef = ref<HTMLCanvasElement>()

function renderMain() {
  const canvas = canvasRef.value
  if (!canvas) return
  drawInto(canvas.getContext('2d')!, state.size, state.seed, state.style)
}

const VARIANT_N = 6

const variantRefs = ref<Record<number, HTMLCanvasElement>>({})

function setVariantRef(i: number, el: unknown) {
  if (el) variantRefs.value[i] = el as HTMLCanvasElement
}

function renderVariants() {
  for (let i = 0; i < VARIANT_N; i++) {
    const cv = variantRefs.value[i]
    if (!cv) continue
    drawInto(cv.getContext('2d')!, cv.width, state.seed + '#' + i, state.style)
  }
}

function renderAll() {
  renderMain()
  renderVariants()
}

watch(() => [state.style, state.seed, state.size], renderAll)
onMounted(renderAll)

function randomize() {
  state.seed = Math.random().toString(36).slice(2, 10)
}

function useVariant(i: number) {
  state.seed = state.seed + '#' + i
}

function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `avatar_${state.style}_${state.seed}_${state.size}.png`
  a.click()
  ElMessage.success('已下载 PNG')
}

const styleInfo = computed(() => STYLES.find((x) => x.key === state.style)!)
</script>

<template>
  <div class="av">
    <div class="head">
      <div>
        <h3 class="title">随机头像生成</h3>
        <p class="sub">种子驱动的几何 / 字母 / 表情头像,同一种子结果一致</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="Download" @click="download">下载 PNG</el-button>
        <el-button size="small" type="primary" :icon="Refresh" @click="randomize">随机一个</el-button>
      </div>
    </div>

    <div class="styles">
      <button
        v-for="st in STYLES"
        :key="st.key"
        class="st"
        :class="{ on: state.style === st.key }"
        @click="state.style = st.key"
      >
        <span class="st-name">{{ st.label }}</span>
        <span class="st-desc">{{ st.desc }}</span>
      </button>
    </div>

    <div class="cols">
      <div class="preview">
        <canvas ref="canvasRef" class="big" :width="state.size" :height="state.size" @click="randomize" />
        <div class="p-name">种子:{{ state.seed }}(点图随机)</div>
      </div>
      <div class="cfg">
        <div class="row">
          <span class="lbl">种子</span>
          <el-input v-model="state.seed" style="flex: 1" />
        </div>
        <div class="row">
          <span class="lbl">尺寸</span>
          <el-radio-group v-model="state.size" size="small">
            <el-radio-button :value="128">128</el-radio-button>
            <el-radio-button :value="256">256</el-radio-button>
            <el-radio-button :value="512">512</el-radio-button>
          </el-radio-group>
        </div>
        <div class="tips">{{ styleInfo.desc }};备选小图点击即可替换主图种子。</div>
      </div>
    </div>

    <div class="variants">
      <div class="v-title">备选(由同一种子派生)</div>
      <div class="v-grid">
        <div v-for="i in VARIANT_N" :key="i" class="v-item" @click="useVariant(i - 1)">
          <canvas
            class="v-canvas"
            width="96"
            height="96"
            :ref="(el) => setVariantRef(i - 1, el)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.av {
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
.styles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.st {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
  background: var(--el-bg-color);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
}
.st.on {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.st-name {
  font-size: 14px;
  font-weight: 600;
}
.st-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.cols {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.big {
  border-radius: 20px;
  border: 1px solid var(--card-border);
  width: 220px;
  height: 220px;
  cursor: pointer;
}
.p-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.cfg {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-width: 240px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lbl {
  width: 44px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.tips {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.variants {
  margin-top: 20px;
}
.v-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}
.v-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.v-item {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.v-item:hover {
  border-color: var(--el-color-primary);
}
.v-canvas {
  width: 96px;
  height: 96px;
  display: block;
  border-radius: 10px;
}
</style>
