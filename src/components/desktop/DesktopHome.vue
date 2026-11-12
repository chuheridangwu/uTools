<script setup lang="ts">
/**
 * 桌面模式首页(P1:仿找Tab 主题)
 * 壁纸铺满 + 顶部系统栏 + 中央搜索(支持拼音) + 圆角应用图标网格
 * + 底部 Dock(固定的系统图标 + 用户固定的应用) + 右键菜单 / 双击桌面隐藏。
 * 工具与应用统一以 AppWindow 浮层打开,不走路由跳转。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Moon, Search, Setting, Shop, Sunny, Clock } from '@element-plus/icons-vue'
import { useDesktopStore, type DesktopItem } from '@/stores/desktop'
import { useAppStore } from '@/stores/app'
import {
  CATALOG,
  CATALOG_MAP,
  pagePathOf,
  normalizeSearch,
  searchCatalog,
} from '@/config/appCatalog'
import { LIGHT_WALLPAPERS } from '@/config/wallpapers'
import AppIcon from './AppIcon.vue'
import AppWindow from './AppWindow.vue'
import StorePage from './StorePage.vue'
import AddAppPage from './AddAppPage.vue'
import SettingsPage from './SettingsPage.vue'

defineOptions({ name: 'DesktopHome' })

const desktop = useDesktopStore()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

/* ------------------------------ 外观 ------------------------------ */
const isLightBg = computed(() => LIGHT_WALLPAPERS.has(desktop.wallpaper.preset))
const iconPx = computed(() => desktop.iconPx)
const iconBoxStyle = computed(() => ({ width: `${iconPx.value}px`, height: `${iconPx.value}px` }))

/* ------------------------------ 搜索 ------------------------------ */
const searchRef = ref<HTMLInputElement>()
const searchKw = ref('')
const searchFocused = ref(false)

interface Hit extends DesktopItem { fromCatalog: boolean }

/** 搜索命中:先桌面应用,再商店未添加应用 */
const searchHits = computed<Hit[]>(() => {
  const q = normalizeSearch(searchKw.value)
  if (!q) return []
  const mine: Hit[] = desktop.items
    .filter((i) => normalizeSearch(`${i.name}${i.short ?? ''}${i.category ?? ''}`).includes(q))
    .slice(0, 5)
    .map((i) => ({ ...i, fromCatalog: false }))
  const rest: Hit[] = searchCatalog(searchKw.value, CATALOG)
    .filter((e) => !desktop.isOnDesktop(e.key))
    .slice(0, 4)
    .map((e) => ({
      key: e.key, name: e.name, icon: e.icon, accent: e.accent, kind: e.kind,
      short: e.short, desc: e.desc, category: e.categoryLabel,
      isNew: e.isNew, isHot: e.isHot, needsLogin: e.needsLogin,
      fromCatalog: true,
    }))
  return [...mine, ...rest].slice(0, 9)
})

/** 空查询时展示「最近打开」(聚焦即出现) */
const recentHits = computed<Hit[]>(() =>
  desktop.recentItems.slice(0, 6).map((e) => ({
    key: e.key, name: e.name, icon: e.icon, accent: e.accent, kind: e.kind,
    short: e.short, desc: e.desc, category: e.categoryLabel,
    isNew: e.isNew, isHot: e.isHot, needsLogin: e.needsLogin,
    fromCatalog: false,
  })),
)

const hitGroups = computed(() => {
  if (normalizeSearch(searchKw.value)) {
    return [{ key: 'match', title: '搜索结果', items: searchHits.value }].filter((g) => g.items.length)
  }
  return [{ key: 'recent', title: '最近打开', items: recentHits.value }].filter((g) => g.items.length)
})

const showHitPanel = computed(() =>
  (searchFocused.value && !normalizeSearch(searchKw.value) && recentHits.value.length > 0) ||
  (!!normalizeSearch(searchKw.value) && searchHits.value.length > 0),
)

function hitKind(h: Hit): string {
  return h.fromCatalog ? '商店 · 添加并打开' : h.kind === 'tool' ? '工具' : h.kind === 'app' ? '应用' : '网站'
}

function onHit(h: Hit) {
  openKey(h.key)
  searchKw.value = ''
}

