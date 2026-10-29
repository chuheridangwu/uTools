<script setup lang="ts">
/**
 * 本地媒体浏览器
 * 选择本地文件夹后,完全在浏览器内(不上传)浏览目录:
 *  - 视频:自动截帧生成缩略图,支持连续播放列表与下一集自动播放
 *  - 音频:mp3 / m4a,独立播放器 + 连续播放列表
 *  - 照片:JPEG / JPG / PNG / WebP / HEIC / HEIF,支持大图查看与左右切换;
 *    HEIC/HEIF 浏览器普遍无法直接解码,由 heic2any 在本地转码后展示
 *  - 面包屑导航、当前目录搜索、类型筛选与排序
 * 所有文件仅通过内存中的 Object URL 访问。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Download,
  Folder,
  FolderOpened,
  Picture,
  Search,
  VideoCamera,
  Headset,
  Fold,
  Expand,
} from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { formatSize } from '@/utils/common'

/** 允许的照片扩展名(按需求限定) */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
/** 常见视频扩展名(能否播放取决于浏览器解码能力) */
const VIDEO_EXTS = ['mp4', 'm4v', 'webm', 'mov', 'ogv', 'mkv', 'avi', 'wmv', 'flv']
/** 音频扩展名(按需求限定) */
const AUDIO_EXTS = ['mp3', 'm4a']
const HEIC_EXTS = ['heic', 'heif']

interface MediaItem {
  file: File
  /** webkitRelativePath,如 我的相册/2024/a.jpg */
  path: string
  /** 所在目录,如 我的相册/2024 */
  dir: string
  name: string
  ext: string
  kind: 'image' | 'video' | 'audio'
  size: number
  /** 缩略图/展示图 Object URL(HEIC 为转码后的 JPEG) */
  thumb: string
  thumbState: 'idle' | 'loading' | 'done' | 'error'
}

/* ------------------------------ 状态 ------------------------------ */
const files = ref<MediaItem[]>([])
const segments = ref<string[]>([])
const search = ref('')
const kindFilter = ref<'all' | 'image' | 'video' | 'audio'>('all')
const sortBy = ref<'name' | 'size' | 'kind'>('name')
const inputEl = ref<HTMLInputElement>()

const lightboxIndex = ref(-1)
const playerOpen = ref(false)
const playerIndex = ref(0)
const playlist = ref<MediaItem[]>([])
const videoUrl = ref('')
const playerError = ref('')
const showPlaylist = ref(true)

const audioOpen = ref(false)
const audioIndex = ref(0)
const audioPlaylist = ref<MediaItem[]>([])
const audioUrl = ref('')
const audioError = ref('')
const showAudioPlaylist = ref(true)

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
}

/* --------------------------- 并发控制 --------------------------- */
/** 简单信号量:HEIC 转码与视频截帧都较重,限制并发避免卡顿 */
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
const videoLimit = makeSemaphore(3)

/* --------------------------- 目录计算 --------------------------- */
const currentDir = computed(() => segments.value.join('/'))
const hasFolder = computed(() => segments.value.length > 0)

