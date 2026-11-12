<script setup lang="ts">
/**
 * 长图拼接
 * 多张图片按顺序拼接为一张长图:横向或纵向,可设定 间距/对齐/背景色/最大宽度。
 * 界面参考「好拼」(img.ops-coffee.com)的三栏布局:左侧拼接设置 + 图片顺序、
 * 中间画布预览与工具条、右侧样式调整与导出;功能与旧版完全一致,全部在本地完成。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, ArrowUp, Close, Delete, Download, Plus } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'
import { canvasToBlob, loadImage } from '@/utils/image'

interface Item {
  file: File
  img: HTMLImageElement
  /** 缩略图用的对象 URL(loadImage 内部的 URL 已释放,不能复用) */
  url: string
}

const items = ref<Item[]>([])
const direction = ref<'vertical' | 'horizontal'>('vertical')
const gap = ref(10)
const alignment = ref<'start' | 'center' | 'end'>('center')
const bgColor = ref('#ffffff')
const maxWidth = ref(1080)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)

/* ------------------------------ 加入 / 排序 ------------------------------ */

/** 逐张加载,保持用户选择的顺序;失败的单张跳过并提示 */
async function addFiles(files: FileList | File[]) {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (!list.length) {
    ElMessage.warning('请选择图片文件')
    return
  }
  for (const f of list) {
    try {
      const img = await loadImage(f)
      items.value.push({ file: f, img, url: URL.createObjectURL(f) })
      render()
    } catch {
      ElMessage.warning(`${f.name} 加载失败`)
    }
  }
}

function pick() {
  fileRef.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) void addFiles(input.files)
  input.value = ''
}

function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
  render()
}

function removeAt(i: number) {
  const [gone] = items.value.splice(i, 1)
  if (gone) URL.revokeObjectURL(gone.url)
  render()
}

function clearAll() {
  items.value.forEach((it) => URL.revokeObjectURL(it.url))
  items.value = []
  render()
}

/* ------------------------------ 拖拽导入 ------------------------------ */

const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)

function onDragEnter() {
  dragDepth.value += 1
}

function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(e: DragEvent) {
  dragDepth.value = 0
  const files = e.dataTransfer?.files
  if (files?.length) void addFiles(files)
}

/* ------------------------------ 计算 / 绘制 ------------------------------ */

/** 根据参数计算目标尺寸 */
const outSize = computed(() => {
  const imgs = items.value.map((it) => it.img)
  if (!imgs.length) return { w: 0, h: 0 }
  if (direction.value === 'vertical') {
    const w = Math.min(maxWidth.value, Math.max(...imgs.map((i) => i.naturalWidth)))
    const scaled = imgs.map((i) => ({ w, h: Math.round((i.naturalHeight / i.naturalWidth) * w) }))
    return { w, h: scaled.reduce((s, x) => s + x.h, 0) + gap.value * (imgs.length - 1) }
  }
  // 横向:以最小高度为准缩放
  const h = Math.min(...imgs.map((i) => i.naturalHeight))
  const scaled = imgs.map((i) => ({ h, w: Math.round((i.naturalWidth / i.naturalHeight) * h) }))
  return { w: scaled.reduce((s, x) => s + x.w, 0) + gap.value * (imgs.length - 1), h }
})

function render() {
  const c = canvasRef.value
  if (!c) return
  if (!items.value.length) {
    c.width = 0
    c.height = 0
    return
  }
  const { w, h } = outSize.value
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, w, h)

  let cursor = 0
  for (const it of items.value) {
    const src = it.img
    if (direction.value === 'vertical') {
      const dh = Math.round((src.naturalHeight / src.naturalWidth) * w)
      ctx.drawImage(src, 0, cursor, w, dh)
      cursor += dh + gap.value
    } else {
      const dh = Math.min(...items.value.map((x) => x.img.naturalHeight))
      const dw = Math.round((src.naturalWidth / src.naturalHeight) * dh)
      const yOff = alignment.value === 'start' ? 0 : alignment.value === 'end' ? h - dh : (h - dh) / 2
      ctx.drawImage(src, cursor, yOff, dw, dh)
      cursor += dw + gap.value
    }
  }
}

watch([direction, gap, alignment, bgColor, maxWidth], () => render())

/* ------------------------------ 导出 ------------------------------ */

/** 拼接并下载 */
async function download() {
  const c = canvasRef.value
  if (!c || !items.value.length) {
    ElMessage.warning('请先加入图片')
    return
  }
  try {
    const blob = await canvasToBlob(c, 'image/png')
    downloadBlob(blob, `stitch-${Date.now()}.png`)
    ElMessage.success('已导出长图')
  } catch (e) {
    ElMessage.error(`导出失败: ${(e as Error).message}`)
  }
}

onBeforeUnmount(() => {
  items.value.forEach((it) => URL.revokeObjectURL(it.url))
})
</script>

