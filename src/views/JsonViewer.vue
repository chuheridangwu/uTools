<script setup lang="ts">
/**
 * JSON 查看器
 * 完整对齐 json.cn/jsononline:
 *   · 左侧输入(行号 + 等宽对齐),中间可拖动分隔条,右侧格式化结果
 *   · 结果区左上角工具条:压缩 / 转XML / 显示行号 / 清空 / 保存 / 复制 / 折叠 / 示例 / 保留转义 / 全屏
 *   · 语法着色、对象与数组可折叠(折叠后显示 Object{...} / Array[n])、键值可点击编辑
 *   · 字符串里的网址自动变链接;图片地址点击弹出小图预览
 *   · 支持 XML 自动转 JSON、超大整数不丢精度、错误信息定位
 * 全部本地完成,零新增依赖。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Delete,
  Document,
  Download,
  Fold,
  FullScreen,
  List,
  MagicStick,
  Minus,
  Plus,
  ScaleToOriginal,
} from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

/** 缩进(与参考站一致:4 空格) */
const INDENT = '    '
/** 超大整数占位前缀(私有区字符,正常 JSON 里几乎不可能出现) */
const BIG_PREFIX = '\uE000'

/* ------------------------------ 状态 ------------------------------ */

const input = ref('')
const keepEscape = ref(true)
const showLines = ref(false)
const fullscreen = ref(false)
/** 结果区的三种展示:格式化 JSON / 压缩 / XML */
const viewMode = ref<'json' | 'zip' | 'xml'>('json')
const foldedAll = ref(false)
const error = ref('')
const zipText = ref('')
const xmlText = ref('')

const leftPct = ref(41.67)
const dragging = ref(false)

const srcEl = ref<HTMLTextAreaElement | null>(null)
const panesEl = ref<HTMLElement | null>(null)
const targetEl = ref<HTMLElement | null>(null)
const outScrollEl = ref<HTMLElement | null>(null)
const inLinesEl = ref<HTMLElement | null>(null)
const outLinesEl = ref<HTMLElement | null>(null)

const outLineCount = ref(1)
const inLineCount = computed(() => Math.max(1, input.value.split('\n').length))
const hasContent = computed(() => input.value.trim().length > 0)

/** 解析后的值(不参与渲染依赖,渲染走命令式 innerHTML) */
let parsedValue: unknown = null
/** 是否已成功解析(区分「没内容」与「内容就是 null」) */
let parsedOk = false
let editTimer = 0
let inputTimer = 0

interface ImgPreview {
  url: string
  left: number
  top: number
}
const imagePreview = ref<ImgPreview | null>(null)

