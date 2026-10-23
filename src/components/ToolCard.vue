<script setup lang="ts">
/**
 * 工具卡片:首页网格中的单个工具入口。
 * 来自 [M narrate]: hover 变高亮,右上角收藏星标可切换(不阻止卡片跳转)
 */
import type { Component } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import type { ToolMeta } from '@/types/tool'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { computed } from 'vue'

const props = defineProps<{ tool: ToolMeta }>()
const router = useRouter()
const appStore = useAppStore()

/** 该工具是否已收藏 */
const isFav = computed(() => appStore.isFavorite(props.tool.key))

function icon(name: string): Component | undefined {
  return (Icons as Record<string, Component>)[name]
}
</script>

<template>
  <div class="tool-card" @click="router.push(tool.path)">
    <span class="stripe" :style="{ background: tool.accent }" />
    <div class="ic" :style="{ background: tool.accent }">
      <el-icon :size="20"><component :is="icon(tool.icon)" /></el-icon>
    </div>
    <div class="body">
      <div class="head">
        <span class="name">{{ tool.name }}</span>
        <span v-if="tool.isNew" class="badge">新</span>
      </div>
      <p class="short">{{ tool.short }}</p>
    </div>

    <!-- 收藏切换:stop.prevent 防止触发卡片跳转 -->
    <button
      class="fav"
      :class="{ on: isFav }"
      title="收藏"
      @click.stop.prevent="appStore.toggleFavorite(tool.key)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.tool-card {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  padding-left: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  height: 100%;
  user-select: none;
}
.tool-card:hover {
  transform: translateY(-3px);
  border-color: var(--brand);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.12);
}
.stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  transition: width 0.2s;
}
.tool-card:hover .stripe {
  width: 6px;
}
.ic {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  background: radial-gradient(circle at 30% 30%, var(--tool-accent, var(--brand)), var(--brand));
}
.body {
  flex: 1;
  min-width: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name {
  font-size: 14px;
  font-weight: 600;
}
.badge {
  font-size: 10px;
  color: #fff;
  background: var(--brand);
  border-radius: 4px;
  padding: 1px 5px;
}
.short {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 两行截断 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.fav {
  position: absolute;
  right: 8px;
  top: 8px;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--el-border-color);
  cursor: pointer;
  transition: color 0.15s;
}
.fav:hover {
  color: #fbbf24;
}
.fav.on {
  color: #fbbf24;
}
</style>