<template>
  <ToolPage>
    <template #title>长图拼接</template>
    <template #desc>
      多张图片按顺序拼接成一张长图,支持纵向 / 横向、间距、对齐与背景色,实时预览;所有处理都在本机完成。
    </template>

    <div
      class="st-app"
      :class="{ 'is-dragging': dragging }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- 左栏:拼接设置 + 图片顺序 -->
      <aside class="st-side st-left">
        <div class="st-block">
          <h3 class="st-title">拼图设置</h3>
          <div class="st-label">拼接方向</div>
          <div class="st-seg">
            <button :class="{ active: direction === 'vertical' }" @click="direction = 'vertical'">竖向</button>
            <button :class="{ active: direction === 'horizontal' }" @click="direction = 'horizontal'">横向</button>
          </div>

          <div class="st-label">选择图片</div>
          <button class="st-btn ghost full" @click="pick">
            <el-icon><Plus /></el-icon>
            <span>点击选择或拖拽图片</span>
          </button>
          <input ref="fileRef" type="file" accept="image/*" multiple hidden @change="onFileChange" />
          <p class="st-hint">支持一次选择多张,按选择顺序拼接。</p>
        </div>

        <div v-if="items.length" class="st-block st-grow">
          <h3 class="st-title">图片顺序<span class="st-count">{{ items.length }}</span></h3>
          <ul class="st-list">
            <li v-for="(it, i) in items" :key="it.url" class="st-item">
              <img :src="it.url" :alt="it.file.name" class="st-thumb" />
              <div class="st-item-main">
                <span class="st-name" :title="it.file.name">{{ it.file.name }}</span>
                <span class="st-meta">{{ it.img.naturalWidth }} × {{ it.img.naturalHeight }}</span>
              </div>
              <div class="st-item-acts">
                <button title="上移" :disabled="i === 0" @click="move(i, -1)">
                  <el-icon><ArrowUp /></el-icon>
                </button>
                <button title="下移" :disabled="i === items.length - 1" @click="move(i, 1)">
                  <el-icon><ArrowDown /></el-icon>
                </button>
                <button title="移除" class="rm" @click="removeAt(i)">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- 中栏:工具条 + 画布 -->
      <main class="st-center">
        <div class="st-toolbar">
          <span class="st-size">
            {{ items.length ? `${outSize.w} × ${outSize.h} px` : '尚未加入图片' }}
          </span>
          <button class="st-btn ghost" :disabled="!items.length" @click="clearAll">
            <el-icon><Delete /></el-icon>
            <span>清空</span>
          </button>
        </div>

        <div class="st-viewport">
          <canvas v-show="items.length" ref="canvasRef" class="st-canvas" />
          <button v-if="!items.length" class="st-placeholder" @click="pick">
            <el-icon :size="28"><Plus /></el-icon>
            <span>点击选择图片</span>
          </button>
        </div>
      </main>

      <!-- 右栏:样式调整 + 导出 -->
      <aside class="st-side st-right">
        <section class="st-block">
          <h3 class="st-title">样式调整</h3>

          <div class="st-field">
            <label>间距 <b>{{ gap }}</b> px</label>
            <input v-model.number="gap" type="range" min="0" max="100" step="1" />
          </div>

          <div v-if="direction === 'vertical'" class="st-field">
            <label>限制宽度 <b>{{ maxWidth }}</b> px</label>
            <input v-model.number="maxWidth" type="range" min="240" max="3000" step="20" />
          </div>

          <div v-else class="st-field">
            <label>对齐方式</label>
            <div class="st-seg">
              <button :class="{ active: alignment === 'start' }" @click="alignment = 'start'">顶对齐</button>
              <button :class="{ active: alignment === 'center' }" @click="alignment = 'center'">居中</button>
              <button :class="{ active: alignment === 'end' }" @click="alignment = 'end'">底对齐</button>
            </div>
          </div>

          <div class="st-field">
            <label>背景颜色</label>
            <div class="st-color">
              <input v-model="bgColor" type="color" />
              <span>{{ bgColor.toUpperCase() }}</span>
            </div>
          </div>
        </section>

        <section class="st-block">
          <h3 class="st-title">导出设置</h3>
          <p class="st-hint">导出为 PNG,尺寸与上方预览一致。</p>
          <button class="st-btn primary full" :disabled="!items.length" @click="download">
            <el-icon><Download /></el-icon>
            <span>下载长图</span>
          </button>
        </section>
      </aside>

      <div v-if="dragging" class="st-drop-tip">松开即可加入图片</div>
    </div>
  </ToolPage>
</template>