/* ------------------------------ 基础工具 ------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function isUrl(s: string): boolean {
  return /^(https?:\/\/|ftp:\/\/|mailto:)/i.test(s)
}

/** 判断是否为图片地址(用于弹出小图预览) */
function isImageUrl(s: string): boolean {
  if (/^data:image\//i.test(s)) return true
  if (!/^https?:\/\//i.test(s)) return false
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?|#|$)/i.test(s)
}

/**
 * 把 16 位以上的整数包成字符串占位,避免 JSON.parse 丢精度。
 * 只扫描字符串外部,不会误伤内容。
 */
function wrapBigNumbers(src: string): string {
  let out = ''
  let i = 0
  let inStr = false
  while (i < src.length) {
    const c = src[i]
    if (inStr) {
      out += c
      if (c === '\\') {
        out += src[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === '"') inStr = false
      i += 1
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      i += 1
      continue
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i
      if (src[j] === '-') j += 1
      const digitStart = j
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1
      let isInt = true
      if (src[j] === '.') {
        isInt = false
        j += 1
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1
      }
      if (src[j] === 'e' || src[j] === 'E') {
        isInt = false
        j += 1
        if (src[j] === '+' || src[j] === '-') j += 1
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1
      }
      const digits = src.slice(digitStart, j)
      if (isInt && digits.length >= 16) {
        out += `"${BIG_PREFIX}${src.slice(i, j)}"`
      } else {
        out += src.slice(i, j)
      }
      i = j
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** 还原占位的大整数 */
function unwrapBig(s: string): string {
  return s.replace(new RegExp(`"${BIG_PREFIX}(-?\\d+)"`, 'g'), '$1')
}

/* ------------------------------ 渲染 ------------------------------ */

function renderValue(v: unknown, depth: number): string {
  if (v === null || v === undefined) {
    return '<span class="jv-null" contenteditable="true">null</span>'
  }
  if (typeof v === 'boolean') {
    return `<span class="jv-bool" contenteditable="true">${v ? 'true' : 'false'}</span>`
  }
  if (typeof v === 'number') {
    return `<span class="jv-num" contenteditable="true">${String(v)}</span>`
  }
  if (typeof v === 'string') {
    if (v.startsWith(BIG_PREFIX)) {
      return `<span class="jv-num" contenteditable="true">${esc(v.slice(1))}</span>`
    }
    const inner = esc(v)
    let body = `"${inner}"`
    if (isUrl(v)) {
      const cls = isImageUrl(v) ? 'jv-link jv-img-link' : 'jv-link'
      body = `"<a class="${cls}" href="${esc(v)}" target="_blank" rel="noreferrer">${inner}</a>"`
    }
    return `<span class="jv-str" contenteditable="true">${body}</span>`
  }
  if (Array.isArray(v)) {
    const n = v.length
    if (!n) {
      return '<span class="jv-container" data-type="array" data-size="0"><i class="jv-ic"></i><span class="jv-body">[]</span><span class="jv-summary">Array[0]</span></span>'
    }
    const pad = INDENT.repeat(depth)
    const padIn = INDENT.repeat(depth + 1)
    const items = v.map((x) => padIn + renderValue(x, depth + 1)).join(',\n')
    return `<span class="jv-container" data-type="array" data-size="${n}"><i class="jv-ic"></i><span class="jv-body">[\n${items}\n${pad}]</span><span class="jv-summary">Array[${n}]</span></span>`
  }
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj)
  if (!keys.length) {
    return '<span class="jv-container" data-type="object" data-size="0"><i class="jv-ic"></i><span class="jv-body">{}</span><span class="jv-summary">Object{...}</span></span>'
  }
  const pad = INDENT.repeat(depth)
  const padIn = INDENT.repeat(depth + 1)
  const body = keys
    .map(
      (k) =>
        `${padIn}<span class="jv-key" contenteditable="true">"${esc(k)}"</span>: ${renderValue(obj[k], depth + 1)}`,
    )
    .join(',\n')
  return `<span class="jv-container" data-type="object" data-size="${keys.length}"><i class="jv-ic"></i><span class="jv-body">{\n${body}\n${pad}}</span><span class="jv-summary">Object{...}</span></span>`
}

/** 把解析结果渲染进结果区 */
function renderTarget(): void {
  const el = targetEl.value
  if (!el) return
  if (!parsedOk) {
    el.innerHTML = ''
    outLineCount.value = 1
    return
  }  el.innerHTML = renderValue(parsedValue, 0)
  foldedAll.value = false
  void nextTick(refreshLineCount)
}

/* ------------------------------ 文本抽取 ------------------------------ */

/**
 * 从结果区 DOM 还原成纯文本。
 * expandCollapsed = true 时忽略折叠状态(复制 / 保存用)。
 */
function serialize(node: Node, expandCollapsed: boolean): string {
  if (node.nodeType === 3) return node.nodeValue ?? ''
  if (node.nodeType !== 1) return ''
  const el = node as HTMLElement
  if (el.classList.contains('jv-ic') || el.classList.contains('jv-summary')) return ''
  if (el.tagName === 'BR') return '\n'
  if (el.classList.contains('jv-container') && el.classList.contains('collapsed') && !expandCollapsed) {
    return el.dataset.type === 'array' ? `Array[${el.dataset.size ?? 0}]` : 'Object{...}'
  }
  let out = ''
  for (const child of Array.from(el.childNodes)) out += serialize(child, expandCollapsed)
  // contenteditable 里回车会生成 <div>/<p>,补一个换行
  if ((el.tagName === 'DIV' || el.tagName === 'P') && !el.classList.contains('jv-target')) {
    return `\n${out}`
  }
  return out
}

/** 当前可见文本(折叠的容器按摘要计一行) */
function visibleText(): string {
  const el = targetEl.value
  if (!el) return ''
  return serialize(el, false)
}

/** 完整文本(强制展开) */
function fullText(): string {
  const el = targetEl.value
  if (!el) return ''
  return serialize(el, true)
}

/** 同步结果区行号 */
function refreshLineCount(): void {
  if (viewMode.value === 'zip') {
    outLineCount.value = Math.max(1, zipText.value.split('\n').length)
    return
  }
  if (viewMode.value === 'xml') {
    outLineCount.value = Math.max(1, xmlText.value.split('\n').length)
    return
  }
  outLineCount.value = Math.max(1, visibleText().split('\n').length)
}

/* ------------------------------ XML 互转 ------------------------------ */

/** XML → JSON(同名兄弟节点合并为数组) */
function xmlToJson(xml: string): unknown {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML 格式错误')
  const toValue = (el: Element): unknown => {
    const children = Array.from(el.children)
    const text = (el.textContent ?? '').trim()
    if (!children.length) {
      if (!text) return ''
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return Number(text)
      if (text === 'true') return true
      if (text === 'false') return false
      if (text === 'null') return null
      return text
    }
    const obj: Record<string, unknown> = {}
    for (const child of children) {
      const key = child.tagName
      const val = toValue(child)
      if (key in obj) {
        const prev = obj[key]
        obj[key] = Array.isArray(prev) ? [...prev, val] : [prev, val]
      } else {
        obj[key] = val
      }
    }
    return obj
  }
  return toValue(doc.documentElement)
}

/** JSON → XML(2 空格缩进,数组用 <item> 重复) */
function jsonToXml(value: unknown): string {
  const lines: string[] = []
  const tag = (s: string): string => {
    const t = s.replace(/[^\w.\-:]/g, '_')
    return /^[A-Za-z_]/.test(t) ? t : `_${t}`
  }
  const build = (val: unknown, name: string, depth: number): void => {
    const pad = '  '.repeat(depth)
    if (val === null || val === undefined) {
      lines.push(`${pad}<${name}/>`)
      return
    }
    if (Array.isArray(val)) {
      if (!val.length) lines.push(`${pad}<${name}/>`)
      else val.forEach((item) => build(item, 'item', depth))
      return
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val as Record<string, unknown>)
      if (!entries.length) {
        lines.push(`${pad}<${name}/>`)
        return
      }
      lines.push(`${pad}<${name}>`)
      entries.forEach(([k, v]) => build(v, tag(k), depth + 1))
      lines.push(`${pad}</${name}>`)
      return
    }
    lines.push(`${pad}<${name}>${esc(String(val))}</${name}>`)
  }
  build(value, 'root', 0)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + lines.join('\n')
}

/* ------------------------------ 解析 ------------------------------ */

/** 返回 { ok, value } 或 { ok:false, msg } */
function parseSource(raw: string): { ok: true; value: unknown } | { ok: false; msg: string } {
  let content = raw
  // XML 输入自动转 JSON
  if (content.startsWith('<') && content.endsWith('>')) {
    try {
      content = JSON.stringify(xmlToJson(content))
    } catch (e) {
      return { ok: false, msg: `解析错误:${(e as Error).message}` }
    }
  }
  if (keepEscape.value) {
    content = content.replace(/\\/g, '\\\\').replace(/\\"/g, '\\\\"')
  }
  content = wrapBigNumbers(content)
  try {
    return { ok: true, value: JSON.parse(content) }
  } catch (e) {
    return { ok: false, msg: String(e) }
  }
}

/** 完整解析:更新状态 + 重绘结果区 */
function parseAndRender(): void {
  const raw = input.value.trim()
  error.value = ''
  imagePreview.value = null
  if (!raw) {
    parsedValue = null
    parsedOk = false
    zipText.value = ''
    xmlText.value = ''
    viewMode.value = 'json'
    void nextTick(renderTarget)
    return
  }
  const res = parseSource(raw)
  if (!res.ok) {
    parsedValue = null
    parsedOk = false
    error.value = res.msg
    zipText.value = ''
    xmlText.value = ''
    const el = targetEl.value
    if (el) el.innerHTML = ''
    outLineCount.value = 1
    return
  }
  parsedValue = res.value
  parsedOk = true
  zipText.value = unwrapBig(JSON.stringify(res.value))
  xmlText.value = jsonToXml(res.value)
  viewMode.value = 'json'
  // 结果区是 v-if/v-else 切换出来的,必须等 DOM 更新后再写入
  void nextTick(renderTarget)
}

/** 静默解析(编辑结果区时用,不重绘,避免光标跳动) */
function silentParse(text: string): void {
  const res = parseSource(text)
  if (!res.ok) return
  parsedValue = res.value
  parsedOk = true
  zipText.value = unwrapBig(JSON.stringify(res.value))
  xmlText.value = jsonToXml(res.value)
}

function onInput(): void {
  window.clearTimeout(inputTimer)
  inputTimer = window.setTimeout(parseAndRender, 120)
}

/* ------------------------------ 折叠 ------------------------------ */

function toggleNode(ic: HTMLElement): void {
  const box = ic.closest('.jv-container') as HTMLElement | null
  if (!box) return
  box.classList.toggle('collapsed')
  refreshLineCount()
}

/** 折叠 / 展开全部 */
function toggleFold(): void {
  if (viewMode.value !== 'json' || !targetEl.value) return
  const containers = Array.from(targetEl.value.querySelectorAll<HTMLElement>('.jv-container'))
  if (!containers.length) return
  const next = !foldedAll.value
  containers.forEach((c) => c.classList.toggle('collapsed', next))
  foldedAll.value = next
  refreshLineCount()
}

/* ------------------------------ 工具条动作 ------------------------------ */

function toggleZip(): void {
  if (error.value) return
  if (!parsedOk) {
    ElMessage.warning('请先输入 JSON')
    return
  }
  viewMode.value = viewMode.value === 'zip' ? 'json' : 'zip'
  void nextTick(() => {
    if (viewMode.value === 'json') renderTarget()
    refreshLineCount()
    syncOutScroll()
  })
}

function toggleXml(): void {
  if (error.value) return
  if (!parsedOk) {
    ElMessage.warning('请先输入 JSON')
    return
  }
  viewMode.value = viewMode.value === 'xml' ? 'json' : 'xml'
  void nextTick(() => {
    if (viewMode.value === 'json') renderTarget()
    refreshLineCount()
    syncOutScroll()
  })
}

function toggleLines(): void {
  showLines.value = !showLines.value
  void nextTick(() => {
    refreshLineCount()
    syncOutScroll()
    syncSrcScroll()
  })
}

function clearAll(): void {
  input.value = ''
  parsedValue = null
  parsedOk = false
  error.value = ''
  zipText.value = ''
  xmlText.value = ''
  viewMode.value = 'json'
  foldedAll.value = false
  imagePreview.value = null
  void nextTick(renderTarget)
  ElMessage.success('已清空')
}

async function copyAll(): Promise<void> {
  if (viewMode.value === 'json' && targetEl.value) {
    // 与参考站一致:复制前先展开全部
    targetEl.value.querySelectorAll<HTMLElement>('.jv-container').forEach((c) => c.classList.remove('collapsed'))
    foldedAll.value = false
    refreshLineCount()
  }
  const text = viewMode.value === 'zip' ? zipText.value : viewMode.value === 'xml' ? xmlText.value : fullText()
  if (!text.trim()) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  if (await copyText(text)) ElMessage.success('已复制到剪贴板')
  else ElMessage.error('复制失败')
}

function saveFile(): void {
  const text = viewMode.value === 'zip' ? zipText.value : viewMode.value === 'xml' ? xmlText.value : fullText()
  if (!text.trim()) {
    ElMessage.warning('没有可保存的内容')
    return
  }
  const isXml = viewMode.value === 'xml'
  const name = `format.${Date.now()}.${isXml ? 'xml' : 'json'}`
  downloadText(text, name, isXml ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8')
  ElMessage.success('已保存')
}

function useSample(): void {
  // 用原始字符串而不是 JSON.stringify:超大整数在 JS 数字里会先丢精度
  input.value = `{
  "title": "JSON 在线解析",
  "json.url": "https://www.json.cn",
  "avatar": "https://static.json.cn/r/img/avatars/avatar_un_login.png",
  "keywords": "JSON在线解析",
  "Function": ["JSON美化", "JSON数据类型显示", "JSON数组显示角标", "高亮显示", "错误提示"],
  "numbers": [305667554401374209, 103248655202358790, 123456789012345679],
  "About": { "QQ": 661275469, "作者": "json.cn" },
  "Special": ["<h1>JSON在线解析</h1>", "gbk -> utf-8", "&currency", "&timestamp"],
  "content": "永和九年,岁在癸丑,暮春之初,会于会稽山阴之兰亭,修禊事也。",
  "enabled": true,
  "extra": null
}`
  parseAndRender()
}

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
  void nextTick(() => {
    refreshLineCount()
    syncOutScroll()
  })
}

/* ------------------------------ 图片预览 ------------------------------ */

function showImagePreview(a: HTMLAnchorElement): void {
  const app = panesEl.value
  if (!app) return
  const appRect = app.getBoundingClientRect()
  const r = a.getBoundingClientRect()
  const w = 260
  const left = Math.min(Math.max(8, r.left - appRect.left), Math.max(8, appRect.width - w - 8))
  const top = Math.min(r.bottom - appRect.top + 6, Math.max(8, appRect.height - 220))
  imagePreview.value = { url: a.getAttribute('href') ?? '', left, top }
  // 点空白处关闭
  window.setTimeout(() => document.addEventListener('pointerdown', onDocPointerDown, true), 0)
}

function onDocPointerDown(e: PointerEvent): void {
  const pop = document.querySelector('.jv-imgpop')
  if (pop && e.target instanceof Node && pop.contains(e.target)) return
  closePreview()
}

function closePreview(): void {
  imagePreview.value = null
  document.removeEventListener('pointerdown', onDocPointerDown, true)
}

/** 点在折叠图标 / 链接上时不要抢光标(否则 contenteditable 会先定位) */
function onTargetMouseDown(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (target.closest('.jv-ic') || target.closest('a.jv-link')) e.preventDefault()
}

function onTargetClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  const ic = target.closest('.jv-ic')
  if (ic) {
    e.preventDefault()
    toggleNode(ic as HTMLElement)
    return
  }
  const link = target.closest('a.jv-link') as HTMLAnchorElement | null
  if (link) {
    e.preventDefault()
    e.stopPropagation()
    if (link.classList.contains('jv-img-link')) showImagePreview(link)
    else window.open(link.href, '_blank', 'noopener')
  }
}

/** 结果区被编辑后,把文本同步回左侧输入框 */
function onEdit(): void {
  if (viewMode.value !== 'json') return
  window.clearTimeout(editTimer)
  editTimer = window.setTimeout(() => {
    const text = fullText()
    if (!text) return
    input.value = text
    silentParse(text)
    refreshLineCount()
  }, 350)
}

/* ------------------------------ 行号滚动同步 ------------------------------ */

function onOutScroll(): void {
  syncOutScroll()
}

function syncOutScroll(): void {
  const scroller = outScrollEl.value
  const lines = outLinesEl.value
  if (scroller && lines) lines.style.transform = `translateY(${-scroller.scrollTop}px)`
}

function syncSrcScroll(): void {
  const src = srcEl.value
  const lines = inLinesEl.value
  if (src && lines) lines.style.transform = `translateY(${-src.scrollTop}px)`
}

/* ------------------------------ 拖动分隔条 ------------------------------ */

let dragStartX = 0
let dragStartPct = 0

function onDragDown(e: PointerEvent): void {
  dragging.value = true
  dragStartX = e.clientX
  dragStartPct = leftPct.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
  e.preventDefault()
}

function onDragMove(e: PointerEvent): void {
  const box = panesEl.value
  if (!box) return
  const w = box.getBoundingClientRect().width
  if (!w) return
  const delta = ((e.clientX - dragStartX) / w) * 100
  leftPct.value = Math.max(22, Math.min(78, dragStartPct + delta))
}

function onDragUp(): void {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
}

/* ------------------------------ 生命周期 ------------------------------ */

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (imagePreview.value) closePreview()
    else if (fullscreen.value) fullscreen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.clearTimeout(editTimer)
  window.clearTimeout(inputTimer)
})
</script>

<template>
  <ToolPage>
    <template #title>JSON 查看器</template>
    <template #desc>
      格式化 / 校验 / 折叠浏览 / 键值编辑 / 压缩 / 转 XML;网址自动变链接,图片地址点击可预览小图。
    </template>

    <div class="jv-app" :class="{ 'is-full': fullscreen }">
      <div ref="panesEl" class="jv-panes">
        <!-- 左:输入 -->
        <div class="jv-left" :style="{ width: `${leftPct}%` }">
          <div v-show="showLines" class="jv-gutter">
            <div ref="inLinesEl" class="jv-lines">
              <div v-for="n in inLineCount" :key="n">{{ n }}</div>
            </div>
          </div>
          <textarea
            ref="srcEl"
            v-model="input"
            class="jv-src"
            :class="{ nowrap: showLines }"
            placeholder="请输入json数据..."
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            @input="onInput"
            @scroll="syncSrcScroll"
          />
        </div>

        <!-- 拖动分隔条 -->
        <div class="jv-drag" :class="{ on: dragging }" @pointerdown="onDragDown" />

        <!-- 右:结果 -->
        <div class="jv-right">
          <div class="jv-toolbar">
            <button
              class="jv-btn"
              :class="{ active: viewMode === 'zip' }"
              :title="viewMode === 'zip' ? '格式化' : '压缩'"
              @click="toggleZip"
            >
              <el-icon><Fold /></el-icon>
            </button>
            <button
              class="jv-btn"
              :class="{ active: viewMode === 'xml' }"
              :title="viewMode === 'xml' ? '转JSON' : '转XML'"
              @click="toggleXml"
            >
              <el-icon><Document /></el-icon>
            </button>
            <button
              class="jv-btn"
              :class="{ active: showLines }"
              :title="showLines ? '隐藏行号' : '显示行号'"
              @click="toggleLines"
            >
              <el-icon><List /></el-icon>
            </button>
            <button class="jv-btn" title="清空" @click="clearAll">
              <el-icon><Delete /></el-icon>
            </button>
            <button class="jv-btn" title="保存" @click="saveFile">
              <el-icon><Download /></el-icon>
            </button>
            <button class="jv-btn" title="复制" @click="copyAll">
              <el-icon><CopyDocument /></el-icon>
            </button>
            <button
              class="jv-btn"
              :class="{ active: foldedAll }"
              :title="foldedAll ? '展开' : '折叠'"
              @click="toggleFold"
            >
              <el-icon><Minus v-if="!foldedAll" /><Plus v-else /></el-icon>
            </button>
            <button class="jv-btn" title="示例" @click="useSample">
              <el-icon><MagicStick /></el-icon>
            </button>

            <label class="jv-check">
              <input v-model="keepEscape" type="checkbox" @change="parseAndRender" />
              <span>保留转义</span>
            </label>

            <button
              class="jv-btn jv-full"
              :title="fullscreen ? '最小化' : '全屏'"
              @click="toggleFullscreen"
            >
              <el-icon><ScaleToOriginal v-if="fullscreen" /><FullScreen v-else /></el-icon>
            </button>
          </div>

          <div class="jv-bottom">
            <div v-show="showLines" class="jv-gutter">
              <div ref="outLinesEl" class="jv-lines">
                <div v-for="n in outLineCount" :key="n">{{ n }}</div>
              </div>
            </div>
            <div ref="outScrollEl" class="jv-scroll" :class="{ nowrap: showLines }" @scroll="onOutScroll">
              <div v-if="!hasContent" class="jv-tip">可点击键值进行编辑</div>
              <div v-else-if="error" class="jv-error">{{ error }}</div>
              <div
                v-else-if="viewMode === 'json'"
                ref="targetEl"
                class="jv-target"
                @click="onTargetClick"
                @mousedown="onTargetMouseDown"
                @input="onEdit"
              />
              <pre v-else class="jv-raw">{{ viewMode === 'zip' ? zipText : xmlText }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 图片小图预览 -->
      <div
        v-if="imagePreview"
        class="jv-imgpop"
        :style="{ left: `${imagePreview.left}px`, top: `${imagePreview.top}px` }"
      >
        <img :src="imagePreview.url" alt="图片预览" referrerpolicy="no-referrer" />
        <a :href="imagePreview.url" target="_blank" rel="noreferrer">打开原图</a>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.jv-app {
  --jv-border: #e3e6eb;
  --jv-soft: #f7f8fa;
  --jv-text: #172b4d;
  --jv-muted: #6b7f99;
  --jv-accent: #0d6efd;
  --jv-lh: 22px;

  position: relative;
  height: clamp(420px, 66vh, 760px);
  border: 1px solid var(--jv-border);
  border-radius: 8px;
  background: #fff;
  color: var(--jv-text);
  font-size: 14px;
  overflow: hidden;
}
html.dark .jv-app {
  --jv-border: #2a323c;
  --jv-soft: #1f252d;
  --jv-text: #e6edf3;
  --jv-muted: #8b98a5;
  --jv-accent: #4c9aff;
  background: #171c23;
}
.jv-app.is-full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  height: auto;
  border: none;
  border-radius: 0;
}

.jv-panes {
  display: flex;
  height: 100%;
  min-height: 0;
}
.jv-left {
  display: flex;
  min-width: 0;
  height: 100%;
  position: relative;
}
.jv-right {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
}

/* 输入框 */
.jv-src {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 10px 12px 40px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--jv-text);
  font-family: inherit;
  font-size: 14px;
  line-height: var(--jv-lh);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.jv-src.nowrap {
  white-space: pre;
  overflow-x: auto;
}
.jv-src::placeholder {
  color: var(--jv-muted);
  opacity: 0.7;
}

/* 行号 */
.jv-gutter {
  flex: none;
  width: 40px;
  overflow: hidden;
  border-right: 1px dashed var(--jv-border);
  background: var(--jv-soft);
}
.jv-lines {
  padding-top: 10px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: var(--jv-lh);
  color: var(--jv-muted);
  text-align: right;
  padding-right: 6px;
  user-select: none;
  will-change: transform;
}

/* 拖动条 */
.jv-drag {
  flex: none;
  width: 9px;
  margin: 0 -4px;
  z-index: 5;
  cursor: col-resize;
  position: relative;
}
.jv-drag::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--jv-border);
}
.jv-drag.on::before,
.jv-drag:hover::before {
  background: var(--jv-accent);
}

