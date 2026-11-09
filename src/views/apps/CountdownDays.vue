<script setup lang="ts">
/**
 * 纪念日倒计时
 * 记录生日、纪念日、考试等日期,自动计算「距今还有多少天 / 已过去多少天」,
 * 支持置顶与删除,数据仅存本机。生日类可显示周岁。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, Plus, Top } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface EventItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  /** 每年重复(生日/纪念日) */
  yearly: boolean
  pinned: boolean
}

const KEY = 'utools_countdown'
const events = reactive<{ list: EventItem[] }>({ list: [] })
const form = reactive({ title: '', date: new Date().toISOString().slice(0, 10), yearly: false })

const today = new Date()
today.setHours(0, 0, 0, 0)

interface Computed {
  ev: EventItem
  /** 目标日期(今年或明年) */
  target: Date
  /** >0 未来还有几天;0 就是今天;<0 已过去几天 */
  days: number
  age?: number
}

const items = computed<Computed[]>(() => {
  const list = events.list.map((ev) => {
    const [y, m, d] = ev.date.split('-').map(Number)
    let target = new Date(y, m - 1, d)
    let age: number | undefined
    if (ev.yearly) {
      const thisYear = new Date(today.getFullYear(), m - 1, d)
      target = thisYear.getTime() >= today.getTime() ? thisYear : new Date(today.getFullYear() + 1, m - 1, d)
      age = today.getFullYear() - y
    }
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
    return { ev, target, days: diff, age: ev.yearly ? age : undefined }
  })
  return list.sort((a, b) => {
    if (a.ev.pinned !== b.ev.pinned) return a.ev.pinned ? -1 : 1
    return Math.abs(a.days) - Math.abs(b.days)
  })
})

function save() {
  localStorage.setItem(KEY, JSON.stringify(events.list))
}

function add() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入名称')
    return
  }
  events.list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title: form.title.trim(),
    date: form.date,
    yearly: form.yearly,
    pinned: false,
  })
  form.title = ''
  save()
  ElMessage.success('已添加')
}

function remove(id: string) {
  events.list = events.list.filter((e) => e.id !== id)
  save()
}

function pin(ev: EventItem) {
  ev.pinned = !ev.pinned
  save()
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayText(c: Computed): string {
  if (c.days === 0) return '就是今天 🎉'
  if (c.days > 0) return `还有 ${c.days} 天`
  return `已过去 ${-c.days} 天`
}

onMounted(() => {
  try {
    events.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    events.list = []
  }
})
</script>

<template>
  <div class="cd">
    <div class="head">
      <div>
        <h3 class="title">纪念日倒计时</h3>
        <p class="sub">生日、纪念日、考试…… 一目了然还有多少天</p>
      </div>
    </div>

    <div class="add">
      <el-input v-model="form.title" placeholder="名称,如「结婚纪念日」" style="flex: 1; min-width: 140px" @keydown.enter="add" />
      <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
      <el-checkbox v-model="form.yearly">每年重复</el-checkbox>
      <el-button type="primary" :icon="Plus" @click="add">添加</el-button>
    </div>

    <div class="list">
      <div v-for="c in items" :key="c.ev.id" class="card" :class="{ today: c.days === 0 }">
        <el-button class="pin" text size="small" :icon="Top" :type="c.ev.pinned ? 'warning' : ''" @click="pin(c.ev)" />
        <div class="c-meta">
          <div class="c-title">
            {{ c.ev.title }}
            <span v-if="c.ev.yearly" class="tag">每年</span>
          </div>
          <div class="c-date">
            {{ fmtDate(c.target) }}
            <span v-if="c.age !== undefined && c.age > 0"> · 第 {{ c.age }} 年</span>
          </div>
        </div>
        <div class="c-days" :class="{ past: c.days < 0 }">{{ dayText(c) }}</div>
        <el-button text size="small" type="danger" :icon="Delete" @click="remove(c.ev.id)" />
      </div>
      <div v-if="!items.length" class="empty">
        还没有纪念日,添加一个开始倒计时吧
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd {
  padding: 4px 2px;
}
.head {
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
.add {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 14px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
  border-left: 4px solid #0ea5e9;
}
.card.today {
  border-left-color: #ef4444;
  background: color-mix(in srgb, #ef4444 6%, var(--el-bg-color));
}
.pin {
  flex: none;
}
.c-meta {
  flex: 1;
  min-width: 0;
}
.c-title {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag {
  font-size: 10px;
  font-weight: 400;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.c-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 3px;
}
.c-days {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #0ea5e9;
  flex: none;
}
.c-days.past {
  color: var(--el-text-color-secondary);
}
.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
