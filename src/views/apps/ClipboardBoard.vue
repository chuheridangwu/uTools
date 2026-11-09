<script setup lang="ts">
/**
 * 智能剪贴板
 * 粘贴保存常用文本,自动识别链接 / 代码 / 普通文本并分类,
 * 支持搜索、置顶、删除与一键复制;数据仅存本机(localStorage)。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, DocumentCopy, Lock, Promotion, Top } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

interface Entry {
  id: string
  text: string
  tag: '链接' | '代码' | '文本'
  pinned: boolean
  ts: number
}

const raw = ref('')
const search = ref('')
const filter = ref<'全部' | '链接' | '代码' | '文本'>('全部')

const entries = reactive<{ list: Entry[] }>({ list: [] })
const KEY = 'utools_clipboard'

function detectTag(text: string): Entry['tag'] {
  const t = text.trim()
  if (/^https?:\/\/\S+$/i.test(t)) return '链接'
  if (/^(function |const |let |var |class |import |def |<\?|#!|\{|\[)/.test(t) || /[;{}()]\s*$/m.test(t) && t.includes('\n')) return '代码'
  return '文本'
}

function load() {
  try {
    entries.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    entries.list = []
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(entries.list))
}

function add() {
  const text = raw.value.trim()
  if (!text) return
  if (entries.list.some((e) => e.text === text)) {
    ElMessage.info('这条已经在剪贴板里了')
    raw.value = ''
    return
  }
  entries.list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, tag: detectTag(text), pinned: false, ts: Date.now() })
  if (entries.list.length > 200) entries.list.length = 200
  save()
  raw.value = ''
  ElMessage.success('已保存')
}

function remove(id: string) {
  entries.list = entries.list.filter((e) => e.id !== id)
  save()
}

function pin(e: Entry) {
  e.pinned = !e.pinned
  save()
}

async function copyOne(e: Entry) {
  await copyText(e.text)
  ElMessage.success('已复制')
}

const shown = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return entries.list
    .filter((e) => filter.value === '全部' || e.tag === filter.value)
    .filter((e) => !kw || e.text.toLowerCase().includes(kw))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts)
})

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(load)
</script>

<template>
  <div class="cb">
    <div class="input-row">
      <el-input
        v-model="raw"
        type="textarea"
        :rows="2"
        placeholder="粘贴文本后点「保存」,自动识别链接/代码分类(仅存本机)"
      />
      <el-button type="primary" :icon="Promotion" class="add-btn" @click="add">保存</el-button>
    </div>

    <div class="bar">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="全部">全部 {{ entries.list.length }}</el-radio-button>
        <el-radio-button value="链接">链接</el-radio-button>
        <el-radio-button value="代码">代码</el-radio-button>
        <el-radio-button value="文本">文本</el-radio-button>
      </el-radio-group>
      <el-input v-model="search" size="small" class="search" placeholder="搜索" clearable />
    </div>

    <div class="list">
      <div v-for="e in shown" :key="e.id" class="item" :class="[e.tag === '代码' ? 'is-code' : '', e.tag === '链接' ? 'is-link' : '']">
        <div class="item-head">
          <span class="tag">{{ e.tag }}</span>
          <span class="time">{{ fmtTime(e.ts) }}</span>
          <span class="acts">
            <el-button text size="small" :icon="Top" :type="e.pinned ? 'primary' : ''" @click="pin(e)" />
            <el-button text size="small" :icon="DocumentCopy" @click="copyOne(e)" />
            <el-button text size="small" :icon="Delete" @click="remove(e.id)" />
          </span>
        </div>
        <div class="item-body" :title="e.text">{{ e.text }}</div>
      </div>
      <div v-if="!shown.length" class="empty">
        <el-icon :size="26"><Lock /></el-icon>
        <p>还没有内容,粘贴一段文本试试</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.add-btn {
  flex: none;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.search {
  width: 180px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow: auto;
}
.item {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
}
.item.is-code {
  border-left: 3px solid #f59e0b;
}
.item.is-link {
  border-left: 3px solid #0ea5e9;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.acts {
  margin-left: auto;
}
.item-body {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