function onSearchEnter() {
  if (searchHits.value.length) onHit(searchHits.value[0])
}

/* ------------------------------ 打开应用 ------------------------------ */
const windowState = reactive({ visible: false, key: '' })

function openKey(key: string) {
  const item = desktop.items.find((i) => i.key === key)
  if (item?.kind === 'site') {
    if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer')
    return
  }
  if (!CATALOG_MAP.has(key)) return
  if (!desktop.isOnDesktop(key)) desktop.add(key)
  desktop.pushRecent(key)
  // 整页应用(工作区/画布/阅读类):对齐找Tab 换独立路径打开,浏览器返回即回原页面
  const pp = pagePathOf(key)
  if (pp) {
    router.push(pp)
    return
  }
  windowState.key = key
  windowState.visible = true
}

/* ------------------------------ 图标拖拽 ------------------------------ */
const dragFrom = ref(-1)
const dragOver = ref(-1)
function onDragStart(index: number) { dragFrom.value = index }
function onDragEnter(index: number) { dragOver.value = index }
function onDrop() {
  if (dragFrom.value >= 0 && dragOver.value >= 0) desktop.move(dragFrom.value, dragOver.value)
  dragFrom.value = -1
  dragOver.value = -1
}

/* ------------------------------ 右键菜单 ------------------------------ */
const menu = reactive({ visible: false, x: 0, y: 0, item: null as DesktopItem | null })
function onContext(e: MouseEvent, item: DesktopItem) {
  e.preventDefault()
  menu.visible = true
  menu.x = Math.min(e.clientX, window.innerWidth - 180)
  menu.y = Math.min(e.clientY, window.innerHeight - 220)
  menu.item = item
}
function closeMenu() { menu.visible = false }
function menuOpen() { if (menu.item) openKey(menu.item.key); closeMenu() }
function menuPin() {
  if (menu.item) {
    desktop.toggleDock(menu.item.key)
    ElMessage.success(desktop.isDocked(menu.item.key) ? '已固定到 Dock' : '已从 Dock 移除')
  }
  closeMenu()
}
function menuHide() {
  if (menu.item) {
    desktop.hide(menu.item.key)
    ElMessage.success(menu.item.kind === 'site' ? '已删除网站快捷方式' : '已隐藏,可在「设置 → 隐藏的应用」恢复')
  }
  closeMenu()
}
function menuEdit() { if (menu.item) openAddPage(menu.item); closeMenu() }

/* ------------------------------ 添加 / 编辑 App ------------------------------ */
const addPageProps = reactive({
  site: null as DesktopItem | null,
  initialUrl: '',
  initialName: '',
})
function openAddPage(item?: DesktopItem, initial?: { url: string; name: string }) {
  addPageProps.site = item?.kind === 'site' ? item : null
  addPageProps.initialUrl = initial?.url ?? ''
  addPageProps.initialName = initial?.name ?? ''
  panel.value = 'add'
}

/* ------------------------------ Dock / 整页面板 ------------------------------ */
type Panel = '' | 'store' | 'add' | 'settings'
const iconsHidden = ref(false)

/**
 * 面板状态与 URL 同步,对齐找Tab 的 /store、/setting、/add-app 独立页面:
 * ?p=store / ?p=settings / ?p=add-app 可直接分享打开,浏览器前进/后退也能切换。
 * 用 vue-router 的 query 而非新增路由记录,避免与工具路由和桌面浮层冲突;
 * 用 push 而非 replace,让每次进出面板都进历史栈(对齐找Tab 的真实路由行为)。
 */
const panel = computed<Panel>({
  get() {
    const p = route.query.p
    if (p === 'store' || p === 'settings') return p
    if (p === 'add-app' || p === 'add') return 'add'
    return ''
  },
  set(v) {
    const q = { ...route.query }
    if (v) q.p = v === 'add' ? 'add-app' : v
    else delete q.p
    router.push({ query: q })
  },
})

