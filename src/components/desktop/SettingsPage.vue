<script setup lang="ts">
/**
 * 设置整页(P4,仿找Tab /setting)
 * 分组:个性化(壁纸管理 / 隐藏的应用 / 显示与交互)、账户与数据(账户管理 / 数据管理)、帮助与反馈(关于)。
 * 云端同步在本项目里以「仅本地 + 导出/导入备份」等价实现,不做后端。
 */
import { computed, ref, type Component } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  FolderOpened,
  Grid,
  InfoFilled,
  Picture,
  Setting,
  User,
} from '@element-plus/icons-vue'
import { useDesktopStore, WALLPAPERS, type WallpaperPreset } from '@/stores/desktop'
import { useAppStore } from '@/stores/app'
import { WALLPAPER_GROUPS } from '@/config/wallpapers'
import { CATALOG, STORE_CATEGORIES } from '@/config/appCatalog'
import { formatSize } from '@/utils/common'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ close: [] }>()
const desktop = useDesktopStore()
const appStore = useAppStore()

type Section = 'wallpaper' | 'hidden' | 'display' | 'account' | 'data' | 'about'
const section = ref<Section>('wallpaper')

const navGroups: { label: string; items: { key: Section; label: string; icon: Component }[] }[] = [
  {
    label: '个性化',
    items: [
      { key: 'wallpaper', label: '壁纸管理', icon: Picture },
      { key: 'hidden', label: '隐藏的应用', icon: Grid },
      { key: 'display', label: '显示与交互', icon: Setting },
    ],
  },
  {
    label: '账户与数据',
    items: [
      { key: 'account', label: '账户管理', icon: User },
      { key: 'data', label: '数据管理', icon: FolderOpened },
    ],
  },
  {
    label: '帮助与反馈',
    items: [{ key: 'about', label: '关于 uTools', icon: InfoFilled }],
  },
]

const storageBytes = ref(desktop.storageUsageBytes())
function refreshStorage() { storageBytes.value = desktop.storageUsageBytes() }

/* ------------------------------ 壁纸 ------------------------------ */
const wallpaperInput = ref<HTMLInputElement>()
const customWallpaper = computed(() =>
  desktop.wallpaper.preset === 'custom' && desktop.wallpaper.custom ? desktop.wallpaper.custom : '',
)

function onUploadWallpaper(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }
  const img = new Image()
  img.onload = () => {
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    try {
      desktop.setWallpaper('custom', canvas.toDataURL('image/jpeg', 0.82))
      ElMessage.success('壁纸已更新')
      refreshStorage()
    } catch { ElMessage.error('图片处理失败') }
  }
  img.src = URL.createObjectURL(file)
}

/* ------------------------------ 备份 ------------------------------ */
const importInput = ref<HTMLInputElement>()