const childFolders = computed<string[]>(() => {
  if (!hasFolder.value) return []
  const cur = currentDir.value
  const set = new Set<string>()
  for (const f of files.value) {
    if (f.dir === cur || !f.dir.startsWith(cur + '/')) continue
    set.add(f.dir.slice(cur.length + 1).split('/')[0])
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
})

/** 当前目录(不含子目录)的全部媒体 */
const directMedia = computed(() => (hasFolder.value ? files.value.filter((f) => f.dir === currentDir.value) : []))

/** 当前目录按筛选与搜索过滤后的媒体 */
const visibleMedia = computed(() => {
  const kw = search.value.trim().toLowerCase()
  const list = directMedia.value.filter((f) => {
    if (kindFilter.value !== 'all' && f.kind !== kindFilter.value) return false
    if (kw && !f.name.toLowerCase().includes(kw)) return false
    return true
  })
  const cmp = (a: MediaItem, b: MediaItem): number => {
    if (sortBy.value === 'size') return b.size - a.size
    if (sortBy.value === 'kind') return a.kind === b.kind ? a.name.localeCompare(b.name, 'zh-Hans-CN') : kindRank[a.kind] - kindRank[b.kind]
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  }
  return [...list].sort(cmp)
})

const photoList = computed(() => visibleMedia.value.filter((f) => f.kind === 'image'))
const videoList = computed(() => visibleMedia.value.filter((f) => f.kind === 'video'))

/** "按类型"排序时的类型优先级:照片 → 音频 → 视频 */
const kindRank: Record<MediaItem['kind'], number> = { image: 0, audio: 1, video: 2 }

/** 当前目录及子目录下的全部视频(播放列表范围,与原版一致) */
const videosUnder = computed(() => {
  if (!hasFolder.value) return []
  const cur = currentDir.value
  return files.value
    .filter((f) => f.kind === 'video' && (f.dir === cur || f.dir.startsWith(cur + '/')))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'))
})

/** 当前目录及子目录下的全部音频(播放列表范围,与视频一致) */
const audiosUnder = computed(() => {
  if (!hasFolder.value) return []
  const cur = currentDir.value
  return files.value
    .filter((f) => f.kind === 'audio' && (f.dir === cur || f.dir.startsWith(cur + '/')))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'))
})

const photoCount = computed(() => directMedia.value.filter((f) => f.kind === 'image').length)
const videoCount = computed(() => directMedia.value.filter((f) => f.kind === 'video').length)
const audioCount = computed(() => directMedia.value.filter((f) => f.kind === 'audio').length)
const totalCount = computed(() => files.value.length)

const currentPhoto = computed(() => (lightboxIndex.value >= 0 ? photoList.value[lightboxIndex.value] : undefined))
const currentVideo = computed(() => (playerOpen.value ? playlist.value[playerIndex.value] : undefined))
const currentAudio = computed(() => (audioOpen.value ? audioPlaylist.value[audioIndex.value] : undefined))

/** 面包屑展示文本 */
const pathText = computed(() => (hasFolder.value ? currentDir.value : '未选择文件夹'))

/* --------------------------- 缩略图生成 --------------------------- */
function isHeic(item: MediaItem): boolean {
  return HEIC_EXTS.includes(item.ext) || item.file.type === 'image/heic' || item.file.type === 'image/heif'
}

/** 给单个媒体准备缩略图(带缓存,失败仅标记不打断) */
async function prepareThumb(item: MediaItem): Promise<void> {
  if (item.thumbState === 'loading' || item.thumbState === 'done') return
  if (item.kind === 'audio') {
    // 音频无缩略图,直接标记完成(卡片用图标占位)
    item.thumbState = 'done'
    return
  }
  item.thumbState = 'loading'
  try {
    if (item.kind === 'image') {
      if (isHeic(item)) {
        // 动态加载解码库,只有遇到 HEIC/HEIF 时才下载这 2MB+ 的代码
        const { default: heic2any } = await import('heic2any')
        const url = await heicLimit(async () => {
          const out = await heic2any({ blob: item.file, toType: 'image/jpeg', quality: 0.85 })
          const blob = Array.isArray(out) ? out[0] : out
          return track(URL.createObjectURL(blob))
        })
        if (disposed) return
        item.thumb = url
      } else {
        item.thumb = track(URL.createObjectURL(item.file))
      }
      item.thumbState = 'done'
    } else {
      const url = await videoLimit(() => makeVideoThumb(item.file))
      if (disposed) return
      item.thumb = url
      item.thumbState = url ? 'done' : 'error'
    }
  } catch {
    if (!disposed) item.thumbState = 'error'
  }
}

/** 截取视频开头附近的一帧作为缩略图 */
function makeVideoThumb(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const src = URL.createObjectURL(file)
    let settled = false
    const finish = (result: string) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(src)
      resolve(result)
    }
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = src
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, Number.isFinite(video.duration) ? video.duration / 2 : 0.5)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const width = 320
        const height = Math.max(1, Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * width))
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish('')
        ctx.drawImage(video, 0, 0, width, height)
        canvas.toBlob((blob) => finish(blob ? track(URL.createObjectURL(blob)) : ''), 'image/jpeg', 0.72)
      } catch {
        finish('')
      }
    }
    video.onerror = () => finish('')
  })
}