type DockAction = 'home' | 'add' | 'store' | 'settings'
const systemDock = [
  { key: 'sys-home', label: '首页', icon: 'HomeFilled', accent: '#667eea', action: 'home' as DockAction },
  { key: 'sys-add', label: '添加 App', icon: 'CirclePlus', accent: '#22c55e', action: 'add' as DockAction },
  { key: 'sys-store', label: '应用商店', icon: 'Shop', accent: '#f59e0b', action: 'store' as DockAction },
  { key: 'sys-settings', label: '设置', icon: 'Setting', accent: '#64748b', action: 'settings' as DockAction },
]

const pinnedItems = computed(() =>
  desktop.dock
    .map((k) => desktop.items.find((i) => i.key === k))
    .filter((i): i is DesktopItem => Boolean(i)),
)

function dockAction(action: DockAction) {
  if (action === 'home') {
    panel.value = ''
    windowState.visible = false
    searchKw.value = ''
    iconsHidden.value = false
  } else if (action === 'add') openAddPage()
  else if (action === 'store') panel.value = 'store'
  else panel.value = 'settings'
}

/* ------------------------------ 时钟 ------------------------------ */
const clock = ref(new Date())
let clockTimer: number | null = null
const clockTime = computed(() => {
  const d = clock.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})
const clockDate = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(clock.value),
)

/* ------------------------------ 深链接 / 键盘 ------------------------------ */
watch(() => route.name, (name) => {
  if (desktop.mode !== 'desktop') return
  if (name && name !== 'home' && CATALOG_MAP.has(String(name))) {
    // 整页应用直达路径(/local-manga、/app/svg-editor 等)由 App.vue 渲染页面,不拦截
    if (pagePathOf(String(name))) return
    openKey(String(name))
    router.replace('/')
  }
}, { immediate: true })

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchRef.value?.focus()
    searchRef.value?.select()
  }
  if (e.key === 'Escape') {
    closeMenu()
    searchKw.value = ''
    iconsHidden.value = false
    // 有应用窗口时先关窗口(商店等面板保持在底下),再逐层退出
    if (windowState.visible) {
      windowState.visible = false
      return
    }
    if (panel.value) panel.value = ''
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', closeMenu)
  document.documentElement.classList.toggle('dark', appStore.dark)
  clockTimer = window.setInterval(() => { clock.value = new Date() }, 1000)
  // 书签小工具:?add=<网址>&name=<标题> → 直接打开添加 App 页并预填,
  // 随后把地址收敛成 ?p=add-app,避免网址/标题长期留在地址栏里。
  const params = new URLSearchParams(window.location.search)
  const addUrl = params.get('add')
  if (addUrl) {
    addPageProps.site = null
    addPageProps.initialUrl = addUrl
    addPageProps.initialName = params.get('name') ?? ''
    router.replace({ query: { p: 'add-app' } })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', closeMenu)
  if (clockTimer) clearInterval(clockTimer)
})

function toggleDark() {
  appStore.toggleDark()
  document.documentElement.classList.toggle('dark', appStore.dark)
}

/** 双击桌面空白处隐藏 / 恢复图标(对齐找Tab 的「双击桌面隐藏」) */
function onDesktopDblClick(e: MouseEvent) {
  if (!desktop.doubleClickHide) return
  const t = e.target as HTMLElement
  if (t.closest('.icon-tile, .dock-wrap, .topbar, .search-wrap, .clock, .ctx')) return
  iconsHidden.value = !iconsHidden.value
  ElMessage.info(iconsHidden.value ? '已隐藏桌面图标,再次双击空白处恢复' : '已恢复桌面图标')
}

function onTileClick(item: DesktopItem) {
  if (!desktop.doubleClickOpen) openKey(item.key)
}
function onTileDblClick(item: DesktopItem) {
  if (desktop.doubleClickOpen) openKey(item.key)
}
</script>

