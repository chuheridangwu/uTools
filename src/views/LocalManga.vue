<script setup lang="ts">
/**
 * 本地漫画阅读器
 * 移植 ../manga.html(父目录同名文件):选择包含「话」子文件夹的根目录后,
 * 以纵向连续排版方式翻阅当前话的全部图片,并用左右按钮/键盘切换上一话、下一话。
 *
 * 与原版的差异(为了与站内其他工具保持一致):
 *  - 用 input[webkitdirectory] 取代 showDirectoryPicker(File System Access API
 *    在 Safari 等浏览器不可用,而目录 input 全浏览器可用);
 *  - 文件名/章节排序统一走自然排序,与 Finder 一致;
 *  - HEIC/HEIF 单页在 Chromium 系浏览器无法直接解码,由 heic2any 在本地转码后展示。
 * 所有文件仅通过内存中的 Object URL 访问,切话/卸载时统一 revoke,不上传。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  FolderOpened,
  Picture,
  Reading,
} from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'

/** 漫画页支持的图片扩展名(与原版 manga.html 一致) */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'heic', 'heif']
const HEIC_EXTS = ['heic', 'heif']

interface MangaImage {
  file: File
  /** 所在章节目录,如 我的漫画/第1话 */
  dir: string
  /** webkitRelativePath 完整路径 */
  rel: string
  name: string
  ext: string
}

interface Chapter {
  /** 章节目录名(展示名) */
  name: string
  /** 完整目录路径,如 我的漫画/第1话 */
  dir: string
  images: MangaImage[]
}

/* ------------------------------ 状态 ------------------------------ */
const inputEl = ref<HTMLInputElement>()
const rootName = ref('')
const chapters = ref<Chapter[]>([])
const chapterIndex = ref(-1)
/** 当前话图片的 Object URLs,切话/卸载时清理 */
const imageUrls = ref<{ rel: string; url: string; failed: boolean }[]>([])
const loadingChapter = ref(false)

const hasRoot = computed(() => chapters.value.length > 0)
const currentChapter = computed(() => (chapterIndex.value >= 0 ? chapters.value[chapterIndex.value] : undefined))
const canPrev = computed(() => chapterIndex.value > 0)
const canNext = computed(() => chapterIndex.value >= 0 && chapterIndex.value < chapters.value.length - 1)

/** 已创建的 Object URL,卸载时统一回收 */
const urls = new Set<string>()
let disposed = false

function track(url: string): string {
  urls.add(url)
  return url
}

function revokeAll() {
  urls.forEach((u) => URL.revokeObjectURL(u))
  urls.clear()
  imageUrls.value = []
}

/* --------------------------- 并发控制 --------------------------- */
/** HEIC 转码较重,限制并发避免卡顿(与 LocalMedia.vue 相同的实现) */
function makeSemaphore(max: number) {
  let running = 0
  const waiters: Array<() => void> = []
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= max) await new Promise<void>((resolve) => waiters.push(resolve))
    running++
    try {
      return await fn()
    } finally {
      const next = waiters.shift()
      if (next) next()
      else running--
    }
  }
}
const heicLimit = makeSemaphore(2)

/** Finder 风格自然排序:数字按数值比较(1,2,…,10,100) */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true })
}

/* --------------------------- 图片地址 --------------------------- */
async function makeImageUrl(img: MangaImage): Promise<string> {
  if (HEIC_EXTS.includes(img.ext)) {
    // Chromium 无法直接解码 HEIC,转码为 JPEG;Safari 可原生解码但走同一逻辑也无妨
    try {
      const { default: heic2any } = await import('heic2any')
      const blob = await heicLimit(async () => {
        const out = await heic2any({ blob: img.file, toType: 'image/jpeg', quality: 0.85 })
        return Array.isArray(out) ? out[0] : out
      })
      if (disposed) return ''
      return track(URL.createObjectURL(blob))
    } catch {
      // 转码失败退回原文件,交给浏览器自行处理(Safari 可显示)
    }
  }
  return track(URL.createObjectURL(img.file))
}

