<script setup lang="ts">
/**
 * 命令面板(Ctrl/⌘ + K 弹出)
 * 输入关键词即时过滤全部工具,name/short/keywords 匹配;回车跳到第一个结果。
 */
import { computed, ref, watch, nextTick } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { TOOLS, CATEGORIES, searchTools } from '@/config/tools'
import type { ToolMeta } from '@/types/tool'

const visible = defineModel<boolean>({ required: true })
const router = useRouter()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

/** 过滤结果:空查询展示全部 */
const results = computed<ToolMeta[]>(() => (query.value ? searchTools(query.value) : TOOLS))

/** 结果按分类分组展示(保持注册顺序) */
const grouped = computed(() => CATEGORIES.map((c) => ({ ...c, items: results.value.filter((t) => t.category === c.key) })).filter((g) => g.items.length > 0))

/** 打开时清空搜索并聚焦输入框 */
watch(
  visible,
  async (v) => {
    if (v) {
      query.value = ''
      await nextTick()
      ;(document.querySelector('.palette.el-dialog input') as HTMLInputElement | null)?.focus()
    }
  },
  { immediate: true },
)

function icon(name: string): Component | undefined {
  return (Icons as Record<string, Component>)[name]
}

function go(tool: ToolMeta) {
  router.push(tool.path)
  visible.value = false
}

function onEnter() {
  const first = results.value[0]
  if (first) go(first)
}
</script>

<template>
  <el-dialog v-model="visible" :show-close="false" class="palette" width="560px" title=" " align-center>
    <div class="palette-body">
      <div class="palette-input">
        <el-icon><Search /></el-icon>
        <input
          ref="inputRef"
          v-model="query"
          class="palette-input-raw"
          placeholder="搜索工具,回车跳到第一项..."
          @keydown.enter="onEnter"
        />
      </div>

      <div class="palette-list">
        <template v-if="grouped.length">
          <div v-for="g in grouped" :key="g.key" class="pal-group">
            <div class="pal-title">{{ g.label }}</div>
            <div v-for="t in g.items" :key="t.key" class="pal-item" @click="go(t)">
              <el-icon class="pal-icon"><component :is="icon(t.icon)" /></el-icon>
              <span class="pal-name">{{ t.name }}</span>
              <span class="pal-short">{{ t.short }}</span>
            </div>
          </div>
        </template>
        <div v-else class="pal-empty">没有匹配的工具,试试「json」「图片」?</div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.palette-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.palette-input {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  flex: none;
}
.palette-input-raw {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.palette-list {
  max-height: 380px;
  overflow-y: auto;
}
.pal-group {
  margin-bottom: 10px;
}
.pal-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 6px;
}
.pal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.pal-item:hover {
  background: var(--el-fill-color-light);
}
.pal-icon {
  color: var(--brand);
}
.pal-name {
  font-size: 13.5px;
  flex: none;
}
.pal-short {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pal-empty {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 30px 0;
}
</style>

<style>
/* 去掉命令面板 dialog 默认头部与 PADDING */
.el-dialog.palette {
  --el-dialog-padding-primary: 0;
  border-radius: 12px;
  padding: 14px 16px;
  min-height: 0;
  overflow-y: hidden;
}
.el-dialog.palette .el-dialog__header {
  padding: 0;
  margin: 0;
  height: 0;
  display: none;
}
.el-dialog.palette .el-dialog__body {
  padding: 10px;
}
</style>