<template>
  <div
    class="desktop"
    :class="{ 'glass-on': desktop.glass, 'light-bg': isLightBg }"
    :style="{ background: desktop.wallpaperStyle }"
    @dblclick="onDesktopDblClick"
  >
    <div class="dim" :class="{ on: appStore.dark && !isLightBg }" />

    <!-- 顶部系统栏 -->
    <header class="topbar">
      <div class="brand" @click="dockAction('home')">
        <span class="brand-mark">u</span>
        <span class="brand-name">uTools</span>
      </div>
      <div class="top-actions">
        <button class="top-btn" title="应用商店" @click="panel = 'store'">
          <el-icon :size="17"><Shop /></el-icon><span>应用商店</span>
        </button>
        <button class="top-btn" title="设置" @click="panel = 'settings'">
          <el-icon :size="17"><Setting /></el-icon><span>设置</span>
        </button>
        <button class="top-btn icon-only" :title="appStore.dark ? '切到亮色' : '切到暗色'" @click="toggleDark">
          <el-icon :size="17"><Sunny v-if="appStore.dark" /><Moon v-else /></el-icon>
        </button>
      </div>
    </header>

    <!-- 桌面时钟 -->
    <div v-if="desktop.showClock" class="clock">
      <div class="clock-time">{{ clockTime }}</div>
      <div class="clock-date">{{ clockDate }}</div>
    </div>

    <!-- 中央搜索(支持拼音;聚焦空查询显示最近打开) -->
    <div class="search-wrap">
      <div class="search glass">
        <el-icon :size="18"><Search /></el-icon>
        <input
          ref="searchRef"
          v-model="searchKw"
          class="search-input"
          placeholder="搜索工具或应用,支持拼音(如 chakanqi、ewm)"
          @keydown.enter="onSearchEnter"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <kbd class="kbd">⌘K</kbd>
      </div>
      <div v-if="showHitPanel" class="hits glass">
        <template v-for="g in hitGroups" :key="g.key">
          <div class="hits-group">
            <el-icon :size="12"><Clock /></el-icon>
            <span>{{ g.title }}</span>
            <span class="hits-group-n">{{ g.items.length }}</span>
          </div>
          <div v-for="h in g.items" :key="h.key" class="hit" @mousedown.prevent="onHit(h)">
            <AppIcon
              :name="h.name" :icon="h.icon" :accent="h.accent"
              :emoji="h.emoji" :icon-url="h.iconUrl" :size="30" :font-size="15"
            />
            <span class="hit-name">{{ h.name }}</span>
            <span v-if="h.isNew" class="hit-badge new">新</span>
            <span v-else-if="h.isHot" class="hit-badge hot">最热</span>
            <span class="hit-kind">{{ hitKind(h) }}</span>
          </div>
        </template>
      </div>
      <div v-else-if="searchKw && !searchHits.length" class="hits glass empty">没有找到相关应用,试试「应用商店」</div>
    </div>

    <!-- 应用图标网格 -->
    <div v-show="!iconsHidden" class="icon-grid">
      <div
        v-for="(item, index) in desktop.items"
        :key="item.key"
        class="icon-tile"
        :class="{ dragging: dragFrom === index, over: dragOver === index && dragFrom !== index }"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragenter.prevent="onDragEnter(index)"
        @dragover.prevent
        @drop.prevent="onDrop"
        @dragend="onDrop"
        @click="onTileClick(item)"
        @dblclick="onTileDblClick(item)"
        @contextmenu="onContext($event, item)"
      >
        <div class="tile-icon-wrap" :style="iconBoxStyle">
          <AppIcon
            :name="item.name" :icon="item.icon" :accent="item.accent"
            :emoji="item.emoji" :icon-url="item.iconUrl"
            :size="iconPx" :rounded="desktop.iconStyle === 'rounded'"
          />
          <span v-if="item.isNew" class="tile-badge new">新</span>
          <span v-else-if="item.isHot" class="tile-badge hot">热</span>
        </div>
        <span v-if="desktop.showLabels" class="tile-name">{{ item.name }}</span>
      </div>
    </div>

    <!-- 底部 Dock:固定系统图标 + 用户固定应用 -->
    <div v-if="desktop.showDock" class="dock-wrap">
      <div class="dock glass">
        <div
          v-for="s in systemDock"
          :key="s.key"
          class="dock-item sys"
          :title="s.label"
          @click="dockAction(s.action)"
        >
          <AppIcon :name="s.label" :icon="s.icon" :accent="s.accent" :size="42" :font-size="21" />
          <span class="dock-tip">{{ s.label }}</span>
        </div>
        <div v-if="pinnedItems.length" class="dock-sep" />
        <div
          v-for="item in pinnedItems"
          :key="item.key"
          class="dock-item"
          :title="item.name"
          @click="openKey(item.key)"
        >
          <AppIcon
            :name="item.name" :icon="item.icon" :accent="item.accent"
            :emoji="item.emoji" :icon-url="item.iconUrl" :size="42"
          />
          <span class="dock-tip">{{ item.name }}</span>
        </div>
        <div v-if="!pinnedItems.length" class="dock-empty">右键图标可固定到 Dock</div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="menu.visible" class="ctx glass" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
        <button @click="menuOpen">打开</button>
        <button @click="menuPin">{{ desktop.isDocked(menu.item?.key || '') ? '从 Dock 移除' : '固定到 Dock' }}</button>
        <button v-if="menu.item?.kind === 'site'" @click="menuEdit">编辑网站</button>
        <button class="danger" @click="menuHide">{{ menu.item?.kind === 'site' ? '删除' : '隐藏应用' }}</button>
      </div>
    </teleport>

    <!-- 整页:应用商店 / 添加 App / 设置 -->
    <StorePage
      v-if="panel === 'store'"
      @close="panel = ''"
      @add-app="openAddPage()"
      @open="openKey"
    />
    <AddAppPage
      v-if="panel === 'add'"
      :site="addPageProps.site"
      :initial-url="addPageProps.initialUrl"
      :initial-name="addPageProps.initialName"
      @close="panel = ''"
    />
    <SettingsPage v-if="panel === 'settings'" @close="panel = ''" />

    <!-- 应用窗口 -->
    <AppWindow :visible="windowState.visible" :app-key="windowState.key" @close="windowState.visible = false" />
  </div>