/** 为一批媒体补缩略图(visible 优先,其次播放列表) */
function ensureThumbs(list: MediaItem[]) {
  for (const item of list) void prepareThumb(item)
}

/* --------------------------- 文件夹选择 --------------------------- */
function pickFolder() {
  inputEl.value?.click()
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  // 注意:必须先快照成数组再清空 input.value,
  // 否则 Blink 会同时清空 input.files 指向的 FileList,导致拿不到任何文件
  const picked = Array.from(input.files ?? [])
  input.value = ''
  if (!picked.length) return

  revokeAll()
  disposed = false
  lightboxIndex.value = -1
  closePlayer()
  closeAudio()
  search.value = ''
  kindFilter.value = 'all'

  // 目录选择器会给出 根目录/子目录/文件名;若相对路径缺失(拖拽等场景)则视为单层
  const relPaths = picked.map((f) => f.webkitRelativePath || f.name)
  const nested = relPaths.some((p) => p.includes('/'))
  const root = nested ? relPaths[0].split('/')[0] : '(当前文件夹)'

  const list: MediaItem[] = []
  picked.forEach((file, i) => {
    const rel = relPaths[i]
    const parts = rel.split('/')
    const name = parts[parts.length - 1]
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
    const kind = IMAGE_EXTS.includes(ext)
      ? 'image'
      : AUDIO_EXTS.includes(ext)
        ? 'audio'
        : VIDEO_EXTS.includes(ext)
          ? 'video'
          : null
    if (!kind) return
    list.push({
      file,
      path: rel,
      dir: nested ? parts.slice(0, -1).join('/') : root,
      name,
      ext,
      kind,
      size: file.size,
      thumb: '',
      thumbState: 'idle',
    })
  })

  files.value = list
  segments.value = [root]

  if (!list.length) {
    ElMessage.warning('该文件夹中没有可浏览的照片、音频或视频')
    return
  }
  ensureThumbs(visibleMedia.value)
}

/* --------------------------- 目录导航 --------------------------- */
function enterFolder(name: string) {
  segments.value = [...segments.value, name]
  search.value = ''
  ensureThumbs(visibleMedia.value)
}

function jumpTo(index: number) {
  segments.value = segments.value.slice(0, index + 1)
  search.value = ''
  ensureThumbs(visibleMedia.value)
}

/* --------------------------- 照片大图 --------------------------- */
function openPhoto(item: MediaItem) {
  const idx = photoList.value.findIndex((p) => p.path === item.path)
  if (idx < 0) return
  lightboxIndex.value = idx
  void prepareThumb(item)
}

function closeLightbox() {
  lightboxIndex.value = -1
}

function stepPhoto(delta: number) {
  if (!photoList.value.length) return
  const len = photoList.value.length
  lightboxIndex.value = (lightboxIndex.value + delta + len) % len
  const item = photoList.value[lightboxIndex.value]
  if (item) void prepareThumb(item)
}

function downloadCurrentPhoto() {
  const item = currentPhoto.value
  if (!item) return
  const a = document.createElement('a')
  a.href = item.thumb || track(URL.createObjectURL(item.file))
  a.download = isHeic(item) ? item.name.replace(/\.(heic|heif)$/i, '.jpg') : item.name
  a.click()
}

/* --------------------------- 视频播放 --------------------------- */
function openVideo(item: MediaItem) {
  closeAudio()
  const list = videosUnder.value
  const idx = list.findIndex((v) => v.path === item.path)
  playlist.value = list.length ? list : [item]
  playIndex(idx >= 0 ? idx : 0)
  ensureThumbs(playlist.value)
}

