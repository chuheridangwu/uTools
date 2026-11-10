<script setup lang="ts">
/**
 * SVG 图案生成器
 * 用 <pattern> 平铺生成圆点、网格、斜线、棋盘与波浪纹理,
 * 可复制 SVG 源码 / CSS background,或下载为 .svg 文件。全部本机生成。
 */
import { computed, reactive } from 'vue'
import { CopyDocument, Download, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const W = 800
const H = 480

const TYPES = [
  { key: 'dots', label: '圆点' },
  { key: 'grid', label: '网格' },
  { key: 'diagonal', label: '斜线' },
  { key: 'checker', label: '棋盘' },
  { key: 'waves', label: '波浪' },
]

const state = reactive({
  type: 'dots',
  tile: 48,
  weight: 8,
  opacity: 0.9,
  angle: 45,
  fg: '#6366f1',
  bg: '#f8fafc',
})

const PALETTES = [
  { fg: '#6366f1', bg: '#eef2ff' },
  { fg: '#0ea5e9', bg: '#f0f9ff' },
  { fg: '#10b981', bg: '#ecfdf5' },
  { fg: '#f43f5e', bg: '#fff1f2' },
  { fg: '#f59e0b', bg: '#fffbeb' },
  { fg: '#8b5cf6', bg: '#f5f3ff' },
  { fg: '#0f172a', bg: '#e2e8f0' },
  { fg: '#14b8a6', bg: '#f0fdfa' },
]

function patternInner(t: number, w: number, fg: string): string {
  const half = t / 2
  switch (state.type) {
    case 'grid':
      return `<path d="M ${t} 0 L 0 0 0 ${t}" fill="none" stroke="${fg}" stroke-width="${w / 2}" />`
    case 'diagonal':
      return `<path d="M 0 0 L 0 ${t}" fill="none" stroke="${fg}" stroke-width="${w / 2}" />`
    case 'checker':
      return `<rect width="${half}" height="${half}" fill="${fg}" /><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fg}" />`
    case 'waves':
      return `<path d="M 0 ${half} Q ${t / 4} ${half - w} ${half} ${half} T ${t} ${half}" fill="none" stroke="${fg}" stroke-width="${Math.max(1, w / 3)}" stroke-linecap="round" />`
    case 'dots':
    default:
      return `<circle cx="${half}" cy="${half}" r="${Math.max(1, w / 2)}" fill="${fg}" />`
  }
}

const svg = computed(() => {
  const t = Math.max(8, state.tile)
  const w = Math.max(1, state.weight)
  const transform = state.type === 'diagonal' ? ` patternTransform="rotate(${state.angle})"` : ''
  const inner = patternInner(t, w, state.fg)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    '  <defs>',
    `    <pattern id="utools-pattern" x="0" y="0" width="${t}" height="${t}" patternUnits="userSpaceOnUse"${transform}>`,
    `      ${inner}`,
    '    </pattern>',
    '  </defs>',
    `  <rect width="100%" height="100%" fill="${state.bg}" />`,
    `  <rect width="100%" height="100%" fill="url(#utools-pattern)" opacity="${state.opacity}" />`,
    '</svg>',
  ].join('\n')
})

const dataUrl = computed(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.value))
const cssSnippet = computed(() => `background-image: url("${dataUrl.value}");\nbackground-color: ${state.bg};`)

function randomPalette() {
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)]
  state.fg = p.fg
  state.bg = p.bg
  state.tile = 24 + Math.floor(Math.random() * 7) * 8
  state.type = TYPES[Math.floor(Math.random() * TYPES.length)].key
  ElMessage.success('已换一套配色')
}

async function copy(v: string, tip = '已复制') {
  await copyText(v)
  ElMessage.success(tip)
}

function downloadSvg() {
  downloadText(svg.value, 'pattern.svg', 'image/svg+xml;charset=utf-8')
  ElMessage.success('已下载 pattern.svg')
}
</script>

<template>
  <div class="sp">
    <div class="head">
      <div>
        <h3 class="title">SVG 图案生成器</h3>
        <p class="sub">平铺纹理实时预览,可复制源码、CSS 背景或下载 SVG</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="MagicStick" @click="randomPalette">随机配色</el-button>
        <el-button size="small" :icon="CopyDocument" @click="copy(svg, '已复制 SVG 源码')">复制 SVG</el-button>
        <el-button size="small" :icon="Download" @click="downloadSvg">下载 SVG</el-button>
      </div>
    </div>

    <div class="main">
      <div class="controls">
        <div class="opt">
          <span class="lbl">图案</span>
          <el-select v-model="state.type" size="small" style="width: 130px">
            <el-option v-for="t in TYPES" :key="t.key" :label="t.label" :value="t.key" />
          </el-select>
        </div>
        <div class="opt colors">
          <span class="lbl">前景</span>
          <el-color-picker v-model="state.fg" size="small" />
          <span class="lbl">背景</span>
          <el-color-picker v-model="state.bg" size="small" />
        </div>
        <div class="slider">
          <span class="lbl">平铺尺寸 <em>{{ state.tile }}px</em></span>
          <el-slider v-model="state.tile" :min="16" :max="120" :show-tooltip="false" />
        </div>
        <div class="slider">
          <span class="lbl">粗细 / 点径 <em>{{ state.weight }}px</em></span>
          <el-slider v-model="state.weight" :min="1" :max="24" :show-tooltip="false" />
        </div>
        <div v-if="state.type === 'diagonal'" class="slider">
          <span class="lbl">倾角 <em>{{ state.angle }}°</em></span>
          <el-slider v-model="state.angle" :min="0" :max="90" :show-tooltip="false" />
        </div>
        <div class="slider">
          <span class="lbl">不透明度 <em>{{ state.opacity.toFixed(2) }}</em></span>
          <el-slider v-model="state.opacity" :min="0.1" :max="1" :step="0.05" :show-tooltip="false" />
        </div>
        <div class="tip">提示:图案为无缝平铺,可直接用作网页背景、PPT 底纹或设计稿纹理。</div>
      </div>

      <div class="preview-wrap">
        <div class="preview" :style="{ backgroundColor: state.bg }">
          <img :src="dataUrl" alt="pattern preview" />
        </div>
        <div class="css-row">
          <code>{{ cssSnippet }}</code>
          <el-button size="small" text :icon="CopyDocument" @click="copy(cssSnippet, '已复制 CSS')">复制 CSS</el-button>
        </div>
      </div>
    </div>

    <div class="block-head">SVG 源码</div>
    <textarea class="code" readonly :value="svg" spellcheck="false" />
  </div>
</template>

<style scoped>
.sp {
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
.acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.main {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 760px) {
  .main {
    grid-template-columns: 1fr;
  }
}
.controls {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.opt,
.colors {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.lbl em {
  font-style: normal;
  color: var(--el-text-color-regular);
}
.slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tip {
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
  border-top: 1px dashed var(--card-border);
  padding-top: 10px;
}
.preview-wrap {
  min-width: 0;
}
.preview {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
  height: 240px;
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.css-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
}
.css-row code {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.block-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.code {
  width: 100%;
  min-height: 150px;
  box-sizing: border-box;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  white-space: pre;
  overflow: auto;
}
</style>