<style scoped>
/* 设计令牌取自「好拼」(img.ops-coffee.com),深色模式做对应映射 */
.st-app {
  --st-bg: #f4f5f7;
  --st-panel: #ffffff;
  --st-text: #172b4d;
  --st-text2: #42526e;
  --st-muted: #6b7f99;
  --st-border: #dfe1e6;
  --st-accent: #0052cc;
  --st-accent-soft: #e9f2ff;
  --st-soft: #fafbfc;

  position: relative;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr) 244px;
  height: clamp(400px, calc(100vh - 330px), 640px);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--st-bg);
  color: var(--st-text2);
  font-size: 13px;
}
html.dark .st-app {
  --st-bg: #0f1319;
  --st-panel: #171c23;
  --st-text: #e6edf3;
  --st-text2: #b9c4d0;
  --st-muted: #8b98a5;
  --st-border: #2a323c;
  --st-accent: #4c9aff;
  --st-accent-soft: #1b2a41;
  --st-soft: #1f252d;
}
.st-app.is-dragging {
  outline: 2px dashed var(--st-accent);
  outline-offset: -6px;
}

/* 左右侧栏 */
.st-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: var(--st-panel);
}
.st-left {
  border-right: 1px solid var(--st-border);
}
.st-right {
  border-left: 1px solid var(--st-border);
}
.st-block {
  padding: 16px;
}
.st-block + .st-block {
  border-top: 1px solid var(--st-border);
}
.st-grow {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 面板小标题 */
.st-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--st-border);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--st-text);
}
.st-count {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--st-accent-soft);
  color: var(--st-accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.st-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--st-text2);
}

/* 分段按钮(方向 / 对齐) */
.st-seg {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 6px;
  margin-bottom: 16px;
}
.st-seg button {
  padding: 7px 4px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-soft);
  color: var(--st-text2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.st-seg button:hover {
  border-color: #c1c7d0;
}
.st-seg button.active {
  background: var(--st-accent-soft);
  color: var(--st-accent);
  border-color: var(--st-accent);
  font-weight: 600;
}

/* 通用按钮 */
.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-out;
}
.st-btn.full {
  width: 100%;
}
.st-btn.ghost {
  background: var(--st-soft);
  color: var(--st-text2);
  border-color: var(--st-border);
}
.st-btn.ghost:hover:not(:disabled) {
  background: var(--st-bg);
  border-color: #c1c7d0;
}
.st-btn.primary {
  background: var(--st-accent);
  color: #fff;
  border-color: var(--st-accent);
}
.st-btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.st-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.st-hint {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--st-muted);
}

/* 图片顺序列表 */
.st-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}
.st-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--st-border);
  border-radius: 8px;
  background: var(--st-soft);
}
.st-thumb {
  width: 38px;
  height: 38px;
  flex: none;
  object-fit: cover;
  border-radius: 6px;
  background: var(--st-bg);
}
.st-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.st-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--st-text);
}
.st-meta {
  font-size: 11px;
  color: var(--st-muted);
}
.st-item-acts {
  display: flex;
  gap: 2px;
  flex: none;
}
.st-item-acts button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--st-muted);
  cursor: pointer;
}
.st-item-acts button:hover:not(:disabled) {
  background: var(--st-panel);
  border-color: var(--st-border);
  color: var(--st-text);
}
.st-item-acts button.rm:hover:not(:disabled) {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}
.st-item-acts button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 中栏 */
.st-center {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}
.st-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  background: #f8f9fa;
  box-shadow: 0 2px 4px rgb(0 0 0 / 5%);
}
html.dark .st-toolbar {
  border-color: var(--st-border);
  background: var(--st-panel);
}
.st-size {
  font-size: 12px;
  font-weight: 500;
  color: var(--st-text);
}
.st-viewport {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 8px;
  overflow: auto;
  border-radius: 8px;
}
.st-canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 8px -2px rgb(9 30 66 / 25%), 0 0 1px rgb(9 30 66 / 20%);
}
.st-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 250px;
  height: 150px;
  border: 2px dashed var(--st-border);
  border-radius: 8px;
  background: transparent;
  color: var(--st-muted);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.st-placeholder:hover {
  border-color: var(--st-accent);
  background: var(--st-soft);
  color: var(--st-accent);
}

/* 右栏字段 */
.st-field {
  margin-bottom: 16px;
}
.st-field > label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--st-text2);
}
.st-field > label b {
  color: var(--st-text);
  font-weight: 600;
}
.st-field input[type='range'] {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--st-border);
  accent-color: var(--st-accent);
  cursor: pointer;
}
.st-color {
  display: flex;
  align-items: center;
  gap: 8px;
}
.st-color input[type='color'] {
  width: 34px;
  height: 26px;
  padding: 2px;
  border: 1px solid var(--st-border);
  border-radius: 6px;
  background: var(--st-soft);
  cursor: pointer;
}
.st-color span {
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--st-text2);
}

/* 拖拽提示 */
.st-drop-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--st-panel) 82%, transparent);
  color: var(--st-accent);
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
}

/* 窄屏(直接访问路由 / 小窗口)退化为单列 */
@media (max-width: 900px) {
  .st-app {
    grid-template-columns: 1fr;
    height: auto;
  }
  .st-center {
    order: -1;
    height: 320px;
  }
  .st-left {
    border-right: none;
    border-top: 1px solid var(--st-border);
  }
  .st-right {
    border-left: none;
    border-top: 1px solid var(--st-border);
  }
}
</style>
