<script setup lang="ts">
/**
 * 电台随身听
 * 精选全球公共电台直播流(音乐 / 爵士 / 古典 / 氛围),点击即听,
 * 支持切换、音量、收藏与媒体会话(锁屏显示)。流地址为第三方公开源。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Headset, Star, StarFilled, VideoPause, VideoPlay } from '@element-plus/icons-vue'

interface Station {
  id: string
  name: string
  genre: string
  url: string
  accent: string
}

const STATIONS: Station[] = [
  { id: 'groovesalad', name: 'Groove Salad', genre: '氛围/缓拍', url: 'https://ice1.somafm.com/groovesalad-128-mp3', accent: '#14b8a6' },
  { id: 'dronezone', name: 'Drone Zone', genre: '氛围/太空', url: 'https://ice1.somafm.com/dronezone-128-mp3', accent: '#6366f1' },
  { id: 'lush', name: 'Lush', genre: '人声/梦幻', url: 'https://ice1.somafm.com/lush-128-mp3', accent: '#ec4899' },
  { id: 'secretagent', name: 'Secret Agent', genre: '爵士/间谍', url: 'https://ice1.somafm.com/secretagent-128-mp3', accent: '#f59e0b' },
  { id: 'indiepop', name: 'Indie Pop Rocks', genre: '独立流行', url: 'https://ice1.somafm.com/indiepop-128-mp3', accent: '#8b5cf6' },
  { id: 'fluid', name: 'Fluid', genre: '嘻哈/器乐', url: 'https://ice1.somafm.com/fluid-128-mp3', accent: '#0ea5e9' },
  { id: 'beatblender', name: 'Beat Blender', genre: '深浩室', url: 'https://ice1.somafm.com/beatblender-128-mp3', accent: '#f43f5e' },
  { id: 'spacestation', name: 'Space Station Soma', genre: '电子/氛围', url: 'https://ice1.somafm.com/spacestation-128-mp3', accent: '#22c55e' },
  { id: 'metal', name: 'Metal Detector', genre: '金属', url: 'https://ice1.somafm.com/metal-128-mp3', accent: '#64748b' },
  { id: 'radioparadise', name: 'Radio Paradise', genre: '摇滚/精选', url: 'https://stream.radioparadise.com/mp3-192', accent: '#e11d48' },
  { id: 'rsj', name: 'Radio Swiss Jazz', genre: '爵士', url: 'https://stream.srg-ssr.ch/m/rsj/mp3_128', accent: '#0d9488' },
  { id: 'rsc', name: 'Radio Swiss Classic', genre: '古典', url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128', accent: '#a855f7' },
]

const audio = ref<HTMLAudioElement>()
const current = ref<Station | null>(null)
const playing = ref(false)
const loading = ref(false)
const vol = ref(0.8)
const favs = ref<string[]>([])
const KEY = 'utools_radio_fav'

const genreList = computed(() => Array.from(new Set(STATIONS.map((s) => s.genre))))
const filterGenre = ref('全部')
const shown = computed(() => STATIONS.filter((s) => filterGenre.value === '全部' || s.genre === filterGenre.value))

function play(s: Station) {
  const el = audio.value
  if (!el) return
  if (current.value?.id === s.id && playing.value) {
    el.pause()
    return
  }
  loading.value = true
  current.value = s
  el.src = s.url
  el.volume = vol.value
  el.play().then(() => {
    playing.value = true
    loading.value = false
  }).catch(() => {
    loading.value = false
    ElMessage.warning('无法播放该电台(可能被网络限制或流已失效)')
  })
}

function togglePlay() {
  const el = audio.value
  if (!el || !current.value) return
  if (playing.value) el.pause()
  else el.play().then(() => { playing.value = true }).catch(() => ElMessage.warning('播放失败'))
}

function step(delta: number) {
  if (!current.value) {
    play(STATIONS[0])
    return
  }
  const i = STATIONS.findIndex((s) => s.id === current.value!.id)
  const next = STATIONS[(i + delta + STATIONS.length) % STATIONS.length]
  play(next)
}

function onVolume() {
  if (audio.value) audio.value.volume = vol.value
}

function toggleFav(s: Station) {
  favs.value = favs.value.includes(s.id) ? favs.value.filter((x) => x !== s.id) : [...favs.value, s.id]
  localStorage.setItem(KEY, JSON.stringify(favs.value))
}

function isFav(id: string): boolean {
  return favs.value.includes(id)
}

function onError() {
  loading.value = false
  playing.value = false
  if (current.value) ElMessage.warning(`「${current.value.name}」暂时无法播放`)
}

onMounted(() => {
  try {
    favs.value = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    favs.value = []
  }
})
</script>

<template>
  <div class="radio">
    <div class="head">
      <div>
        <h3 class="title">电台随身听</h3>
        <p class="sub">精选公共电台直播流,点击即听(需联网,部分源可能受网络限制)</p>
      </div>
      <div class="fav-note"><el-icon><StarFilled /></el-icon> 已收藏 {{ favs.length }}</div>
    </div>

    <!-- 正在播放 -->
    <div class="now" :class="{ live: playing }">
      <div class="now-icon"><el-icon :size="24"><Headset /></el-icon></div>
      <div class="now-meta">
        <div class="now-name">{{ current ? current.name : '未选择电台' }}</div>
        <div class="now-sub">{{ current ? current.genre : '从下方列表选择一个电台开始收听' }}</div>
      </div>
      <div class="now-ctrl">
        <el-button text circle :icon="VideoPlay" style="transform: rotate(180deg)" title="上一个" @click="step(-1)" />
        <el-button circle :icon="playing ? VideoPause : VideoPlay" :loading="loading" @click="togglePlay" />
        <el-button text circle :icon="VideoPlay" title="下一个" @click="step(1)" />
      </div>
      <div class="now-vol">
        <span class="v-label">音量</span>
        <el-slider v-model="vol" :show-tooltip="false" style="width: 110px" @input="onVolume" />
      </div>
    </div>

    <div class="genres">
      <button class="g" :class="{ on: filterGenre === '全部' }" @click="filterGenre = '全部'">全部</button>
      <button v-for="g in genreList" :key="g" class="g" :class="{ on: filterGenre === g }" @click="filterGenre = g">{{ g }}</button>
    </div>

    <div class="grid">
      <div v-for="s in shown" :key="s.id" class="card" :class="{ on: current?.id === s.id && playing }" @click="play(s)">
        <div class="card-top">
          <span class="dot" :style="{ background: s.accent }" />
          <span class="card-name">{{ s.name }}</span>
          <el-icon class="star" :class="{ lit: isFav(s.id) }" @click.stop="toggleFav(s)">
            <StarFilled v-if="isFav(s.id)" /><Star v-else />
          </el-icon>
        </div>
        <div class="card-genre">{{ s.genre }}</div>
        <div class="card-state">{{ current?.id === s.id && playing ? '正在播放' : '点击收听' }}</div>
      </div>
    </div>

    <audio ref="audio" @error="onError" @ended="playing = false" @pause="playing = false" @playing="playing = true" />
    <p class="foot">音频流来自 SomaFM / Radio Paradise / SRG SSR 等公开电台,版权归各电台所有。</p>
  </div>
</template>

<style scoped>
.radio {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
.fav-note {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.now {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.now.live {
  background: linear-gradient(120deg, color-mix(in srgb, #14b8a6 14%, var(--el-bg-color)), var(--el-bg-color));
  border-color: #14b8a6;
}
.now-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #14b8a6;
  color: #fff;
  flex: none;
}
.now-meta {
  flex: 1;
  min-width: 160px;
}
.now-name {
  font-size: 15px;
  font-weight: 700;
}
.now-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 3px;
}
.now-ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
}
.now-vol {
  display: flex;
  align-items: center;
  gap: 8px;
}
.v-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.genres {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.g {
  border: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}
.g.on {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.card:hover {
  transform: translateY(-2px);
}
.card.on {
  border-color: #14b8a6;
  background: color-mix(in srgb, #14b8a6 8%, var(--el-bg-color));
}
.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.card-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.star {
  color: var(--el-text-color-placeholder);
}
.star.lit {
  color: #f59e0b;
}
.card-genre {
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.card-state {
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
