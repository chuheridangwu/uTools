<script setup lang="ts">
/**
 * 桌面模式首页(模仿找Tab):
 * 壁纸背景 + 中央搜索 + 可拖拽 App 图标网格 + 底部 Dock + 应用商店/设置抽屉
 * 工具与应用以 AppWindow 浮层打开,不走路由跳转。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import {
  CirclePlus,
  Link,
  Moon,
  Plus,
  Search,
  Setting,
  Sunny,
} from '@element-plus/icons-vue'
import { useDesktopStore, type DesktopItem } from '@/stores/desktop'
import { useAppStore } from '@/stores/app'
import { APP_MAP, type DesktopAppMeta } from '@/config/desktopApps'
import { TOOL_MAP, TOOLS } from '@/config/tools'
import CommandPalette from '@/components/CommandPalette.vue'
import AppWindow from '@/components/desktop/AppWindow.vue'
import StoreDrawer from '@/components/desktop/StoreDrawer.vue'
import SettingsDrawer from '@/components/desktop/SettingsDrawer.vue'

/** 图标名 → 组件(找不到回退 Grid) */
function iconOf(name: string): Component {
  return (ElIcons as unknown as Record<string, Component>)[name] ?? ElIcons.Grid
}

defineOptions({ name: 'DesktopHome' })

const desktop = useDesktopStore()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

/* ------------------------------ 搜索 ------------------------------ */
const searchKw = ref('')
const paletteVisible = ref(false)
const searchHits = computed(() => {
  const kw = searchKw.value.trim().toLowerCase()
  if (!kw) return []
  return desktop.items
    .filter((i) => i.name.toLowerCase().includes(kw) || (TOOL_MAP.get(i.key)?.keywords ?? []).some((k) => k.toLowerCase().includes(kw)))
    .slice(0, 6)
})

function openItem(item: DesktopItem) {
  openKey(item.key)
}

function openKey(key: string) {
  const item = desktop.items.find((i) => i.key === key)
  if (!item) return
  if (item.kind === 'site') {
    window.open(item.url, '_blank')
    return
  }
  windowState.key = key
  windowState.visible = true
}

function onSearchEnter() {
  if (searchHits.value.length) {
    openItem(searchHits.value[0])
    searchKw.value = ''
  }
}

/* ------------------------------ 图标拖拽 ------------------------------ */
const dragFrom = ref(-1)
const dragOver = ref(-1)

function onDragStart(index: number) {
  dragFrom.value = index
}

function onDragEnter(index: number) {
  dragOver.value = index
}

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
  menu.x = Math.min(e.clientX, window.innerWidth - 170)
  menu.y = Math.min(e.clientY, window.innerHeight - 150)
  menu.item = item
}

function closeMenu() {
  menu.visible = false
}

function menuPin() {
  if (menu.item) {
    desktop.toggleDock(menu.item.key)
    ElMessage.success(desktop.isDocked(menu.item.key) ? '已固定到 Dock' : '已从 Dock 移除')
  }
  closeMenu()
}

function menuRemove() {
  if (menu.item) {
    desktop.remove(menu.item.key)
    ElMessage.success('已从桌面移除,可在应用商店重新添加')
  }
  closeMenu()
}

function menuOpen() {
  if (menu.item) openItem(menu.item)
  closeMenu()
}

/* ------------------------------ 添加网站 ------------------------------ */
const siteDialog = reactive({ visible: false, name: '', url: '' })

function openSiteDialog() {
  siteDialog.visible = true
  siteDialog.name = ''
  siteDialog.url = ''
}

function confirmSite() {
  if (!siteDialog.name.trim() || !siteDialog.url.trim()) {
    ElMessage.warning('名称和网址都要填')
    return
  }
  desktop.addSite(siteDialog.name.trim(), siteDialog.url.trim())
  siteDialog.visible = false
  ElMessage.success('已添加到桌面')
}

/* ------------------------------ 抽屉与窗口 ------------------------------ */
const storeVisible = ref(false)
const settingsVisible = ref(false)
const windowState = reactive({ visible: false, key: '' })

/* ------------------------------ 深链接兼容 ------------------------------ */
/* 桌面模式下访问 /xxx 工具路由 → 转为窗口打开,URL 拉回 / */
watch(() => route.name, (name) => {
  if (desktop.mode !== 'desktop') return
  if (name && name !== 'home' && TOOL_MAP.has(String(name))) {
    if (!desktop.isOnDesktop(String(name))) desktop.addTool(String(name))
    windowState.key = String(name)
    windowState.visible = true
    router.replace('/')
  }
}, { immediate: true })

