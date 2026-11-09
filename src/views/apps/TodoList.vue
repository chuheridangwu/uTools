<script setup lang="ts">
/**
 * 待办清单
 * 轻量待办:添加 / 勾选 / 删除 / 清除已完成,支持筛选与本地持久化,
 * 无需登录,数据仅存本机浏览器。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, Plus, Top } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Task {
  id: string
  text: string
  done: boolean
  important: boolean
  ts: number
}

const KEY = 'utools_todo'
const tasks = reactive<{ list: Task[] }>({ list: [] })
const draft = ref('')
const filter = ref<'all' | 'active' | 'done'>('all')

const shown = computed(() => {
  const l = tasks.list
  if (filter.value === 'active') return l.filter((t) => !t.done)
  if (filter.value === 'done') return l.filter((t) => t.done)
  return l
})
const activeCount = computed(() => tasks.list.filter((t) => !t.done).length)
const doneCount = computed(() => tasks.list.filter((t) => t.done).length)

function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks.list))
}

function add() {
  const text = draft.value.trim()
  if (!text) return
  tasks.list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, done: false, important: false, ts: Date.now() })
  draft.value = ''
  save()
}

function toggle(t: Task) {
  t.done = !t.done
  save()
}

function mark(t: Task) {
  t.important = !t.important
  save()
}

function remove(id: string) {
  tasks.list = tasks.list.filter((t) => t.id !== id)
  save()
}

function clearDone() {
  if (!doneCount.value) {
    ElMessage.info('没有已完成的待办')
    return
  }
  tasks.list = tasks.list.filter((t) => !t.done)
  save()
}

onMounted(() => {
  try {
    tasks.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    tasks.list = []
  }
})

function fmt(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="todo">
    <div class="head">
      <div>
        <h3 class="title">待办清单</h3>
        <p class="sub">共 {{ tasks.list.length }} 项 · 待办 {{ activeCount }} · 已完成 {{ doneCount }}</p>
      </div>
      <el-button size="small" @click="clearDone">清除已完成</el-button>
    </div>

    <div class="add-row">
      <el-input v-model="draft" placeholder="添加一条待办,回车确认" @keydown.enter="add" />
      <el-button type="primary" :icon="Plus" @click="add">添加</el-button>
    </div>

    <div class="bar">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">待办</el-radio-button>
        <el-radio-button value="done">已完成</el-radio-button>
      </el-radio-group>
    </div>

    <div class="list">
      <div v-for="t in shown" :key="t.id" class="item" :class="{ done: t.done, important: t.important }">
        <el-checkbox :model-value="t.done" @change="toggle(t)" />
        <div class="text" @click="toggle(t)">{{ t.text }}</div>
        <span class="time">{{ fmt(t.ts) }}</span>
        <el-button text size="small" :icon="Top" :type="t.important ? 'warning' : ''" @click="mark(t)" />
        <el-button text size="small" type="danger" :icon="Delete" @click="remove(t.id)" />
      </div>
      <div v-if="!shown.length" class="empty">暂无待办,添加一条试试</div>
    </div>
  </div>
</template>

<style scoped>
.todo {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.add-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.bar {
  margin-bottom: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 12px;
  transition: opacity 0.2s;
}
.item.important {
  border-left: 3px solid #f59e0b;
}
.item.done {
  opacity: 0.55;
}
.item.done .text {
  text-decoration: line-through;
}
.text {
  flex: 1;
  font-size: 14px;
  cursor: pointer;
  word-break: break-all;
}
.time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  flex: none;
}
.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