/* 工具条 */
.jv-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--jv-border);
}
.jv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--jv-muted);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.jv-btn:hover {
  background: var(--jv-soft);
  color: var(--jv-accent);
}
.jv-btn.active {
  color: var(--jv-accent);
  background: color-mix(in srgb, var(--jv-accent) 12%, transparent);
}
.jv-full {
  margin-left: auto;
}
.jv-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 6px;
  font-size: 12.5px;
  color: var(--jv-muted);
  cursor: pointer;
  user-select: none;
}
.jv-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--jv-accent);
}

/* 结果区 */
.jv-bottom {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.jv-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
  position: relative;
}
.jv-target {
  padding: 10px 12px 40px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: var(--jv-lh);
  outline: none;
}
.jv-scroll.nowrap .jv-target {
  white-space: pre;
  word-break: normal;
}
.jv-raw {
  margin: 0;
  padding: 10px 12px 40px;
  font-family: inherit;
  font-size: 14px;
  line-height: var(--jv-lh);
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--jv-text);
}
.jv-tip {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 12px;
  color: var(--jv-muted);
  pointer-events: none;
}
.jv-error {
  padding: 10px 12px;
  color: #f1592a;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
}

/* 语法着色(取自参考站)
   注意:结果区内容是 innerHTML 动态生成的,拿不到 scoped 的 data-v 属性,
   必须用 :deep() 才能命中。 */