function playIndex(index: number) {
  const item = playlist.value[index]
  if (!item) return
  playerIndex.value = index
  playerError.value = ''
  playerOpen.value = true
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = track(URL.createObjectURL(item.file))
}

function nextVideo() {
  if (playerIndex.value + 1 < playlist.value.length) playIndex(playerIndex.value + 1)
}

function closePlayer() {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value)
    urls.delete(videoUrl.value)
    videoUrl.value = ''
  }
  playerOpen.value = false
  playerError.value = ''
}

function onVideoError() {
  playerError.value = '该视频编码可能不受当前浏览器支持,可尝试在本地播放器中打开。'
}

function downloadCurrentVideo() {
  const item = currentVideo.value
  if (!item || !videoUrl.value) return
  const a = document.createElement('a')
  a.href = videoUrl.value
  a.download = item.name
  a.click()
}

/* --------------------------- 音频播放 --------------------------- */
function openAudio(item: MediaItem) {
  closePlayer()
  const list = audiosUnder.value
  const idx = list.findIndex((a) => a.path === item.path)
  audioPlaylist.value = list.length ? list : [item]
  playAudioIndex(idx >= 0 ? idx : 0)
}

function playAudioIndex(index: number) {
  const item = audioPlaylist.value[index]
  if (!item) return
  audioIndex.value = index
  audioError.value = ''
  audioOpen.value = true
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = track(URL.createObjectURL(item.file))
}

function nextAudio() {
  if (audioIndex.value + 1 < audioPlaylist.value.length) playAudioIndex(audioIndex.value + 1)
}

function closeAudio() {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    urls.delete(audioUrl.value)
    audioUrl.value = ''
  }
  audioOpen.value = false
  audioError.value = ''
}

function onAudioError() {
  audioError.value = '该音频编码可能不受当前浏览器支持。'
}

function downloadCurrentAudio() {
  const item = currentAudio.value
  if (!item || !audioUrl.value) return
  const a = document.createElement('a')
  a.href = audioUrl.value
  a.download = item.name
  a.click()
}