</template>

<style scoped>
.desktop {
  --fg: #fff;
  --fg-soft: rgb(255 255 255 / 82%);
  --glass-bg: rgb(255 255 255 / 18%);
  --glass-border: rgb(255 255 255 / 24%);
  --shadow: 0 8px 28px rgb(15 23 42 / 22%);
  position: relative;
  height: 100%;
  min-height: 100vh;
  overflow: auto;
  color: var(--fg);
  background-size: cover;
}
.desktop.light-bg {
  --fg: #1e293b;
  --fg-soft: rgb(30 41 59 / 72%);
  --glass-bg: rgb(255 255 255 / 58%);
  --glass-border: rgb(255 255 255 / 78%);
  --shadow: 0 8px 28px rgb(30 41 59 / 14%);
}
.dim {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0%);
  transition: background 0.3s;
  pointer-events: none;
}
.dim.on { background: rgb(0 0 0 / 32%); }
.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
.glass-on .glass {
  background: var(--glass-bg);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

/* 顶部系统栏 */
.topbar {
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  user-select: none;
}
.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 17px;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
  box-shadow: 0 4px 12px rgb(102 126 234 / 45%);
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 6px rgb(0 0 0 / 25%);
}
.top-actions { display: flex; align-items: center; gap: 6px; }
.top-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--glass-bg);
  color: var(--fg);
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}
.top-btn:hover { transform: translateY(-1px); border-color: var(--glass-border); }
.top-btn.icon-only { padding: 8px; }

/* 时钟 */
.clock {
  position: absolute;
  top: 68px;
  left: 24px;
  z-index: 5;
  pointer-events: none;
  text-shadow: 0 2px 10px rgb(0 0 0 / 28%);
}
.light-bg .clock { text-shadow: 0 1px 4px rgb(255 255 255 / 60%); }
.clock-time {
  font-size: 34px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  line-height: 1.1;
}
.clock-date { margin-top: 2px; font-size: 12px; color: var(--fg-soft); }