/* --------------------------- 加载章节 --------------------------- */
async function loadChapter(index: number) {
  const chapter = chapters.value[index]
  if (!chapter) return
  loadingChapter.value = true
  const prevUrls = imageUrls.value
  // 统一清空上一话的资源
  for (const p of prevUrls) {
    URL.revokeObjectURL(p.url)
    urls.delete(p.url)
  }
  chapterIndex.value = index
  imageUrls.value = []

  try {
    const items: { rel: string; url: string; failed: boolean }[] = []
    for (const img of chapter.images) {
      const url = await makeImageUrl(img)
      if (!url) break
      items.push({ rel: img.rel, url, failed: false })
      imageUrls.value = [...items]
    }
    if (disposed) return
    imageUrls.value = items
  } finally {
    loadingChapter.value = false
  }
}

function goToPrevChapter() {
  if (canPrev.value) void loadChapter(chapterIndex.value - 1)
}

function goToNextChapter() {
  if (canNext.value) void loadChapter(chapterIndex.value + 1)
}

/** 章节下拉选择跳转(不用模板内联箭头,避免 TS 注解限制) */
function jumpChapter(val: number | string) {
  typeof val === 'number' && void loadChapter(val)
}

function markFailed(rel: string) {
  imageUrls.value = imageUrls.value.map((p) => (p.rel === rel ? { ...p, failed: true } : p))
}

/* ------------------------------ 选择根目录 ------------------------------ */
function pickFolder() {
  inputEl.value?.click()
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  // 注意:必须先快照成数组再清空 input.value,
  // 否则 Blink 会同时清空 input.files 指向的 FileList,导致拿不到任何文件
  const picked = Array.from(input.files ?? [])
  input.value = ''
  if (!picked.length) return

  const list: MangaImage[] = []
  const relPaths = picked.map((f) => f.webkitRelativePath || f.name)
  const nested = relPaths.some((p) => p.includes('/'))
  const root = nested ? relPaths[0].split('/')[0] : '(当前文件夹)'

  picked.forEach((file, i) => {
    const rel = relPaths[i]
    const parts = rel.split('/')
    const name = parts[parts.length - 1]
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
    if (!IMAGE_EXTS.includes(ext)) return
    if (parts.length < 3 && nested) {
      // 直接放在根目录的图片不入话(与原版行为一致:章节必须是子文件夹)
      return
    }
    list.push({ file, rel, dir: parts.slice(0, -1).join('/'), name, ext })
  })

  // 章节 = 根目录下的一级子文件夹;章节内图片含更深层子目录,保持与原版兼容
  const dirSet = new Set<string>()
  for (const item of list) {
    const rel = item.dir.slice(root.length + 1)
    const first = rel.split('/')[0]
    if (first) dirSet.add(first)
  }
  const chapterDirs = [...dirSet].sort(naturalCompare)

  const chapterList: Chapter[] = chapterDirs.map((dir) => ({
    name: dir,
    dir: `${root}/${dir}`,
    images: list.filter((f) => f.dir === `${root}/${dir}` || f.dir.startsWith(`${root}/${dir}/`)).sort((a, b) => naturalCompare(a.rel, b.rel)),
  }))

  revokeAll()
  if (disposed) return
  rootName.value = root
  chapters.value = chapterList

  if (!chapterList.length) {
    ElMessage.warning('根目录下没有包含图片的子文件夹(话)')
    return
  }
  void loadChapter(0)
}

/* ------------------------------ 键盘交互 ------------------------------ */
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goToPrevChapter()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    goToNextChapter()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', onKeydown)
  revokeAll()
})
</script>

