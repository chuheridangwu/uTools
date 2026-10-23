<script setup lang="ts">
/**
 * 首页:品牌 Hero + 收藏 + 全部工具按分类网格展示
 * 卡片数据全部来自 tools.ts 注册表。
 */
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import { CATEGORIES, TOOLS } from '@/config/tools'
import type { ToolMeta, ToolCategoryKey } from '@/types/tool'
import { useAppStore } from '@/stores/app'
import ToolCard from '@/components/ToolCard.vue'
import { useRouter } from 'vue-router'
import { StarFilled } from '@element-plus/icons-vue'

const appStore = useAppStore()
const router = useRouter()

/** 当前选中的分类 tab;undefined 表示全部 */
const activeCat = ref<ToolCategoryKey | undefined>(undefined)

/** 收藏的工具(置顶展示) */
const favs = computed<ToolMeta[]>(() => appStore.favoriteTools)

/** 按当前 tab 过滤后的分组 */
const grouped = computed(() =>
  CATEGORIES.filter((c) => !activeCat.value || c.key === activeCat.value).map((c) => ({
    ...c,
    items: TOOLS.filter((t) => t.category === c.key),
  })),
)

function icon(name: string): Component | undefined {
  return (Icons as Record<string, Component>)[name]
}

/** 分类计数徽标 */
function countOf(key: ToolCategoryKey): number {
  return TOOLS.filter((t) => t.category === key).length
}
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero card">
      <h1 class="hero-title">⚡ uTools 在线工具箱</h1>
      <p class="hero-sub">
        聚合 {{ TOOLS.length }} 个开发 / 文本 / 图片 / 数据 / 效率工具,全部在浏览器本地完成,
        数据不上传服务器。按 <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">K</kbd> 快速搜索。
      </p>
      <div class="cat-tabs">
        <button class="cat-tab" :class="{ on: !activeCat }" @click="activeCat = undefined">
          全部 ({{ TOOLS.length }})
        </button>
        <button
          v-for="c in CATEGORIES"
          :key="c.key"
          class="cat-tab"
          :class="{ on: activeCat === c.key }"
          @click="activeCat = c.key"
        >
          <el-icon :size="13" class="tab-ic"><component :is="icon(c.icon)" /></el-icon>
          {{ c.label }} ({{ countOf(c.key) }})
        </button>
      </div>
    </section>

    <!-- 收藏 -->
    <section v-if="favs.length" class="sec">
      <h2 class="sec-title">
        <el-icon><StarFilled /></el-icon>
        我的收藏
      </h2>
      <div class="grid">
        <ToolCard v-for="t in favs" :key="t.key" :tool="t" />
      </div>
    </section>

    <!-- 分类网格 -->
    <section v-for="g in grouped" :key="g.key" class="sec">
      <h2 class="sec-title">
        <el-icon><component :is="icon(g.icon)" /></el-icon>
        {{ g.label }}
        <span class="sec-desc mtd">{{ g.desc }}</span>      </h2>
      <div class="grid">
        <ToolCard v-for="t in g.items" :key="t.key" :tool="t" />
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="home-foot muted">
      有想法/横向竞品欢迎阅读项目 README;纯前端实现,刷新即用。
      <span>
        <router-link to="/">回到顶部</router-link>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.home {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

/* Hero 区 */
.hero {
  padding: 28px;
  background:
    radial-gradient(circle at 90% 20%, rgba(99, 102, 241, 0.12), transparent 60%),
    var(--el-bg-color);
}
.hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}
.hero-sub {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin: 10px 0 18px;
  max-width: 640px;
  line-height: 1.8;
}
.kbd {
  padding: 2px 7px;
  border: 1px solid var(--card-border);
  background: var(--el-fill-color);
  border-radius: 5px;
  font-size: 12px;
}

/* 分类筛选 tabs */
.cat-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cat-tab {
  height: 30px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--card-border);
  background: var(--el-fill-color-lighter);
  border-radius: 15px;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.15s;
}
.cat-tab:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.cat-tab.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.tab-ic {
  margin-right: 3px;
}

/* 分组 */
.sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 14px;
  color: var(--el-text-color-primary);
}
.sec-desc {
  font-weight: 400;
  margin-left: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.home-foot {
  text-align: center;
  padding: 10px 0 20px;
}
</style>