/* 中央搜索 */
.search-wrap {
  position: relative;
  z-index: 8;
  max-width: 560px;
  margin: 8vh auto 0;
  padding: 0 20px;
}
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 18px;
  border-radius: 26px;
  color: var(--fg);
  box-shadow: var(--shadow);
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: inherit;
}
.search-input::placeholder { color: var(--fg-soft); opacity: 0.8; }
.kbd {
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  font-size: 11px;
  color: var(--fg-soft);
  white-space: nowrap;
}
.hits {
  position: absolute;
  top: 58px;
  left: 20px;
  right: 20px;
  border-radius: 16px;
  padding: 7px;
  box-shadow: var(--shadow);
  max-height: 380px;
  overflow-y: auto;
}
.hits.empty { padding: 14px; text-align: center; font-size: 12px; color: var(--fg-soft); }
.hits-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-soft);
  letter-spacing: 0.02em;
}
.hits-group-n {
  font-weight: 400;
  opacity: 0.7;
}
.hit {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 11px;
  cursor: pointer;
}
.hit:hover { background: var(--glass-bg); }
.hit-name { flex: 1; font-size: 13px; }
.hit-kind { font-size: 11px; color: var(--fg-soft); white-space: nowrap; }
.hit-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 7px;
  color: #fff;
}
.hit-badge.new { background: #22c55e; }
.hit-badge.hot { background: #f97316; }

/* 图标网格 */
.icon-grid {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 20px 8px;
  max-width: 920px;
  margin: 5vh auto 0;
  padding: 0 24px 190px;
}
.icon-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: grab;
  border-radius: 14px;
  padding: 8px 4px;
  transition: background 0.15s, transform 0.15s;
}
.icon-tile:hover { background: var(--glass-bg); transform: translateY(-2px); }
.icon-tile.dragging { opacity: 0.35; }
.icon-tile.over { outline: 2px dashed var(--glass-border); }
.tile-icon-wrap { position: relative; }
.tile-icon-wrap :deep(.app-icon) { box-shadow: 0 8px 20px rgb(15 23 42 / 26%), inset 0 1px 0 rgb(255 255 255 / 28%); }
.icon-tile:hover .tile-icon-wrap :deep(.app-icon) { transform: scale(1.06); }
.tile-badge {
  position: absolute;
  top: -5px;
  right: -7px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  color: #fff;
  border: 2px solid rgb(255 255 255 / 85%);
  box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}
.tile-badge.new { background: #22c55e; }
.tile-badge.hot { background: #f97316; }
.tile-name {
  font-size: 12px;
  color: var(--fg);
  text-shadow: 0 1px 5px rgb(0 0 0 / 30%);
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.light-bg .tile-name { text-shadow: 0 1px 3px rgb(255 255 255 / 80%); }

/* Dock */
.dock-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 18px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}
.dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 14px;
  border-radius: 22px;
  min-height: 62px;
  max-width: 88vw;
  overflow-x: auto;
  box-shadow: var(--shadow);
}
.dock-item { position: relative; cursor: pointer; transition: transform 0.16s; }
.dock-item:hover { transform: translateY(-6px) scale(1.06); }
.dock-item :deep(.app-icon) { box-shadow: 0 5px 14px rgb(15 23 42 / 25%), inset 0 1px 0 rgb(255 255 255 / 25%); }
.dock-sep { width: 1px; height: 34px; background: var(--glass-border); margin: 0 3px; flex: none; }
.dock-empty { font-size: 12px; color: var(--fg-soft); padding: 0 8px; white-space: nowrap; }
.dock-tip {
  position: absolute;
  bottom: 52px;
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  opacity: 0;
  pointer-events: none;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 11px;
  white-space: nowrap;
  background: rgb(15 23 42 / 88%);
  color: #fff;
  transition: opacity 0.15s, transform 0.15s;
}
.dock-item:hover .dock-tip { opacity: 1; transform: translateX(-50%) scale(1); }

/* 右键菜单:teleport 到 body,拿不到 .desktop 上的 CSS 变量,需自带配色 */
.ctx {
  --ctx-bg: rgb(255 255 255 / 92%);
  --ctx-fg: #1f2937;
  --ctx-hover: rgb(102 126 234 / 12%);
  position: fixed;
  z-index: 2000;
  border-radius: 14px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  min-width: 158px;
  background: var(--ctx-bg);
  color: var(--ctx-fg);
  box-shadow: 0 10px 30px rgb(15 23 42 / 26%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
html.dark .ctx {
  --ctx-bg: rgb(27 36 52 / 94%);
  --ctx-fg: #e5e7eb;
  --ctx-hover: rgb(255 255 255 / 10%);
}
.ctx button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--ctx-fg);
  cursor: pointer;
}
.ctx button:hover { background: var(--ctx-hover); }
.ctx button.danger { color: #f87171; }
</style>