<template>
  <ToolPage>
    <template #title>本地漫画阅读器</template>
    <template #desc>
      选择包含「话」子文件夹的根目录,在浏览器内(不上传)纵向连续翻阅当前话的全部图片;
      左右按钮或键盘 ←/→ 切换上一话、下一话。支持 jpg / png / gif / webp / bmp / avif / heic 等格式。
    </template>

    <!-- 选择根目录 + 章节控制 -->
    <div class="bar">
      <el-button type="primary" :icon="FolderOpened" @click="pickFolder">选择根目录</el-button>
      <input ref="inputEl" type="file" webkitdirectory directory multiple hidden @change="onPick" />
      <el-select
        v-if="hasRoot"
        :model-value="chapterIndex"
        class="chapter-select"
        size="default"
        @update:model-value="jumpChapter"
      >
        <el-option v-for="(c, i) in chapters" :key="c.dir" :value="i" :label="c.name" />
      </el-select>
      <el-button :icon="ArrowLeft" :disabled="!canPrev" @click="goToPrevChapter">上一话</el-button>
      <el-button :disabled="!canNext" @click="goToNextChapter">
        下一话
        <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </el-button>
      <span v-if="hasRoot" class="count">{{ rootName }} · 第 {{ chapterIndex + 1 }} / {{ chapters.length }} 话</span>
    </div>

    <!-- 翻阅区 -->
    <div class="reader">
      <div class="gallery">
        <!-- 未选择 -->
        <div v-if="!hasRoot" class="placeholder">
          <el-icon :size="46"><Reading /></el-icon>
          <p>尚未选择根目录</p>
          <span>点击上方「选择根目录」,选择包含各话子文件夹的漫画目录开始阅读。</span>
        </div>

        <!-- 无图片 -->
        <div v-else-if="!loadingChapter && !imageUrls.length" class="placeholder dark">
          <el-icon :size="40"><Picture /></el-icon>
          <p>此话中没有图片或暂未加载</p>
          <span>支持格式:jpg / jpeg / png / gif / webp / bmp / avif / tiff / heic / heif</span>
        </div>

        <!-- 图片纵向流 -->
        <template v-else>
          <div v-for="img in imageUrls" :key="img.rel" class="page-card">
            <img
              v-if="!img.failed"
              :src="img.url"
              loading="lazy"
              alt=""
              @error="markFailed(img.rel)"
            />
            <div v-else class="page-broken">
              <el-icon :size="30"><Picture /></el-icon>
              <span>该图片无法解码</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 左右浮动按钮 -->
      <button class="side-nav left" :disabled="!canPrev" aria-label="上一话" @click="goToPrevChapter">
        <el-icon :size="20"><ArrowLeft /></el-icon>
      </button>
      <button class="side-nav right" :disabled="!canNext" aria-label="下一话" @click="goToNextChapter">
        <el-icon :size="20"><ArrowRight /></el-icon>
      </button>
    </div>

    <!-- 底部状态栏 -->
    <div class="footer-bar">
      <span class="hint">⬆⬇ 纵向滚动翻阅 · 图居中</span>
      <span class="count" v-if="currentChapter">当前话「{{ currentChapter.name }}」共 {{ currentChapter.images.length }} 张</span>
      <span class="count" v-else>共 <strong>0</strong> 张图片</span>
    </div>
  </ToolPage>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.chapter-select {
  width: 220px;
}
.count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 翻阅区:黑色画布,圆角卡片内纵向排版 */
.reader {
  position: relative;
  margin-top: 12px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  background: #000;
  min-height: 420px;
  overflow: hidden;
}
.gallery {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  overscroll-behavior: contain;
}
.page-card {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  background: #000;
}
.page-card img {
  width: 100%;
  height: auto;
  display: block;
}
.page-broken {
  width: 100%;
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgb(255 255 255 / 45%);
  background: #0b0b0d;
}

/* 浮动切换按钮 */
.side-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  width: 44px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgb(20 20 20 / 60%);
  backdrop-filter: blur(6px);
  border: 1px solid rgb(255 255 255 / 10%);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.side-nav:hover:not(:disabled) {
  background: rgb(40 40 40 / 85%);
  transform: translateY(-50%) scale(1.05);
}
.side-nav:disabled {
  opacity: 0.15;
  cursor: not-allowed;
}
.side-nav.left {
  left: 14px;
}
.side-nav.right {
  right: 14px;
}

.placeholder {
  padding: 60px 16px;
  width: 100%;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.placeholder.dark {
  color: rgb(255 255 255 / 55%);
}
.placeholder p {
  margin: 10px 0 4px;
  font-size: 14px;
}
.placeholder span {
  font-size: 12px;
}

.footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px 16px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 600px) {
  .side-nav {
    width: 34px;
    height: 58px;
    border-radius: 8px;
  }
  .side-nav.left {
    left: 6px;
  }
  .side-nav.right {
    right: 6px;
  }
  .chapter-select {
    width: 100%;
  }
}
</style>
