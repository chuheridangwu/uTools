<script setup lang="ts">
/**
 * 代码美化截图
 * 把代码渲染成带窗口控制按钮的「截图卡片」:主题 / 行号 / 标题 /
 * 字号可调,使用内置轻量着色(JS / Python 风通用),导出为高清 PNG。
 */
import { computed, reactive, ref } from 'vue'
import { Camera, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

enum T {
  Plain = 'plain',
  Keyword = 'keyword',
  String = 'string',
  Number = 'number',
  Comment = 'comment',
}

interface Tok {
  text: string
  t: T
}

const MASTER =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new',
  'import', 'export', 'from', 'async', 'await', 'this', 'super', 'extends', 'implements',
  'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue', 'default', 'throw',
  'def', 'self', 'lambda', 'in', 'not', 'and', 'or', 'is', 'with', 'as',
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False',
])

function tokenizeLine(line: string): Tok[] {
  const out: Tok[] = []
  let last = 0
  line.replace(MASTER, (m, cm, st, num, id, offset: number) => {
    if (offset > last) out.push({ text: line.slice(last, offset), t: T.Plain })
    if (cm) out.push({ text: m, t: T.Comment })
    else if (st) out.push({ text: m, t: T.String })
    else if (num) out.push({ text: m, t: T.Number })
    else if (id && KEYWORDS.has(id)) out.push({ text: m, t: T.Keyword })
    else out.push({ text: m, t: T.Plain })
    last = offset + m.length
    return m
  })
  if (last < line.length) out.push({ text: line.slice(last), t: T.Plain })
  return out
}

const sample = `// 流畅科技 · 示例片段
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    // 多次触发只保留最后一次
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

const app = createApp({ name: "uTools" })
app.mount("#desktop")`

const cfg = reactive({
  code: sample,
  title: 'utils.js',
  theme: 'dark' as 'dark' | 'light',
  lines: true,
  dots: true,
  fontSize: 14,
  padding: 24,
  shadow: true,
})

const codeLines = computed(() => cfg.code.split('\n').map(tokenizeLine))

/* ------------------------------ 主题配色 ------------------------------ */
interface Theme {
  bg: string
  win: string
  fg: string
  muted: string
  bar: string
  kw: string
  str: string
  num: string
  cmt: string
}

const DARK: Theme = {
  bg: '#1e293b',
  win: '#0b1020',
  fg: '#e2e8f0',
  muted: '#94a3b8',
  bar: '#111827',
  kw: '#c678dd',
  str: '#98c379',
  num: '#d19a66',
  cmt: '#64748b',
}
const LIGHT: Theme = {
  bg: '#e2e8f0',
  win: '#ffffff',
  fg: '#1f2937',
  muted: '#6b7280',
  bar: '#f1f5f9',
  kw: '#7c3aed',
  str: '#15803d',
  num: '#b45309',
  cmt: '#9ca3af',
}
const th = computed(() => (cfg.theme === 'dark' ? DARK : LIGHT))

const tkColor: Record<T, keyof Theme> = {
  [T.Plain]: 'fg',
  [T.Keyword]: 'kw',
  [T.String]: 'str',
  [T.Number]: 'num',
  [T.Comment]: 'cmt',
}

const tkClass: Record<T, string> = {
  [T.Plain]: 't-plain',
  [T.Keyword]: 't-kw',
  [T.String]: 't-str',
  [T.Number]: 't-num',
  [T.Comment]: 't-cmt',
}

/* ------------------------------ 导出 ------------------------------ */
function measureMaxWidth(ctx: CanvasRenderingContext2D, font: string): number {
  ctx.font = font
  let max = 0
  for (const line of codeLines.value) {
    const w = line.reduce((sum, tk) => sum + ctx.measureText(tk.text).width, 0)
    if (w > max) max = w
  }
  return max
}

function exportPng() {
  const scale = 2
  const fontPx = cfg.fontSize
  const lineHeight = fontPx * 1.7
  const padX = cfg.padding
  const padTop = cfg.padding
  const barH = 40
  const lines = codeLines.value
  const lnW = cfg.lines ? fontPx * 2.2 : 0

  const probe = document.createElement('canvas').getContext('2d')!
  const font = `${fontPx}px ui-monospace, Menlo, Consolas, monospace`
  const codeW = measureMaxWidth(probe, font)
  const frameW = padX * 2 + lnW + codeW + 16
  const frameH = barH + padTop + lines.length * lineHeight + padTop

  const canvas = document.createElement('canvas')
  canvas.width = (frameW + 48) * scale
  canvas.height = (frameH + 48) * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // 背景与窗口
  ctx.fillStyle = th.value.bg
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale)

  const x = 24
  const y = 24
  // 阴影
  if (cfg.shadow) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 26
    ctx.shadowOffsetY = 10
    ctx.fillStyle = th.value.win
    roundRect(ctx, x, y, frameW, frameH, 12)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.fillStyle = th.value.win
    roundRect(ctx, x, y, frameW, frameH, 12)
    ctx.fill()
  }

  // 标题栏
  ctx.fillStyle = th.value.bar
  roundTop(ctx, x, y, frameW, barH + 12, 12)
  ctx.fill()
  if (cfg.dots) {
    const cols = ['#ff5f57', '#febc2e', '#28c840']
    cols.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x + 20 + i * 18, y + barH / 2, 6, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  ctx.fillStyle = th.value.muted
  ctx.font = '13px ui-monospace, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(cfg.title || 'code', x + frameW / 2, y + barH / 2)

  // 代码
  ctx.textAlign = 'left'
  ctx.font = font
  const baseY = y + barH + padTop
  lines.forEach((line, li) => {
    const ly = baseY + li * lineHeight
    // 行号
    if (cfg.lines) {
      ctx.fillStyle = th.value.muted
      ctx.globalAlpha = 0.8
      const num = String(li + 1)
      ctx.fillText(num, x + padX, ly)
      ctx.globalAlpha = 1
    }
    let cx = x + padX + lnW
    for (const tk of line) {
      ctx.fillStyle = th.value[tkColor[tk.t]]
      ctx.fillText(tk.text, cx, ly)
      cx += ctx.measureText(tk.text).width
    }
  })

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = (cfg.title || 'code').replace(/\.\w+$/, '') + '-shot.png'
  a.click()
  ElMessage.success('已导出高清 PNG')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function roundTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
}
</script>

