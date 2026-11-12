<script setup lang="ts">
/**
 * App 根组件 —— 布局骨架
 * 结构:左侧边栏(可收起) + 顶部栏 + 主内容区 + 底部状态栏
 * 命令面板(Ctrl/⌘ + K)在此统一挂载。
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, Moon, Sunny, Search, HomeFilled, Monitor, ArrowLeft } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAppStore } from '@/stores/app'
import { useDesktopStore } from '@/stores/desktop'
import { TOOL_MAP, TOOLS } from '@/config/tools'
import DesktopHome from '@/components/desktop/DesktopHome.vue'

/** 工具总数(供状态栏展示) */
const TOOLS_COUNT = TOOLS.length

const appStore = useAppStore()
const desktop = useDesktopStore()
const route = useRoute()
const router = useRouter()

/** 当前路由对应的工具元信息(首页时为 undefined) */
const currentTool = computed(() => TOOL_MAP.get(String(route.name ?? '')))

/**
 * 桌面模式下的「整页二级页」:路由命中真实路径(/json-viewer、/app/svg-editor 等)
 * 时以独立页面渲染(对齐找Tab 的 /json-format),脱离桌面视图;浏览器返回即回原页面。
 */
const isDesktopPage = computed(() =>
  desktop.mode === 'desktop' && route.name !== 'home' && route.matched.length > 0,
)

/** 返回按钮:有历史来路就 history.back(能回到商店等来源页),直达深链接则回桌面 */
function goBack() {
  const st = window.history.state as { back?: string } | null
  if (st?.back) router.back()
  else router.push('/')
}

/** 侧边栏收起状态(纯 UI,不持久化) */
const collapsed = ref(false)

/** 命令面板显隐 */
const paletteVisible = ref(false)

/** 全局快捷键:Ctrl/⌘ + K 打开命令面板 */
function onKeydown(e: KeyboardEvent) {
  // 桌面模式下 Ctrl/⌘+K 由 DesktopHome 接管(聚焦桌面搜索框)
  if (desktop.mode === 'desktop') return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteVisible.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 首次进入时与用户偏好同步 <html>.dark 类名(Element Plus 暗色变量依赖)
  document.documentElement.classList.toggle('dark', appStore.dark)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- 语言包:按需引入后不再 app.use(ElementPlus),由 ConfigProvider 提供中文 -->
  <el-config-provider :locale="zhCn">
    <!-- 桌面模式:整页二级页(独立路径,对齐找Tab /json-format) -->
    <div v-if="isDesktopPage" class="dt-page">
      <button class="dt-back" title="返回" @click="goBack">
        <el-icon :size="18"><ArrowLeft /></el-icon>
      </button>
      <router-view />
    </div>

    <!-- 桌面模式:全屏桌面导航(找Tab 式) -->
    <DesktopHome v-else-if="desktop.mode === 'desktop'" />

    <!-- 经典模式:侧边栏 + 卡片 -->
    <el-container v-else class="app-shell">
    <!-- 左侧导航 -->
    <Sidebar :collapsed="collapsed" />

    <el-container direction="vertical" class="app-main-wrap">
      <!-- 顶部栏 -->
      <header class="app-header">
        <el-tooltip content="切换侧边栏 (F10)" placement="bottom">
          <el-button text circle @click="collapsed = !collapsed">
            <el-icon :size="17"><Menu /></el-icon>
          </el-button>
        </el-tooltip>

        <!-- 面包屑 -->
        <el-breadcrumb separator="/" class="crumb">
          <el-breadcrumb-item :to="{ path: '/' }">uTools</el-breadcrumb-item>
          <el-breadcrumb-item v-if="currentTool">
            <span class="crm-cat">{{ currentTool.name }}</span>
          </el-breadcrumb-item>
        </el-breadcrumb>

        <div class="spacing" />

        <!-- 搜索(只读输入框,点击唤起命令面板) -->
        <div class="search-fake" @click="paletteVisible = true">
          <el-icon><Search /></el-icon>
          <span>搜索工具...</span>
          <kbd class="kbd">Ctrl K</kbd>
        </div>

        <!-- 首页 -->
        <el-tooltip content="首页" placement="bottom">
          <el-button text circle @click="router.push('/')">
            <el-icon :size="17"><HomeFilled /></el-icon>
          </el-button>
        </el-tooltip>

        <!-- 明暗切换 -->
        <el-tooltip content="明暗主题" placement="bottom">
          <el-button text circle @click="appStore.toggleDark()">
            <el-icon :size="17"><Moon v-if="!appStore.dark" /><Sunny v-else /></el-icon>
          </el-button>
        </el-tooltip>

        <!-- 桌面模式 -->
        <el-tooltip content="切换到桌面模式" placement="bottom">
          <el-button text circle @click="desktop.setMode('desktop')">
            <el-icon :size="17"><Monitor /></el-icon>
          </el-button>
        </el-tooltip>
      </header>

      <!-- 主内容 -->
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 底部状态栏 -->
      <footer class="app-footer">
        <span>uTools 在线工具站 · {{  TOOLS_COUNT }} 个工具</span>
        <span class="muted">快捷键:Ctrl/⌘ + K</span>
      </footer>
    </el-container>

    <!-- 命令面板 -->
    <CommandPalette v-model="paletteVisible" />
  </el-container>
  </el-config-provider>
</template>

<script lang="ts">
export default { name: 'AppShell' }
</script>

<style scoped>
.app-shell {
  height: 100%;
}

/* 桌面模式整页二级页:吃满视口滚动,左上角浮动返回(样式对齐商店页 zt-back) */
.dt-page {
  height: 100%;
  overflow-y: auto;
  background: var(--el-bg-color-page, #f5f7fa);
}
.dt-back {
  position: fixed;
  top: 14px;
  left: 16px;
  z-index: 100;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}
.dt-back:hover {
  color: var(--brand, #409eff);
}
html.dark .dt-page {
  background: var(--el-bg-color-page);
}

.app-main-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}

.app-header {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--card-border);
  flex: none;
}

.crm-cat {
  color: var(--el-text-color-primary);
}

/* 假搜索框:纯样式触发命令面板 */
.search-fake {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  cursor: pointer;
  background: var(--el-fill-color-light);
  transition: border-color 0.2s;
}
.search-fake:hover {
  border-color: var(--brand);
}
.kbd {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  font-size: 11px;
  background: var(--el-fill-color);
}

.app-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.app-footer {
  height: 30px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid var(--card-border);
  background: var(--el-bg-color);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
