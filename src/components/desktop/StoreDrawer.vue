<script setup lang="ts">
/**
 * 应用商店抽屉(模仿找Tab 应用商店):
 * 分类浏览站内工具与桌面应用,添加到桌面 / 从桌面移除。
 */
import { computed, ref } from 'vue'
import { Check, CirclePlus, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useDesktopStore } from '@/stores/desktop'
import { CATEGORIES, TOOLS } from '@/config/tools'
import { DESKTOP_APPS } from '@/config/desktopApps'

const visible = defineModel<boolean>({ required: true })
const desktop = useDesktopStore()
const emit = defineEmits<{ open: [key: string] }>()

type Kind = 'all' | 'tool' | 'app'
const kind = ref<Kind>('all')
const cat = ref<string>('all')

interface Row {
  key: string
  name: string
  short: string
  desc: string
  icon: string
  accent: string
  category: string
  kind: 'tool' | 'app'
}

const rows = computed<Row[]>(() => {
  const tools: Row[] = TOOLS.map((t) => ({
    key: t.key,
    name: t.name,
    short: t.short,
    desc: t.desc,
    icon: t.icon,
    accent: t.accent,
    category: t.category,
    kind: 'tool',
  }))
  const apps: Row[] = DESKTOP_APPS.map((a) => ({
    key: a.key,
    name: a.name,
    short: a.short,
    desc: a.desc,
    icon: a.icon,
    accent: a.accent,
    category: a.category,
    kind: 'app',
  }))
  return [...apps, ...tools]
    .filter((r) => kind.value === 'all' || r.kind === kind.value)
    .filter((r) => cat.value === 'all' || r.category === cat.value)
})

const CAT_LABELS = CATEGORIES.map((c) => ({ key: c.key, label: c.label }))

function added(key: string): boolean {
  return desktop.isOnDesktop(key)
}

function toggle(key: string) {
  if (added(key)) {
    desktop.remove(key)
    ElMessage.success('已从桌面移除')
  } else {
    desktop.addTool(key)
    ElMessage.success('已添加到桌面')
  }
}

function openNow(key: string) {
  if (!added(key)) desktop.addTool(key)
  visible.value = false
  emit('open', key)
}
</script>

<template>
  <el-drawer v-model="visible" title="应用商店" size="460px" class="store-drawer">
    <div class="kind-row">
      <el-radio-group v-model="kind" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="app">桌面应用</el-radio-button>
        <el-radio-button value="tool">站内工具</el-radio-button>
      </el-radio-group>
    </div>
    <div class="cat-row">
      <button class="cat" :class="{ on: cat === 'all' }" @click="cat = 'all'">全部</button>
      <button
        v-for="c in CAT_LABELS"
        :key="c.key"
        class="cat"
        :class="{ on: cat === c.key }"
        @click="cat = c.key"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="list">
      <div v-for="r in rows" :key="r.key" class="row">
        <span class="row-icon" :style="{ background: r.accent + '22', color: r.accent }">
          {{ r.name.slice(0, 1) }}
        </span>
        <div class="row-meta">
          <div class="row-name">{{ r.name }} <span class="row-kind">{{ r.kind === 'app' ? '应用' : '工具' }}</span></div>
          <div class="row-desc">{{ r.desc }}</div>
        </div>
        <div class="row-acts">
          <el-button
            size="small"
            :type="added(r.key) ? 'success' : 'primary'"
            :icon="added(r.key) ? Check : CirclePlus"
            @click="toggle(r.key)"
          >
            {{ added(r.key) ? '已添加' : '添加' }}
          </el-button>
          <el-button v-if="added(r.key)" size="small" text :icon="Delete" @click="toggle(r.key)" />
        </div>
        <el-button
          class="row-open"
          size="small"
          text
          type="primary"
          @click="openNow(r.key)"
        >
          打开
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.kind-row {
  margin-bottom: 10px;
}
.cat-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.cat {
  border: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}
.cat.on {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
}
.row-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-weight: 700;
  flex: none;
}
.row-meta {
  flex: 1;
  min-width: 0;
}
.row-name {
  font-size: 14px;
  font-weight: 600;
}
.row-kind {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border-radius: 8px;
  padding: 1px 6px;
  margin-left: 4px;
}
.row-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.row-acts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.row-open {
  position: absolute;
  margin-top: 46px;
}
.row {
  position: relative;
}
</style>