<template>
  <div class="cs">
    <div class="head">
      <div>
        <h3 class="title">代码美化截图</h3>
        <p class="sub">把代码变成带窗口按钮的截图卡片,支持导出高清 PNG</p>
      </div>
      <el-button type="primary" :icon="Camera" @click="exportPng">导出 PNG</el-button>
    </div>

    <div class="cfg">
      <el-input v-model="cfg.title" style="width: 150px" placeholder="文件名" />
      <el-radio-group v-model="cfg.theme" size="small">
        <el-radio-button value="dark">深色</el-radio-button>
        <el-radio-button value="light">浅色</el-radio-button>
      </el-radio-group>
      <el-checkbox v-model="cfg.lines">行号</el-checkbox>
      <el-checkbox v-model="cfg.dots">窗口按钮</el-checkbox>
      <el-checkbox v-model="cfg.shadow">阴影</el-checkbox>
      <span class="lbl">字号</span>
      <el-input-number v-model="cfg.fontSize" :min="11" :max="22" size="small" />
      <span class="lbl">内边距</span>
      <el-input-number v-model="cfg.padding" :min="12" :max="48" size="small" />
    </div>

    <div class="cols">
      <el-input v-model="cfg.code" type="textarea" :rows="16" class="editor" placeholder="粘贴代码…" spellcheck="false" />

      <div class="shot-wrap">
        <div class="shot" :class="{ dark: cfg.theme === 'dark', shadow: cfg.shadow }">
          <div class="shot-bar">
            <span v-if="cfg.dots" class="dp"><i class="d r" /><i class="d y" /><i class="d g" /></span>
            <span class="shot-title">{{ cfg.title || 'code' }}</span>
          </div>
          <div class="shot-body" :style="{ padding: cfg.padding + 'px', fontSize: cfg.fontSize + 'px' }">
            <div v-for="(line, li) in codeLines" :key="li" class="ln">
              <span v-if="cfg.lines" class="num">{{ li + 1 }}</span>
              <span class="code"><span v-for="(tk, i) in line" :key="i" :class="tkClass[tk.t]">{{ tk.text }}</span><span v-if="!line.length"> </span></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="foot">说明:着色采用通用关键词条(注释 / 字符串 / 数字 / 关键词),覆盖常见语言;导出按 2 倍分辨率绘制,适合插入文档或社交媒体。</p>
  </div>
</template>

<style scoped>
.cs {
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
.cfg {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: start;
}
@media (max-width: 900px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.editor :deep(textarea) {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
}
.shot-wrap {
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: var(--el-fill-color-light);
}
.shot {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: #fff;
  color: #1f2937;
  min-width: 300px;
  max-width: 100%;
}
.shot.dark {
  background: #0b1020;
  color: #e2e8f0;
  border-color: #1f2937;
}
.shot-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f1f5f9;
  border-bottom: 1px solid var(--card-border);
}
.shot.dark .shot-bar {
  background: #111827;
  border-color: #1f2937;
}
.dp {
  display: flex;
  gap: 6px;
}
.d {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: inline-block;
}
.d.r {
  background: #ff5f57;
}
.d.y {
  background: #febc2e;
}
.d.g {
  background: #28c840;
}
.shot-title {
  margin: 0 auto;
  font-size: 12px;
  color: #6b7280;
}
.shot.dark .shot-title {
  color: #94a3b8;
}
.shot-body {
  overflow-x: auto;
}
.ln {
  display: flex;
  line-height: 1.7;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  white-space: pre;
}
.num {
  width: 2.2em;
  text-align: right;
  margin-right: 1em;
  color: #9ca3af;
  flex: none;
  user-select: none;
}
.shot.dark .num {
  color: #475569;
}
.t-kw {
  color: #7c3aed;
}
.shot.dark .t-kw {
  color: #c678dd;
}
.t-str {
  color: #15803d;
}
.shot.dark .t-str {
  color: #98c379;
}
.t-num {
  color: #b45309;
}
.shot.dark .t-num {
  color: #d19a66;
}
.t-cmt {
  color: #9ca3af;
  font-style: italic;
}
.shot.dark .t-cmt {
  color: #64748b;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
