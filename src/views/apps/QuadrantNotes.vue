<script setup lang="ts">
/**
 * 四象限笔记
 * 艾森豪威尔矩阵:重要紧急 / 重要不紧急 / 紧急不重要 / 不重要不紧急,
 * 增删、标记完成、跨象限移动,数据存本机 localStorage。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type QKey = 'q1' | 'q2' | 'q3' | 'q4'

interface Item {
  id: number
  text: string
  done: boolean
  q: QKey
  createAt: number
}

const STORE = 'utools_quadrant-notes-v1'

interface QMeta {
  key: QKey
  title: string
  sub: string
  accent: string
}

const QUADS: QMeta[] = [
  { key: 'q1', title: '重要且紧急', sub: '立刻做', accent: '#ef4444' },
  { key: 'q2', title: '重要不紧急', sub: '安排时间做', accent: '#0ea5e9' },
  { key: 'q3', title: '紧急不重要', sub: '尽量授权', accent: '#f59e0b' },
  { key: 'q4', title: '不重要不紧急', sub: '别做太多', accent: '#6b7280' },
]

const Q_KEYS = QUADS.map((q) => q.key) as QKey[]

const items = ref<Item[]>([])
const drafts = ref<Record<QKey, string>>({ q1: '', q2: '', q3: '', q4: '' })
let uid = 1

function load() {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) {
      const arr = JSON.parse(raw) as Item[]
      items.value = Array.isArray(arr)
        ? arr.filter((x) => x && x.text && Q_KEYS.includes(x.q))
        : []
      uid = items.value.reduce((m, x) => Math.max(m, x.id), 0) + 1
    }
  } catch {
    items.value = []
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(items.value))
  } catch { /* 存储满等场景静默 */ }
}

onMounted(load)
watch(items, save, { deep: true })

function add(q: QKey) {
  const text = drafts.value[q].trim()
  if (!text) {
    ElMessage.warning('先写点内容再添加')
    return
  }
  items.value.push({ id: uid++, text, done: false, q, createAt: Date.now() })
  drafts.value[q] = ''
}

function byQ(q: QKey) {
  return items.value.filter((x) => x.q === q).sort((a, b) => a.createAt - b.createAt)
}

function move(it: Item, delta: -1 | 1) {
  const cur = Q_KEYS.indexOf(it.q)
  const next = Math.min(Q_KEYS.length - 1, Math.max(0, cur + delta))
  it.q = Q_KEYS[next]
}

function remove(it: Item) {
  items.value = items.value.filter((x) => x.id !== it.id)
}

function clearDone() {
  const n = items.value.filter((x) => x.done).length
  if (!n) return
  items.value = items.value.filter((x) => !x.done)
  ElMessage.success(`已清理 ${n} 条已完成`)
}

const stats = computed(() => {
  const total = items.value.length
  const done = items.value.filter((x) => x.done).length
  return { total, done, open: total - done }
})
</script>

<template>
  <div class="qn">
    <div class="head">
      <div>
        <h3 class="title">四象限笔记</h3>
        <p class="sub">按「重要 × 紧急」分类任务,已存本机,随时续写</p>
      </div>
      <div class="acts">
        <span class="stat">共 {{ stats.total }} · 待办 {{ stats.open }} · 完成 {{ stats.done }}</span>
        <el-button size="small" @click="clearDone">清理已完成</el-button>
      </div>
    </div>

    <div class="board">
      <div v-for="qd in QUADS" :key="qd.key" class="quad" :style="{ '--qc': qd.accent }">
        <div class="q-head">
          <span class="q-dot" />
          <span class="q-title">{{ qd.title }}</span>
          <span class="q-sub">{{ qd.sub }}</span>
          <span class="q-count">{{ byQ(qd.key).length }}</span>
        </div>
        <div class="q-list">
          <div v-if="!byQ(qd.key).length" class="q-empty">暂无,先写一条吧</div>
          <div v-for="it in byQ(qd.key)" :key="it.id" class="q-item" :class="{ done: it.done }">
            <button class="chk" :class="{ on: it.done }" @click="it.done = !it.done" />
            <span class="q-text">{{ it.text }}</span>
            <span class="ops">
              <el-icon class="op" title="移到上一个象限" @click="move(it, -1)"><ArrowLeft /></el-icon>
              <el-icon class="op" title="移到下一个象限" @click="move(it, 1)"><ArrowRight /></el-icon>
              <el-icon class="op op-del" title="删除" @click="remove(it)"><Delete /></el-icon>
            </span>
          </div>
        </div>
        <div class="q-add">
          <el-input
            v-model="drafts[qd.key]"
            size="small"
            maxlength="60"
            :placeholder="`添加到「${qd.title}」…`"
            @keydown.enter.exact.prevent="add(qd.key)"
          />
          <el-button size="small" type="primary" :icon="Plus" @click="add(qd.key)" />
        </div>
      </div>
    </div>

    <p class="foot"> ◀ / ▶ 可把条目在四个象限间互相移动;勾选圆点标记完成;数据保存在浏览器本机(localStorage)。</p>
  </div>
</template>

<style scoped>
.qn {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
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
.acts {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.board {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 720px) {
  .board {
    grid-template-columns: 1fr;
  }
}
.quad {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.q-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.q-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--qc);
  align-self: center;
}
.q-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--qc);
}
.q-sub {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  flex: 1;
}
.q-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.q-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 60px;
}
.q-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  padding: 6px 2px;
}
.q-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 13px;
}
.q-item.done .q-text {
  text-decoration: line-through;
  color: var(--el-text-color-placeholder);
}
.chk {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1.5px solid var(--el-border-color);
  background: transparent;
  padding: 0;
  cursor: pointer;
  flex: none;
}
.chk.on {
  border-color: var(--qc);
  background: var(--qc);
}
.q-text {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  line-height: 1.5;
}
.ops {
  display: flex;
  gap: 4px;
  flex: none;
  color: var(--el-text-color-placeholder);
}
.op {
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}
.op:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}
.op-del:hover {
  color: #ef4444;
}
.q-add {
  display: flex;
  gap: 8px;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