/* --------------------------- 键盘交互 --------------------------- */
function onKeydown(e: KeyboardEvent) {
  if (playerOpen.value || audioOpen.value) {
    if (e.key === 'Escape') (playerOpen.value ? closePlayer : closeAudio)()
    return
  }
  if (lightboxIndex.value < 0) return
  if (e.key === 'Escape') closeLightbox()
  else if (e.key === 'ArrowLeft') stepPhoto(-1)
  else if (e.key === 'ArrowRight') stepPhoto(1)
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
    <template #title>本地媒体浏览器</template>
    <template #desc>
      选择一个本地文件夹,直接在浏览器中浏览照片、音频与视频(文件不会上传)。照片支持 JPEG / JPG / PNG / WebP / HEIC / HEIF,
      HEIC/HEIF 会在本地转换为可显示格式;音频支持 MP3 / M4A;视频自动截帧缩略并可连续播放。
    </template>

    <!-- 选择文件夹 -->
    <div class="bar">
      <el-button type="primary" :icon="FolderOpened" @click="pickFolder">选择文件夹</el-button>
      <input ref="inputEl" type="file" webkitdirectory directory multiple hidden @change="onPick" />
      <div class="path" :title="pathText">{{ pathText }}</div>
      <span v-if="hasFolder" class="count">共 {{ totalCount }} 个媒体文件</span>
    </div>

    <!-- 面包屑 + 工具栏 -->
    <div v-if="hasFolder" class="toolbar">
      <div class="crumbs">
        <template v-for="(seg, i) in segments" :key="i">
          <el-icon v-if="i > 0" class="sep"><ArrowRight /></el-icon>
          <button class="crumb" :class="{ active: i === segments.length - 1 }" @click="jumpTo(i)">
            {{ seg }}
          </button>
        </template>
      </div>
      <div class="controls">
        <el-radio-group v-model="kindFilter" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="image">照片 {{ photoCount }}</el-radio-button>
          <el-radio-button value="audio">音频 {{ audioCount }}</el-radio-button>
          <el-radio-button value="video">视频 {{ videoCount }}</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="search"
          class="search"
          size="small"
          placeholder="搜索当前目录"
          :prefix-icon="Search"
          clearable
        />
        <el-select v-model="sortBy" size="small" class="sort">
          <el-option value="name" label="按名称" />
          <el-option value="size" label="按大小" />
          <el-option value="kind" label="按类型" />
        </el-select>
      </div>
    </div>

    <!-- 未选择 -->
    <div v-if="!hasFolder" class="placeholder">
      <el-icon :size="46"><Folder /></el-icon>
      <p>尚未选择文件夹</p>
      <span>点击上方“选择文件夹”开始浏览,支持照片与视频混排显示。</span>
    </div>

    <!-- 内容 -->
    <div v-else class="content">
      <!-- 子文件夹 -->
      <div v-if="childFolders.length && !search" class="grid">
        <div v-for="f in childFolders" :key="f" class="card folder" @click="enterFolder(f)">
          <div class="thumb folder-thumb">
            <el-icon :size="38"><Folder /></el-icon>
          </div>
          <div class="name" :title="f">{{ f }}</div>
        </div>
      </div>

      <!-- 媒体文件 -->
      <div v-if="visibleMedia.length" class="grid">
        <div
          v-for="m in visibleMedia"
          :key="m.path"
          class="card media"
          @click="m.kind === 'image' ? openPhoto(m) : m.kind === 'audio' ? openAudio(m) : openVideo(m)"
        >
          <div class="thumb">
            <img v-if="m.thumb" :src="m.thumb" :alt="m.name" loading="lazy" />
            <div v-else class="thumb-empty">
              <el-icon :size="30" v-if="m.thumbState !== 'error'">
                <VideoCamera v-if="m.kind === 'video'" />
                <Headset v-else-if="m.kind === 'audio'" />
                <Picture v-else />
              </el-icon>
              <span v-if="m.thumbState === 'error'" class="badge-error">无法预览</span>
            </div>
            <span class="badge">{{ m.kind === 'image' ? (m.ext === 'heic' || m.ext === 'heif' ? 'HEIC' : m.ext.toUpperCase()) : m.kind === 'audio' ? m.ext.toUpperCase() : 'VIDEO' }}</span>
          </div>
          <div class="meta">
            <div class="name" :title="m.name">{{ m.name }}</div>
            <div class="sub">{{ formatSize(m.size) }}</div>
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-if="!childFolders.length && !visibleMedia.length" class="placeholder small">
        <p>当前目录没有匹配的{{ kindFilter === 'image' ? '照片' : kindFilter === 'audio' ? '音频' : kindFilter === 'video' ? '视频' : '媒体文件' }}</p>
        <span v-if="search">试试清空搜索关键词</span>
      </div>
    </div>

    <!-- 照片大图 -->
    <teleport to="body">
      <div v-if="currentPhoto" class="overlay" @click.self="closeLightbox">
        <button class="ov-btn close" title="关闭(Esc)" @click="closeLightbox"><el-icon><Close /></el-icon></button>
        <button v-if="photoList.length > 1" class="ov-btn prev" title="上一张(←)" @click="stepPhoto(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button v-if="photoList.length > 1" class="ov-btn next" title="下一张(→)" @click="stepPhoto(1)">
          <el-icon><ArrowRight /></el-icon>
        </button>
        <figure class="photo-stage">
          <img v-if="currentPhoto.thumb" :src="currentPhoto.thumb" :alt="currentPhoto.name" />
          <div v-else class="photo-loading">
            {{ currentPhoto.thumbState === 'error' ? '该照片无法解码(可能是特殊编码的 HEIC)' : '正在解码…' }}
          </div>
          <figcaption>
            <span class="cap-name">{{ currentPhoto.name }}</span>
            <span class="cap-sub">{{ formatSize(currentPhoto.size) }} · {{ lightboxIndex + 1 }} / {{ photoList.length }}</span>
            <el-button size="small" :icon="Download" text bg @click="downloadCurrentPhoto">下载</el-button>
          </figcaption>
        </figure>
      </div>
    </teleport>

    <!-- 视频播放器 -->
    <teleport to="body">
      <div v-if="playerOpen" class="overlay player-overlay" @click.self="closePlayer">
        <button class="ov-btn close" title="关闭(Esc)" @click="closePlayer"><el-icon><Close /></el-icon></button>
        <div class="player">
          <div class="video-wrap">
            <video
              :src="videoUrl"
              controls
              autoplay
              playsinline
              @error="onVideoError"
              @ended="nextVideo"
            />
            <div v-if="playerError" class="video-error">{{ playerError }}</div>
            <div class="video-bar">
              <span class="cap-name">{{ currentVideo?.name }}</span>
              <div class="video-bar-actions">
                <el-button
                  size="small"
                  :icon="showPlaylist ? Fold : Expand"
                  text
                  bg
                  :title="showPlaylist ? '隐藏播放列表' : '显示播放列表'"
                  @click="showPlaylist = !showPlaylist"
                >
                  {{ showPlaylist ? '隐藏列表' : '显示列表' }}
                </el-button>
                <el-button size="small" :icon="Download" text bg @click="downloadCurrentVideo">下载</el-button>
              </div>
            </div>
          </div>
          <aside v-show="showPlaylist" class="playlist">
            <div class="pl-title">播放列表 · {{ playlist.length }}</div>
            <div
              v-for="(v, i) in playlist"
              :key="v.path"
              class="pl-item"
              :class="{ active: i === playerIndex }"
              @click="playIndex(i)"
            >
              <img v-if="v.thumb" :src="v.thumb" class="pl-thumb" :alt="v.name" />
              <div v-else class="pl-thumb pl-empty"><el-icon><VideoCamera /></el-icon></div>
              <span class="pl-name" :title="v.name">{{ v.name }}</span>
            </div>
          </aside>
        </div>
      </div>
    </teleport>

    <!-- 音频播放器 -->
    <teleport to="body">
      <div v-if="audioOpen" class="overlay audio-overlay" @click.self="closeAudio">
        <button class="ov-btn close" title="关闭(Esc)" @click="closeAudio"><el-icon><Close /></el-icon></button>
        <div class="player audio-player">
          <div class="audio-wrap">
            <div class="audio-art"><el-icon :size="64"><Headset /></el-icon></div>
            <div class="audio-title" :title="currentAudio?.name">{{ currentAudio?.name }}</div>
            <div class="audio-sub">{{ formatSize(currentAudio?.size ?? 0) }} · 第 {{ audioIndex + 1 }} / {{ audioPlaylist.length }} 首</div>
            <audio
              :src="audioUrl"
              controls
              autoplay
              @ended="nextAudio"
              @error="onAudioError"
            />
            <div v-if="audioError" class="video-error">{{ audioError }}</div>
            <div class="video-bar audio-actions">
              <el-button
                size="small"
                :icon="showAudioPlaylist ? Fold : Expand"
                text
                bg
                :title="showAudioPlaylist ? '隐藏播放列表' : '显示播放列表'"
                @click="showAudioPlaylist = !showAudioPlaylist"
              >
                {{ showAudioPlaylist ? '隐藏列表' : '显示列表' }}
              </el-button>
              <el-button size="small" :icon="Download" text bg @click="downloadCurrentAudio">下载</el-button>
            </div>
          </div>
          <aside v-show="showAudioPlaylist" class="playlist">
            <div class="pl-title">播放列表 · {{ audioPlaylist.length }}</div>
            <div
              v-for="(a, i) in audioPlaylist"
              :key="a.path"
              class="pl-item"
              :class="{ active: i === audioIndex }"
              @click="playAudioIndex(i)"
            >
              <div class="pl-thumb pl-empty"><el-icon><Headset /></el-icon></div>
              <span class="pl-name" :title="a.name">{{ a.name }}</span>
            </div>
          </aside>
        </div>
      </div>
    </teleport>
  </ToolPage>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.path {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 14px 0 4px;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.sep {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}
.crumb {
  border: 1px solid var(--card-border);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.crumb:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.crumb.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search {
  width: 190px;
}
.sort {
  width: 110px;
}

.placeholder {
  margin-top: 40px;
  padding: 48px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  border: 1px dashed var(--card-border);
  border-radius: var(--radius-md);
}
.placeholder p {
  margin: 10px 0 4px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.placeholder span {
  font-size: 12px;
}
.placeholder.small {
  margin-top: 8px;
  padding: 32px 16px;
}

.content {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 14px;
}
.card {
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgb(0 0 0 / 10%);
}
.thumb {
  position: relative;
  height: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-lighter);
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.folder-thumb {
  color: var(--brand);
}
.thumb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-placeholder);
}
.badge-error {
  font-size: 11px;
}
.badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 4px;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  letter-spacing: 0.4px;
}
.meta {
  padding: 8px 10px;
}
.name {
  padding: 10px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta .name {
  padding: 0;
}
.sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* ---------------- 全屏浮层 ---------------- */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgb(0 0 0 / 88%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 64px;
}
.ov-btn {
  position: absolute;
  z-index: 10;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: rgb(255 255 255 / 12%);
  color: #fff;
  cursor: pointer;
  font-size: 18px;
}
.ov-btn:hover {
  background: rgb(255 255 255 / 24%);
}
.ov-btn.close {
  top: 16px;
  right: 16px;
}
.ov-btn.prev {
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
}
.ov-btn.next {
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
}

.photo-stage {
  margin: 0;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.photo-stage img {
  max-width: 100%;
  max-height: calc(100vh - 160px);
  object-fit: contain;
  border-radius: 6px;
}
.photo-loading {
  color: #fff;
  font-size: 13px;
}
.photo-stage figcaption {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  font-size: 12px;
  max-width: 100%;
}
.cap-name {
  max-width: 56vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cap-sub {
  color: rgb(255 255 255 / 65%);
}

.player-overlay {
  padding: 56px 28px 28px;
}
.player {
  width: 100%;
  max-width: 1280px;
  height: 100%;
  display: flex;
  gap: 14px;
}
.video-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.video-wrap video {
  flex: 1;
  min-height: 0;
  width: 100%;
  background: #000;
  border-radius: 6px;
  outline: none;
}
.video-error {
  font-size: 12px;
  color: #fca5a5;
}
.video-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #fff;
  font-size: 13px;
}
.video-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 音频播放器 */
.audio-player {
  max-width: 780px;
}
.audio-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 6px;
}
.audio-art {
  width: 180px;
  height: 180px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgb(99 102 241 / 55%), rgb(99 102 241 / 12%));
  color: #fff;
}
.audio-title {
  max-width: 100%;
  color: #fff;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audio-sub {
  color: rgb(255 255 255 / 60%);
  font-size: 12px;
}
.audio-wrap audio {
  width: 100%;
}
.audio-actions {
  justify-content: flex-end;
  width: 100%;
}

.playlist {
  width: 260px;
  flex: none;
  background: rgb(255 255 255 / 8%);
  border-radius: 8px;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pl-title {
  font-size: 11px;
  color: rgb(255 255 255 / 60%);
  padding: 2px 4px 6px;
}
.pl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
}
.pl-item:hover {
  background: rgb(255 255 255 / 10%);
}
.pl-item.active {
  background: rgb(99 102 241 / 55%);
}
.pl-thumb {
  width: 56px;
  height: 34px;
  flex: none;
  object-fit: cover;
  border-radius: 4px;
}
.pl-empty {
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 10%);
  color: rgb(255 255 255 / 70%);
}
.pl-name {
  font-size: 12px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .overlay {
    padding: 52px 16px 16px;
  }
  .player {
    flex-direction: column;
  }
  .playlist {
    width: 100%;
    max-height: 180px;
    flex: none;
  }
  .ov-btn.prev {
    left: 6px;
  }
  .ov-btn.next {
    right: 6px;
  }
}
</style>
