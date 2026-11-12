<script setup lang="ts">
/**
 * 应用商店整页(P2,仿找Tab /store)
 * 最新上架 / 最受欢迎 / 全部应用 三个分区 + 分类计数 + 拼音搜索 + 添加/已添加。
 * 数据来源统一为 appCatalog.ts,不再分别遍历两套注册表。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Clock, Grid, List as ListIcon, Search } from '@element-plus/icons-vue'
import { useDesktopStore } from '@/stores/desktop'
import {
  CATALOG,
  STORE_CATEGORIES,
  catalogByCategory,
  categoryCounts,
  matchCatalog,
  normalizeSearch,
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
const view = computed(() => desktop.storeView)

const counts = computed(() => categoryCounts())
const byCat = computed(() => catalogByCategory(cat.value, CATALOG))
const matched = computed(() => searchCatalog(query.value, byCat.value))

const shown = computed<CatalogEntry[]>(() => {
  if (tab.value === 'new') return [...matched.value].sort((a, b) => b.releasedAt - a.releasedAt)
  if (tab.value === 'hot') return [...matched.value].sort((a, b) => b.popularity - a.popularity)
  return matched.value
})

/** 搜索态:按「最近打开 / 最匹配 / 相关结果」分组 */
const isSearching = computed(() => normalizeSearch(query.value) !== '')

interface EntryGroup {
  key: string
  title: string
  hint: string
  items: CatalogEntry[]
}

const groups = computed<EntryGroup[]>(() => {
  if (!isSearching.value) return [{ key: 'all', title: '', hint: '', items: shown.value }]
  const q = normalizeSearch(query.value)
  const recent: CatalogEntry[] = []
  const best: CatalogEntry[] = []
  const related: CatalogEntry[] = []
  const rset = new Set(desktop.recentItems.map((e) => e.key))
  for (const e of shown.value) {
    const nameHit = normalizeSearch(e.name + e.short).includes(q)
    if (rset.has(e.key)) recent.push(e)
    else if (nameHit) best.push(e)
    else related.push(e)
  }
  return [
    { key: 'recent', title: '最近打开', hint: '近期用过且命中的', items: recent.slice(0, 6) },
    { key: 'best', title: '最匹配', hint: '名称 / 简介命中', items: best },
    { key: 'related', title: '相关结果', hint: '描述 / 标签命中', items: related },
  ].filter((g) => g.items.length > 0)
})

/** 非搜索时,顶部展示最近打开 */
const recentStrip = computed(() => (isSearching.value ? [] : desktop.recentItems.slice(0, 8)))

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
  desktop.pushRecent(e.key)
  emit('open', e.key)
  // 对齐找Tab:应用以浮层窗口打开在商店之上,商店保持打开;
  // 关闭应用窗口后仍回到商店,而不是直接退回桌面首页。
}

function setView(v: 'grid' | 'list') {
  desktop.setStoreView(v)
}

/** 搜索框提示:命中类型数 */
const searchSummary = computed(() => {
  if (!isSearching.value) return ''
  void matchCatalog
  const total = groups.value.reduce((n, g) => n + g.items.length, 0)
  return `找到 ${total} 个结果 · ${groups.value.length} 组`
})

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
      <div class="zt-view-toggle">
        <button
          class="zt-view-btn"
          :class="{ on: view === 'grid' }"
          title="网格视图"
          @click="setView('grid')"
        ><el-icon :size="15"><Grid /></el-icon></button>
        <button
          class="zt-view-btn"
          :class="{ on: view === 'list' }"
          title="列表视图"
          @click="setView('list')"
        ><el-icon :size="15"><ListIcon /></el-icon></button>
      </div>
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
          <span class="zt-sub">{{ isSearching ? searchSummary : `当前显示 ${shown.length} 个应用` }}</span>
        </div>
      </div>

      <div v-if="recentStrip.length" class="zt-recent">
        <div class="zt-recent-title"><el-icon :size="14"><Clock /></el-icon>最近打开</div>
        <div class="zt-recent-row">
          <button
            v-for="e in recentStrip"
            :key="'r-' + e.key"
            class="zt-recent-chip"
            :title="e.short"
            @click="openNow(e)"
          >
            <AppIcon :name="e.name" :icon="e.icon" :accent="e.accent" :size="20" />
            <span>{{ e.name }}</span>
          </button>
        </div>
      </div>

      <div v-for="g in groups" :key="g.key" class="zt-group">
        <div v-if="g.title" class="zt-group-head">
          <span class="zt-group-title">{{ g.title }}</span>
          <span class="zt-group-hint">{{ g.hint }}</span>
          <span class="zt-chip-count">{{ g.items.length }}</span>
        </div>
        <div class="zt-grid" :class="{ 'as-list': view === 'list' }">
          <div v-for="e in g.items" :key="e.key" class="store-card">
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
      </div>
      <div v-if="!groups.length" class="zt-card zt-empty">没有找到匹配的应用,换个关键词或分类试试</div>
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

/* 视图切换 */
.zt-view-toggle {
  display: flex;
  gap: 2px;
  background: var(--zt-soft);
  border-radius: 10px;
  padding: 2px;
}
.zt-view-btn {
  border: none;
  background: transparent;
  color: var(--zt-sub);
  width: 30px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.zt-view-btn.on {
  background: var(--zt-card);
  color: var(--zt-brand);
  box-shadow: var(--zt-shadow);
}

/* 最近打开 */
.zt-recent {
  margin-bottom: 14px;
}
.zt-recent-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--zt-sub);
  margin-bottom: 8px;
}
.zt-recent-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.zt-recent-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--zt-border);
  background: var(--zt-card);
  border-radius: 999px;
  padding: 4px 12px 4px 5px;
  cursor: pointer;
  font-size: 12px;
  color: var(--zt-text);
  transition: border-color 0.15s, transform 0.15s;
}
.zt-recent-chip:hover {
  border-color: var(--zt-brand);
  transform: translateY(-1px);
}

/* 搜索分组 */
.zt-group {
  margin-bottom: 18px;
}
.zt-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.zt-group-title {
  font-size: 14px;
  font-weight: 700;
}
.zt-group-hint {
  font-size: 11px;
  color: var(--zt-sub);
}

/* 列表视图 */
.zt-grid.as-list {
  grid-template-columns: 1fr;
  gap: 8px;
}
.zt-grid.as-list .store-card {
  padding: 10px 14px;
  border-radius: 12px;
}
.zt-grid.as-list .store-tags {
  margin-top: 4px;
}
.zt-grid.as-list .store-acts {
  flex-direction: row;
  align-items: center;
}
</style>
