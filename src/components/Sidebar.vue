<script setup lang="ts">
/**
 * 左侧边栏
 * 内容:Logo → 收藏 → 按分类分组的全部工具。
 * 仅从 tools.ts 注册表渲染,自身不维护工具数据。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Component } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import type { ToolMeta } from '@/types/tool'
import { CATEGORIES, TOOLS } from '@/config/tools'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ collapsed: boolean }>()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

/** 按 key 查找 Element Plus 图标组件 */
function icon(name: string): Component | undefined {
  return (Icons as Record<string, Component>)[name]
}

/** 分类 → 工具列表 映射 */
const grouped = computed(() => {
  const groups: Record<string, ToolMeta[]> = {}
  for (const c of CATEGORIES) groups[c.key] = []
  TOOLS.forEach((t) => groups[t.category]?.push(t))
  return groups
})

function go(tool: ToolMeta) {
  router.push(tool.path)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- Logo 区 -->
    <div class="logo" @click="router.push('/')">
      <span class="logo-mark">U</span>
      <span v-if="!collapsed" class="logo-text">uTools</span>
    </div>

    <template v-if="!collapsed">
      <!-- 收藏区 -->
      <div v-if="appStore.favoriteTools.length" class="group">
        <div class="group-title">收藏</div>
        <div
          v-for="t in appStore.favoriteTools"
          :key="'fav-' + t.key"
          class="nav-item"
          :class="{ active: route.name === t.key }"
          @click="go(t)"
        >
          <el-icon :size="15"><component :is="icon(t.icon)" /></el-icon>
          <span class="nav-name">{{ t.name }}</span>
        </div>
      </div>

      <!-- 分类折叠导航 -->
      <el-scrollbar class="nav-scroll">
        <el-collapse class="nav-collapse">
          <el-collapse-item v-for="c in CATEGORIES" :key="c.key" :name="c.key">
            <template #title>
              <el-icon class="grp-icon"><component :is="icon(c.icon)" /></el-icon>
              <span class="grp-label">{{ c.label }}</span>
              <span class="grp-count">{{ grouped[c.key]?.length ?? 0 }}</span>
            </template>
            <div
              v-for="t in grouped[c.key]"
              :key="t.key"
              class="nav-item sub"
              :class="{ active: route.name === t.key }"
              @click="go(t)"
            >
              <span class="dot" :style="{ background: t.accent }" />
              <span class="nav-name">{{ t.name }}</span>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </template>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 230px;
  flex: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-right: 1px solid var(--card-border);
  transition: width 0.2s;
  overflow: hidden;
}
.sidebar.collapsed {
  width: 56px;
}

.logo {
  height: 52px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--card-border);
}
.logo-mark {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  background: var(--brand);
  color: #fff;
  border-radius: 7px;
  font-weight: 700;
  font-size: 15px;
}
.logo-text {
  font-weight: 700;
  font-size: 16px;
}

.group {
  flex: none;
  padding: 8px;
}
.group-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 8px;
  margin-bottom: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.nav-item:hover {
  background: var(--el-fill-color-light);
}
.nav-item.active {
  background: var(--brand);
  color: #fff;
}
.nav-item.active .dot {
  outline: 2px solid #fff6;
}
.nav-item.sub {
  margin-left: 4px;
  height: 28px;
}
.nav-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}

.nav-scroll {
  flex: 1;
  min-height: 0;
}
.group + .nav-scroll {
  padding-top: 0;
}

.nav-collapse {
  --el-collapse-header-height: 34px;
  border-top: none;
}
:deep(.el-collapse-item__header) {
  background: transparent;
  border-bottom: none;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
:deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: none;
}
.grp-icon {
  margin-right: 8px;
}
.grp-label {
  flex: 1;
}
.grp-count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* 收起态只显示 Logo 字母 */
.sidebar.collapsed .logo {
  padding: 0;
  justify-content: center;
}
</style>
