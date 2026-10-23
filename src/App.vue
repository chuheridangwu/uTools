<script setup lang="ts">
/**
 * App 根组件 —— 布局骨架
 * 结构:左侧边栏(可收起) + 顶部栏 + 主内容区 + 底部状态栏
 * 命令面板(Ctrl/⌘ + K)与路由切换的“最近使用”记录均在此统一挂载。
 */
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, Moon, Sunny, Search, HomeFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { TOOL_MAP, TOOLS } from '@/config/tools'

/** 工具总数(供状态栏展示) */
const TOOLS_COUNT = TOOLS.length

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

/** 当前路由对应的工具元信息(首页时为 undefined) */
const currentTool = computed(() => TOOL_MAP.get(String(route.name ?? '')))

/** 侧边栏收起状态(纯 UI,不持久化) */
const collapsed = ref(false)

/** 命令面板显隐 */
const paletteVisible = ref(false)

/** 全局快捷键:Ctrl/⌘ + K 打开命令面板 */
function onKeydown(e: KeyboardEvent) {
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

/** 每次路由解析完成后记录最近使用 */
router.afterEach((to) => {
  if (TOOL_MAP.has(String(to.name))) appStore.visitTool(String(to.name))
})
</script>

<template>
  <el-container class="app-shell">
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
</template>

<script lang="ts">
export default { name: 'AppShell' }
</script>

<style scoped>
.app-shell {
  height: 100%;
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
