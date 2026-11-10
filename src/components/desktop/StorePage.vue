<script setup lang="ts">
/**
 * 应用商店整页(P2,仿找Tab /store)
 * 最新上架 / 最受欢迎 / 全部应用 三个分区 + 分类计数 + 拼音搜索 + 添加/已添加。
 * 数据来源统一为 appCatalog.ts,不再分别遍历两套注册表。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { useDesktopStore } from '@/stores/desktop'
import {
  CATALOG,
  STORE_CATEGORIES,
  catalogByCategory,
  categoryCounts,
  searchCatalog,
  type CatalogEntry,
} from '@/config/appCatalog'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{
  close: []
  'add-app': []
  open: [key: string]
}>()

const desktop = useDesktopStore()
const query = ref('')
const tab = ref<'new' | 'hot' | 'all'>('all')
const cat = ref('all')

const counts = computed(() => categoryCounts())
const byCat = computed(() => catalogByCategory(cat.value, CATALOG))
const matched = computed(() => searchCatalog(query.value, byCat.value))

const shown = computed<CatalogEntry[]>(() => {
  if (tab.value === 'new') return [...matched.value].sort((a, b) => b.releasedAt - a.releasedAt)
  if (tab.value === 'hot') return [...matched.value].sort((a, b) => b.popularity - a.popularity)
  return matched.value
})

const tabList = computed(() => [
  { key: 'new' as const, label: '最新上架', count: byCat.value.filter((e) => e.releasedAt > 0).length },
  { key: 'hot' as const, label: '最受欢迎', count: byCat.value.filter((e) => e.popularity > 0).length },
  { key: 'all' as const, label: '全部应用', count: byCat.value.length },
])

const addedCount = computed(() => desktop.items.filter((i) => i.kind !== 'site').length)

function isAdded(key: string): boolean { return desktop.isOnDesktop(key) }

function toggle(e: CatalogEntry) {
  if (isAdded(e.key)) {
    desktop.hide(e.key)
    ElMessage.success('已从桌面移除,可在「设置 → 隐藏的应用」恢复')
  } else {
    desktop.add(e.key)
    ElMessage.success(`已添加「${e.name}」到桌面`)
  }
}

function openNow(e: CatalogEntry) {
  if (!isAdded(e.key)) desktop.add(e.key)
  emit('open', e.key)
  emit('close')
}

function badgeOf(e: CatalogEntry): { text: string; cls: string } | null {
  if (e.isNew) return { text: '新', cls: 'new' }
  if (e.isHot) return { text: '最热', cls: 'hot' }
  return null
}
</script>

<template>
  <div class="zt-page">
    <header class="zt-head">
      <button class="zt-back" title="返回桌面" @click="emit('close')">
        <el-icon :size="18"><ArrowLeft /></el-icon>
      </button>
      <div>
        <h1 class="zt-h1">应用商店</h1>
        <div class="zt-sub">共 {{ CATALOG.length }} 个应用 · 桌面已添加 {{ addedCount }} 个 · 无需登录,打开即用</div>
      </div>
      <div class="zt-head-spacer" />
      <div class="zt-search">
        <el-icon :size="16"><Search /></el-icon>
        <input v-model="query" placeholder="搜索工具或应用,支持拼音(如 ewm、chakanqi)" />
      </div>
    </header>

    <div class="zt-page-inner">
      <div class="zt-card">
        <div class="zt-tabs">
          <button
            v-for="t in tabList"
            :key="t.key"
            class="zt-tab"
            :class="{ on: tab === t.key }"
            @click="tab = t.key"
          >
            {{ t.label }} <span class="zt-chip-count">{{ t.count }}</span>
          </button>
        </div>
        <div class="zt-chips">
          <button
            v-for="c in STORE_CATEGORIES"
            :key="c.key"
            class="zt-chip"
            :class="{ on: cat === c.key }"
            @click="cat = c.key"
          >
            {{ c.label }} <span class="zt-chip-count">{{ counts[c.key] ?? 0 }}</span>
          </button>
        </div>
        <div class="zt-inline">
          <span class="zt-sub">找不到想要的?</span>
          <button class="zt-link" @click="emit('add-app')">手动添加任意网站 →</button>
          <span class="zt-head-spacer" />
          <span class="zt-sub">当前显示 {{ shown.length }} 个应用</span>
        </div>
      </div>

      <div v-if="shown.length" class="zt-grid">
        <div v-for="e in shown" :key="e.key" class="store-card">
          <AppIcon :name="e.name" :icon="e.icon" :accent="e.accent" :size="52" />
          <div class="store-meta">
            <div class="store-name">
              {{ e.name }}
              <span v-if="badgeOf(e)" class="zt-badge" :class="badgeOf(e)?.cls">{{ badgeOf(e)?.text }}</span>
              <span v-if="e.needsLogin" class="zt-badge login">需联网</span>
            </div>
            <div class="store-short">{{ e.short }}</div>
            <div class="store-tags">
              <span class="zt-badge kind">{{ e.categoryLabel }}</span>
              <span v-for="t in e.tags.slice(0, 2)" :key="t" class="tag">{{ t }}</span>
            </div>
          </div>
          <div class="store-acts">
            <button class="zt-btn" :class="isAdded(e.key) ? 'added' : 'primary'" @click="toggle(e)">
              {{ isAdded(e.key) ? '已添加' : '添加' }}
            </button>
            <button class="zt-link" @click="openNow(e)">打开</button>
          </div>
        </div>
      </div>
      <div v-else class="zt-card zt-empty">没有找到匹配的应用,换个关键词或分类试试</div>
    </div>
  </div>
</template>

<style scoped>
.store-card {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  background: var(--zt-card);
  border: 1px solid var(--zt-border);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--zt-shadow);
  transition: transform 0.16s, border-color 0.16s;
}
.store-card:hover { transform: translateY(-2px); border-color: var(--zt-brand); }
.store-meta { flex: 1; min-width: 0; }
.store-name { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.store-short { font-size: 12px; color: var(--zt-sub); margin-top: 5px; line-height: 1.5; }
.store-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.tag { font-size: 10px; color: var(--zt-sub); background: var(--zt-soft); border-radius: 6px; padding: 1px 6px; }
.store-acts { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
</style>