function exportBackup() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([desktop.exportConfig()], { type: 'application/json' }))
  a.download = `utools-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  ElMessage.success('已导出 JSON 备份')
}

function onImportBackup(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (desktop.importConfig(String(reader.result))) {
      ElMessage.success('已从备份恢复')
      refreshStorage()
    } else ElMessage.error('备份文件格式不正确')
  }
  reader.readAsText(file)
}

async function resetLayout() {
  await ElMessageBox.confirm('将恢复默认桌面图标与 Dock,壁纸与自定义网站保留。继续?', '重置桌面布局', { type: 'warning' })
  desktop.resetLayout()
  ElMessage.success('已重置')
  refreshStorage()
}

/* ------------------------------ Dock 选择 ------------------------------ */
function selectAllDock() { desktop.setDockIds(desktop.items.map((i) => i.key)) }
function clearDock() { desktop.setDockIds([]) }

/* ------------------------------ 开关辅助 ------------------------------ */
type BoolKey =
  | 'showDock' | 'showLabels' | 'glass' | 'showClock' | 'doubleClickOpen' | 'doubleClickHide'
const toggles: { key: BoolKey; label: string; tip: string }[] = [
  { key: 'showDock', label: '显示 Dock', tip: '屏幕底部的快捷栏,可固定常用应用' },
  { key: 'showLabels', label: '显示图标名称', tip: '关闭后桌面只显示图标' },
  { key: 'glass', label: '毛玻璃效果', tip: '搜索框、Dock 与卡片的背景模糊' },
  { key: 'showClock', label: '显示桌面时钟', tip: '左上角的时间与日期' },
  { key: 'doubleClickOpen', label: '双击打开应用', tip: '开启后单击不再直接打开' },
  { key: 'doubleClickHide', label: '双击桌面隐藏', tip: '双击空白区域隐藏/恢复桌面图标' },
]

function setBool(key: BoolKey, v: boolean) {
  const map: Record<BoolKey, (x: boolean) => void> = {
    showDock: desktop.setShowDock,
    showLabels: desktop.setShowLabels,
    glass: desktop.setGlass,
    showClock: desktop.setShowClock,
    doubleClickOpen: desktop.setDoubleClickOpen,
    doubleClickHide: desktop.setDoubleClickHide,
  }
  map[key](v)
}
function boolOf(key: BoolKey): boolean { return desktop[key] as boolean }

function previewCss(preset: WallpaperPreset): string {
  return WALLPAPERS[preset as Exclude<WallpaperPreset, 'custom'>] ?? WALLPAPERS['purple-blue']
}
</script>

<template>
  <div class="zt-page">
    <header class="zt-head">
      <button class="zt-back" title="返回桌面" @click="emit('close')">
        <el-icon :size="18"><ArrowLeft /></el-icon>
      </button>
      <div>
        <h1 class="zt-h1">设置</h1>
        <div class="zt-sub">个性化、应用管理与数据备份</div>
      </div>
    </header>

    <div class="zt-page-inner settings-layout">
      <aside class="settings-nav">
        <div v-for="g in navGroups" :key="g.label" class="nav-group">
          <div class="nav-label">{{ g.label }}</div>
          <button
            v-for="it in g.items"
            :key="it.key"
            class="nav-item"
            :class="{ on: section === it.key }"
            @click="section = it.key"
          >
            <el-icon :size="16"><component :is="it.icon" /></el-icon>
            <span>{{ it.label }}</span>
            <span v-if="it.key === 'hidden' && desktop.hiddenItems.length" class="nav-count">{{ desktop.hiddenItems.length }}</span>
          </button>
        </div>
      </aside>

      <main class="settings-content">
        <!-- ───────────── 壁纸管理 ───────────── -->
        <template v-if="section === 'wallpaper'">
          <div class="zt-card">
            <div class="zt-card-title">壁纸管理</div>
            <div class="zt-card-desc">选择桌面背景,点击后立即生效</div>
            <template v-for="g in WALLPAPER_GROUPS" :key="g.key">
              <div class="zt-section-label">{{ g.label }} · {{ g.desc }}</div>
              <div class="zt-wall-grid">
                <button
                  v-for="w in g.items"
                  :key="w.id"
                  class="zt-wall"
                  :class="{ on: desktop.wallpaper.preset === w.id }"
                  :style="{ background: w.css }"
                  @click="desktop.setWallpaper(w.id)"
                >
                  <span class="zt-wall-name">{{ w.name }}</span>
                </button>
              </div>
            </template>
            <div class="zt-section-label">自定义</div>
            <div class="zt-wall-grid">
              <button
                v-if="customWallpaper"
                class="zt-wall on"
                :style="{ background: `center / cover no-repeat url(${customWallpaper})` }"
                @click="desktop.setWallpaper('custom', customWallpaper)"
              >
                <span class="zt-wall-name">我的壁纸</span>
              </button>
              <button class="zt-wall upload" @click="wallpaperInput?.click()">＋ 上传壁纸</button>
              <input ref="wallpaperInput" type="file" accept="image/*" hidden @change="onUploadWallpaper" />
            </div>
            <div class="zt-hint">上传的图片会压缩到最长边 1600px 后保存在本机浏览器,不会上传服务器。</div>
          </div>
        </template>

        <!-- ───────────── 隐藏的应用 ───────────── -->
        <template v-else-if="section === 'hidden'">
          <div class="zt-card">
            <div class="zt-card-title">隐藏的应用</div>
            <div class="zt-card-desc">从桌面移除的应用会放在这里,可以随时恢复到桌面</div>
            <div class="zt-inline" style="margin-bottom: 10px">
              <button class="zt-btn" :disabled="!desktop.hiddenItems.length" @click="desktop.restoreAll()">全部恢复到桌面</button>
              <span class="zt-sub">共 {{ desktop.hiddenItems.length }} 个隐藏应用</span>
            </div>
            <div v-if="!desktop.hiddenItems.length" class="zt-empty">没有隐藏的应用</div>
            <div v-else>
              <div v-for="e in desktop.hiddenItems" :key="e.key" class="zt-row-between">
                <div class="zt-inline">
                  <AppIcon :name="e.name" :icon="e.icon" :accent="e.accent" :size="36" :font-size="17" />
                  <div>
                    <div class="zt-row-label">{{ e.name }}</div>
                    <div class="zt-row-tip">{{ e.categoryLabel }} · {{ e.short }}</div>
                  </div>
                </div>
                <button class="zt-btn" @click="desktop.restore(e.key)">显示到桌面</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ───────────── 显示与交互 ───────────── -->
        <template v-else-if="section === 'display'">
          <div class="zt-card">
            <div class="zt-card-title">首页形态</div>
            <div class="zt-card-desc">桌面模式为找Tab 式全屏导航;经典列表为传统侧边栏 + 工具卡片</div>
            <div class="zt-chips">
              <button class="zt-chip" :class="{ on: desktop.mode === 'desktop' }" @click="desktop.setMode('desktop')">桌面模式</button>
              <button class="zt-chip" :class="{ on: desktop.mode === 'classic' }" @click="desktop.setMode('classic')">经典列表</button>
            </div>
            <div class="zt-divider" />
            <div class="zt-card-title">图标风格</div>
            <div class="zt-chips" style="margin-top: 10px">
              <button class="zt-chip" :class="{ on: desktop.iconStyle === 'rounded' }" @click="desktop.setIconStyle('rounded')">圆角图标</button>
              <button class="zt-chip" :class="{ on: desktop.iconStyle === 'square' }" @click="desktop.setIconStyle('square')">方角图标</button>
            </div>
            <div class="zt-divider" />
            <div class="zt-card-title">图标大小</div>
            <div class="zt-chips" style="margin-top: 10px">
              <button v-for="s in (['s','m','l'] as const)" :key="s" class="zt-chip" :class="{ on: desktop.iconSize === s }" @click="desktop.setIconSize(s)">
                {{ s === 's' ? '小' : s === 'm' ? '中' : '大' }}
              </button>
            </div>
          </div>

          <div class="zt-card">
            <div class="zt-card-title">外观与交互</div>
            <div class="zt-card-desc">所有开关即时生效并保存在本机</div>
            <div class="zt-row-between">
              <div><div class="zt-row-label">暗色主题</div><div class="zt-row-tip">影响经典列表与所有内页配色</div></div>
              <el-switch :model-value="appStore.dark" @update:model-value="appStore.toggleDark($event as boolean)" />
            </div>
            <div v-for="t in toggles" :key="t.key" class="zt-row-between">
              <div><div class="zt-row-label">{{ t.label }}</div><div class="zt-row-tip">{{ t.tip }}</div></div>
              <el-switch :model-value="boolOf(t.key)" @update:model-value="setBool(t.key, $event as boolean)" />
            </div>
          </div>

          <div class="zt-card">
            <div class="zt-card-title">Dock 快捷栏</div>
            <div class="zt-card-desc">屏幕底部的快捷栏,可固定常用应用;系统图标(首页 / 添加 / 商店 / 设置)始终保留</div>
            <div class="zt-inline" style="margin-bottom: 12px">
              <button class="zt-btn" @click="selectAllDock">全选</button>
              <button class="zt-btn" @click="clearDock">取消全选</button>
              <span class="zt-sub">已固定 {{ desktop.dock.length }} 个</span>
            </div>
            <div class="zt-chips">
              <button
                v-for="i in desktop.items"
                :key="i.key"
                class="zt-chip"
                :class="{ on: desktop.isDocked(i.key) }"
                @click="desktop.toggleDock(i.key)"
              >{{ i.name }}</button>
            </div>
          </div>
        </template>

        <!-- ───────────── 账户管理 ───────────── -->
        <template v-else-if="section === 'account'">
          <div class="zt-card">
            <div class="zt-card-title">账户管理</div>
            <div class="zt-card-desc">无需登录,打开即用</div>
            <div class="zt-row-between">
              <div><div class="zt-row-label">当前账户</div><div class="zt-row-tip">匿名使用 · 不收集任何个人信息</div></div>
              <span class="zt-badge kind">本地账户</span>
            </div>
            <div class="zt-row-between">
              <div><div class="zt-row-label">存储位置</div><div class="zt-row-tip">桌面布局、壁纸、自定义网站全部保存在本机浏览器</div></div>
              <div class="zt-inline">
                <button class="zt-chip on">仅本地</button>
                <button class="zt-chip" disabled title="本项目不提供云端服务">云端 + 本地</button>
              </div>
            </div>
            <div class="zt-row-between">
              <div><div class="zt-row-label">匿名使用统计</div><div class="zt-row-tip">本项目不采集任何统计数据</div></div>
              <span class="zt-badge kind">未启用</span>
            </div>
            <div class="zt-hint" style="margin-top: 12px">
              云端同步在本项目以「导出 JSON 备份 → 在另一台设备导入」的纯本地方式等价实现,配置不会离开你的设备。
            </div>
          </div>
        </template>

        <!-- ───────────── 数据管理 ───────────── -->
        <template v-else-if="section === 'data'">
          <div class="zt-card">
            <div class="zt-card-title">备份与恢复</div>
            <div class="zt-card-desc">导出完整配置(桌面图标 / 隐藏应用 / Dock / 壁纸 / 自定义网站 / 偏好)</div>
            <div class="zt-inline">
              <button class="zt-btn primary" @click="exportBackup">导出 JSON</button>
              <button class="zt-btn" @click="importInput?.click()">从备份恢复</button>
              <input ref="importInput" type="file" accept="application/json,.json" hidden @change="onImportBackup" />
            </div>
          </div>
          <div class="zt-card">
            <div class="zt-card-title">存储位置</div>
            <div class="zt-card-desc">{{ desktop.storageLocation }}</div>
            <div class="zt-row-between">
              <div><div class="zt-row-label">已占用空间</div><div class="zt-row-tip">localStorage 中以 utools_ 开头的全部数据</div></div>
              <span class="zt-badge kind">{{ formatSize(storageBytes) }}</span>
            </div>
            <div class="zt-divider" />
            <div class="zt-card-title">维护</div>
            <div class="zt-inline" style="margin-top: 10px">
              <button class="zt-btn danger" @click="resetLayout">重置桌面布局</button>
              <span class="zt-sub">壁纸与自定义网站会保留</span>
            </div>
          </div>
        </template>

        <!-- ───────────── 关于 ───────────── -->
        <template v-else>
          <div class="zt-card">
            <div class="zt-card-title">关于 uTools</div>
            <div class="zt-card-desc">本地优先的在线工具站与桌面式导航</div>
            <div class="zt-row-between">
              <div class="zt-row-label">版本</div><span class="zt-sub">1.0.0 · 桌面模式 v2</span>
            </div>
            <div class="zt-row-between">
              <div class="zt-row-label">应用总数</div><span class="zt-sub">{{ CATALOG.length }} 个(站内工具 + 桌面应用)</span>
            </div>
            <div class="zt-row-between">
              <div class="zt-row-label">商店分类</div><span class="zt-sub">{{ STORE_CATEGORIES.length - 1 }} 个</span>
            </div>
            <div class="zt-row-between">
              <div class="zt-row-label">技术栈</div><span class="zt-sub">Vue 3 · TypeScript · Vite · Pinia · Element Plus</span>
            </div>
            <div class="zt-divider" />
            <div class="zt-card-title">帮助与反馈</div>
            <div class="zt-card-desc">桌面式导航、应用商店与设置页的交互参考 找Tab;全部功能与数据均在本地浏览器运行</div>
            <div class="zt-inline">
              <a class="zt-link" href="https://github.com/chuheridangwu/uTools/issues" target="_blank" rel="noopener noreferrer">提交问题反馈 →</a>
              <span class="zt-sub">快捷键 Ctrl/⌘ + K 打开桌面搜索</span>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-layout { display: grid; grid-template-columns: 208px minmax(0, 1fr); gap: 20px; align-items: start; }
.settings-nav {
  position: sticky;
  top: 82px;
  background: var(--zt-card);
  border: 1px solid var(--zt-border);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--zt-shadow);
}
.nav-group { margin-bottom: 12px; }
.nav-group:last-child { margin-bottom: 0; }
.nav-label { font-size: 11px; font-weight: 700; color: var(--zt-sub); padding: 6px 10px; letter-spacing: 0.5px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--zt-text);
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.nav-item:hover { background: var(--zt-soft); }
.nav-item.on { background: var(--zt-brand); color: #fff; }
.nav-count { margin-left: auto; font-size: 10px; background: rgb(255 255 255 / 22%); border-radius: 8px; padding: 1px 6px; }
.settings-content { min-width: 0; }
@media (max-width: 760px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-nav { position: static; display: flex; flex-wrap: wrap; gap: 6px; }
  .nav-group { display: contents; }
  .nav-label { display: none; }
  .nav-item { width: auto; }
}
</style>