/* ------------------------------ 键盘 ------------------------------ */
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteVisible.value = true
  }
  if (e.key === 'Escape') closeMenu()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', closeMenu)
  document.documentElement.classList.toggle('dark', appStore.dark)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', closeMenu)
})

function toggleDark() {
  appStore.toggleDark()
}

function iconSizeStyle() {
  const px = desktop.iconPx
  return { width: px + 'px', height: px + 'px', fontSize: px * 0.42 + 'px' }
}

function appMeta(key: string): DesktopAppMeta | undefined {
  return APP_MAP.get(key)
}

const siteInitial = (item: DesktopItem) => item.name.slice(0, 1).toUpperCase()
</script>

<template>
  <div class="desktop" :class="{ 'glass-on': desktop.glass }" :style="{ background: desktop.wallpaperStyle }">
    <!-- 暗色时加深遮罩保证可读性 -->
    <div class="dim" :class="{ on: appStore.dark }" />

    <!-- 中央搜索 -->
    <div class="search-wrap">
      <div class="search glass">
        <el-icon><Search /></el-icon>
        <input
          v-model="searchKw"
          class="search-input"
          placeholder="搜索应用与工具…"
          @keydown.enter="onSearchEnter"
        />
        <kbd class="kbd">⌘K</kbd>
      </div>
      <div v-if="searchKw && searchHits.length" class="hits glass">
        <div v-for="h in searchHits" :key="h.key" class="hit" @click="openItem(h); searchKw = ''">
          <span class="hit-icon" :style="{ background: h.accent }">{{ h.kind === 'site' ? siteInitial(h) : h.name.slice(0, 1) }}</span>
          <span class="hit-name">{{ h.name }}</span>
          <span class="hit-kind">{{ h.kind === 'tool' ? '工具' : h.kind === 'app' ? '应用' : '网站' }}</span>
        </div>
      </div>
    </div>

    <!-- 图标网格 -->
    <div class="icon-grid">
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
        @click="openItem(item)"
        @contextmenu="onContext($event, item)"
      >
        <div class="tile-icon glass" :style="iconSizeStyle()">
          <el-icon v-if="item.kind !== 'site'" :size="26" :color="item.accent">
            <component :is="iconOf(item.icon)" />
          </el-icon>
          <span v-else class="site-letter" :style="{ color: '#fff', background: item.accent }">{{ siteInitial(item) }}</span>
        </div>
        <span class="tile-name">{{ item.name }}</span>
      </div>
    </div>

    <!-- Dock -->
    <div class="dock-wrap">
      <div class="dock glass">
        <div
          v-for="k in desktop.dock"
          :key="k"
          class="dock-item"
          :title="desktop.items.find(i => i.key === k)?.name || k"
          @click="openKey(k)"
        >
          <span class="dock-icon" :style="{ background: desktop.items.find(i => i.key === k)?.accent || '#64748b' }">
            {{ (desktop.items.find(i => i.key === k)?.name || k).slice(0, 1) }}
          </span>
        </div>
        <div v-if="!desktop.dock.length" class="dock-empty">右键图标可固定到 Dock</div>
      </div>
    </div>

    <!-- 底部操作条 -->
    <div class="action-bar glass">
      <button class="action" @click="openSiteDialog"><el-icon><Link /></el-icon>添加 App</button>
      <button class="action" @click="storeVisible = true"><el-icon><CirclePlus /></el-icon>应用商店</button>
      <button class="action" @click="settingsVisible = true"><el-icon><Setting /></el-icon>设置</button>
    </div>

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="menu.visible" class="ctx glass" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
        <button @click="menuOpen">打开</button>
        <button @click="menuPin">{{ desktop.isDocked(menu.item?.key || '') ? '从 Dock 移除' : '固定到 Dock' }}</button>
        <button class="danger" @click="menuRemove">从桌面移除</button>
      </div>
    </teleport>

    <!-- 添加网站对话框 -->
    <el-dialog v-model="siteDialog.visible" title="添加 App(网站快捷方式)" width="380px">
      <el-form label-width="60px">
        <el-form-item label="名称">
          <el-input v-model="siteDialog.name" placeholder="如:公司邮箱" />
        </el-form-item>
        <el-form-item label="网址">
          <el-input v-model="siteDialog.url" placeholder="https://mail.example.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="siteDialog.visible = false">取消</el-button>
        <el-button type="primary" :icon="Plus" @click="confirmSite">添加</el-button>
      </template>
    </el-dialog>

    <!-- 应用商店 / 设置抽屉 -->
    <StoreDrawer v-model="storeVisible" @open="openKey" />
    <SettingsDrawer v-model="settingsVisible" />

    <!-- 应用窗口 -->
    <AppWindow :visible="windowState.visible" :app-key="windowState.key" @close="windowState.visible = false" />

    <!-- 命令面板 -->
    <CommandPalette v-model="paletteVisible" />

    <!-- 主题切换悬浮钮 -->
    <button class="theme-btn glass" :title="appStore.dark ? '切到亮色' : '切到暗色'" @click="toggleDark">
      <el-icon><Sunny v-if="appStore.dark" /><Moon v-else /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.desktop {
  position: relative;
  height: 100%;
  overflow: auto;
  color: #fff;
}
.dim {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0%);
  transition: background 0.3s;
  pointer-events: none;
}
.dim.on {
  background: rgb(0 0 0 / 35%);
}
.glass {
  background: rgb(255 255 255 / 24%);
  border: 1px solid rgb(255 255 255 / 22%);
}
/* 毛玻璃开关:开启时才应用模糊与更透的底色 */
.glass-on .glass {
  background: rgb(255 255 255 / 14%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* 搜索 */
.search-wrap {
  position: relative;
  max-width: 520px;
  margin: 9vh auto 0;
  padding: 0 20px;
}
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  border-radius: 24px;
  color: rgb(255 255 255 / 85%);
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: inherit;
}
.search-input::placeholder {
  color: rgb(255 255 255 / 45%);
}
.kbd {
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid rgb(255 255 255 / 25%);
  font-size: 11px;
  color: rgb(255 255 255 / 60%);
}
.hits {
  position: absolute;
  top: 56px;
  left: 20px;
  right: 20px;
  border-radius: 16px;
  padding: 8px;
  z-index: 20;
}
.hit {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  color: #fff;
}
.hit:hover {
  background: rgb(255 255 255 / 14%);
}
.hit-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 13px;
  flex: none;
}
.hit-name {
  flex: 1;
  font-size: 13px;
}
.hit-kind {
  font-size: 11px;
  color: rgb(255 255 255 / 50%);
}