.jv-target :deep(.jv-key) {
  color: #92278f;
  font-weight: 700;
}
.jv-target :deep(.jv-str) {
  color: #3ab54a;
  font-weight: 700;
}
.jv-target :deep(.jv-num) {
  color: #25aae2;
  font-weight: 700;
}
.jv-target :deep(.jv-bool) {
  color: #f98280;
  font-weight: 700;
}
.jv-target :deep(.jv-null) {
  color: #f1592a;
  font-weight: 700;
}
.jv-target :deep(.jv-link) {
  color: #61d2d6;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.jv-target :deep(.jv-link.jv-img-link) {
  text-decoration-style: dotted;
}
.jv-target :deep(.jv-key:focus),
.jv-target :deep(.jv-str:focus),
.jv-target :deep(.jv-num:focus),
.jv-target :deep(.jv-bool:focus),
.jv-target :deep(.jv-null:focus) {
  outline: 1px dashed var(--jv-accent);
  outline-offset: 1px;
  border-radius: 2px;
}

/* 折叠图标:展开=红色减号框,折叠=蓝色加号框 */
.jv-target :deep(.jv-ic) {
  display: inline-block;
  width: 11px;
  height: 11px;
  margin-right: 3px;
  border: 1.5px solid #e5484d;
  border-radius: 2px;
  position: relative;
  top: 1px;
  cursor: pointer;
  vertical-align: baseline;
}
.jv-target :deep(.jv-ic::before),
.jv-target :deep(.jv-ic::after) {
  content: '';
  position: absolute;
  background: #e5484d;
}
.jv-target :deep(.jv-ic::before) {
  left: 1.5px;
  right: 1.5px;
  top: 3.2px;
  height: 1.5px;
}
.jv-target :deep(.jv-ic::after) {
  top: 1.5px;
  bottom: 1.5px;
  left: 3.2px;
  width: 1.5px;
  display: none;
}
.jv-target :deep(.jv-container.collapsed > .jv-ic) {
  border-color: #0ea5e9;
}
.jv-target :deep(.jv-container.collapsed > .jv-ic::before),
.jv-target :deep(.jv-container.collapsed > .jv-ic::after) {
  background: #0ea5e9;
}
.jv-target :deep(.jv-container.collapsed > .jv-ic::after) {
  display: block;
}
.jv-target :deep(.jv-container > .jv-summary) {
  display: none;
}
.jv-target :deep(.jv-container.collapsed > .jv-body) {
  display: none;
}
.jv-target :deep(.jv-container.collapsed > .jv-summary) {
  display: inline;
}

/* 图片小图预览 */
.jv-imgpop {
  position: absolute;
  z-index: 20;
  width: 260px;
  padding: 8px;
  border: 1px solid var(--jv-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 28px -6px rgb(9 30 66 / 30%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
html.dark .jv-imgpop {
  background: #171c23;
}
.jv-imgpop img {
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  border-radius: 4px;
  background: var(--jv-soft);
}
.jv-imgpop a {
  font-size: 12px;
  color: var(--jv-accent);
  text-decoration: none;
}
.jv-imgpop a:hover {
  text-decoration: underline;
}

/* 窄屏:上下排列 */
@media (max-width: 760px) {
  .jv-app {
    height: auto;
  }
  .jv-panes {
    flex-direction: column;
  }
  .jv-left {
    width: 100% !important;
    height: 220px;
    border-bottom: 1px solid var(--jv-border);
  }
  .jv-drag {
    display: none;
  }
  .jv-right {
    height: 380px;
  }
}
</style>