/* 图标网格 */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 18px 8px;
  max-width: 860px;
  margin: 5vh auto 0;
  padding: 0 24px 20px;
}
.icon-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  cursor: grab;
  border-radius: 14px;
  padding: 8px 4px;
  transition: background 0.15s, transform 0.15s;
}
.icon-tile:hover {
  background: rgb(255 255 255 / 10%);
}
.icon-tile.dragging {
  opacity: 0.35;
}
.icon-tile.over {
  outline: 2px dashed rgb(255 255 255 / 50%);
}
.tile-icon {
  display: grid;
  place-items: center;
  border-radius: 26%;
  color: #fff;
  box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
}
.site-letter {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 26%;
  font-weight: 700;
}
.tile-name {
  font-size: 12px;
  color: rgb(255 255 255 / 92%);
  text-shadow: 0 1px 4px rgb(0 0 0 / 35%);
  max-width: 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* Dock */
.dock-wrap {
  position: sticky;
  bottom: 64px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 20px;
  min-height: 56px;
  min-width: 120px;
  max-width: 80vw;
  overflow-x: auto;
}
.dock-item {
  cursor: pointer;
  transition: transform 0.15s;
}
.dock-item:hover {
  transform: translateY(-4px) scale(1.06);
}
.dock-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}
.dock-empty {
  font-size: 12px;
  color: rgb(255 255 255 / 45%);
  padding: 0 6px;
}

/* 底部操作条 */
.action-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 12px;
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 16px;
  z-index: 30;
}
.action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: rgb(255 255 255 / 85%);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.action:hover {
  background: rgb(255 255 255 / 14%);
}

/* 右键菜单 */
.ctx {
  position: fixed;
  z-index: 2000;
  border-radius: 12px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  min-width: 150px;
}
.ctx button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
}
.ctx button:hover {
  background: rgb(255 255 255 / 14%);
}
.ctx button.danger {
  color: #fca5a5;
}

.theme-btn {
  position: fixed;
  top: 14px;
  right: 14px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  cursor: pointer;
  z-index: 40;
}
</style>
