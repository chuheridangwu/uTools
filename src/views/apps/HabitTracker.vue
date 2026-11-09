<script setup lang="ts">
/**
 * 习惯打卡
 * 记录每日习惯打卡,展示最近 7 天的完成情况与连续打卡天数;
 * 支持自定义习惯名称与颜色,数据保存在本机浏览器。
 */
import { computed, reactive, ref } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Habit {
  id: string
  name: string
  color: string
  /** 已打卡日期集合:YYYY-MM-DD */
  done: string[]
}

const KEY = 'utools_habits_v1'
const COLORS = ['#6366f1', '#16a34a', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const form = reactive({ name: '', color: COLORS[0] })

const habits = ref<Habit[]>(load())

function load(): Habit[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return [
    { id: 'h1', name: '喝够 8 杯水', color: '#0ea5e9', done: [] },
    { id: 'h2', name: '运动 30 分钟', color: '#16a34a', done: [] },
    { id: 'h3', name: '读书 20 页', color: '#8b5cf6', done: [] },
  ]
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(habits.value))
}

function addHabit() {
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning('请输入习惯名称')
    return
  }
  habits.value.push({ id: 'h' + Date.now(), name, color: form.color, done: [] })
  form.name = ''
  save()
}

function removeHabit(id: string) {
  habits.value = habits.value.filter((h) => h.id !== id)
  save()
}

function toggle(habit: Habit, date: string) {
  const idx = habit.done.indexOf(date)
  if (idx >= 0) habit.done.splice(idx, 1)
  else habit.done.push(date)
  save()
}

/** 最近 7 天(从今天往前) */
const weekDays = computed(() => {
  const out: { date: string; label: string; isToday: boolean }[] = []
  const names = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push({
      date: d.toISOString().slice(0, 10),
      label: '周' + names[d.getDay()],
      isToday: i === 0,
    })
  }
  return out
})

const today = todayStr()

/** 计算某个习惯的连续打卡天数(从今天或昨天开始往回算) */
function streak(habit: Habit): number {
  const set = new Set(habit.done)
  let count = 0
  const d = new Date()
  // 如果今天没打卡,从昨天开始算
  if (!set.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() - 1)
  }
  while (set.has(d.toISOString().slice(0, 10))) {
    count++
    d.setDate(d.getDate() - 1)
  }
  return count
}

function totalDone(habit: Habit): number {
  return habit.done.length
}

const overallToday = computed(() => {
  const total = habits.value.length
  const done = habits.value.filter((h) => h.done.includes(today)).length
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
})
</script>

<template>
  <div class="hb">
    <div class="head">
      <div>
        <h3 class="title">习惯打卡</h3>
        <p class="sub">记录每个小习惯,坚持就是胜利;数据保存在本机</p>
      </div>
    </div>

    <div class="today-bar">
      <span class="tb-text">今日完成 {{ overallToday.done }} / {{ overallToday.total }}</span>
      <el-progress :percentage="overallToday.pct" :stroke-width="10" style="flex: 1" />
    </div>

    <div class="add-row">
      <el-input v-model="form.name" placeholder="添加新习惯,如「早睡」" @keydown.enter="addHabit" style="flex: 1" />
      <div class="swatches">
        <button
          v-for="c in COLORS"
          :key="c"
          class="sw"
          :class="{ on: form.color === c }"
          :style="{ background: c }"
          @click="form.color = c"
        />
      </div>
      <el-button type="primary" :icon="Plus" @click="addHabit">添加</el-button>
    </div>

    <div v-if="!habits.length" class="empty">还没有习惯,先添加一个吧</div>

    <div v-else class="list">
      <div class="list-head">
        <span class="lh-name">习惯</span>
        <div class="lh-week">
          <span v-for="d in weekDays" :key="d.date" class="lh-day" :class="{ today: d.isToday }">{{ d.label }}</span>
        </div>
        <span class="lh-stat">连续 / 累计</span>
        <span class="lh-del" />
      </div>

      <div v-for="h in habits" :key="h.id" class="habit">
        <span class="h-name" :style="{ color: h.color }">{{ h.name }}</span>
        <div class="week">
          <button
            v-for="d in weekDays"
            :key="d.date"
            class="dot"
            :class="{ on: h.done.includes(d.date), today: d.isToday }"
            :style="h.done.includes(d.date) ? { background: h.color, borderColor: h.color } : {}"
            :title="d.date"
            @click="toggle(h, d.date)"
          >
            <span v-if="h.done.includes(d.date)">✓</span>
          </button>
        </div>
        <span class="h-stat">
          <b :style="{ color: h.color }">{{ streak(h) }}</b> 天 / {{ totalDone(h) }} 次
        </span>
        <el-button class="del" text :icon="Delete" @click="removeHabit(h.id)" />
      </div>
    </div>

    <p class="foot">连续天数:若今天尚未打卡,则从昨天起计算连续天数;点击圆点即可切换当天打卡状态。</p>
  </div>
</template>

<style scoped>
.hb {
  padding: 4px 2px;
}
.head {
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
.today-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.tb-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: none;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.swatches {
  display: flex;
  gap: 6px;
}
.sw {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.sw.on {
  border-color: var(--el-text-color-primary);
  transform: scale(1.15);
}
.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.list-head {
  display: grid;
  grid-template-columns: 1fr 320px 110px 40px;
  align-items: center;
  gap: 8px;
  padding: 0 12px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--card-border);
}
.lh-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}
.lh-day.today {
  color: #6366f1;
  font-weight: 600;
}
.lh-stat {
  text-align: right;
}
.habit {
  display: grid;
  grid-template-columns: 1fr 320px 110px 40px;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--el-fill-color-light);
}
@media (max-width: 720px) {
  .list-head,
  .habit {
    grid-template-columns: 1fr 1fr;
  }
  .lh-week,
  .week {
    grid-column: 1 / -1;
    order: 3;
  }
  .lh-stat,
  .h-stat {
    text-align: right;
  }
}
.h-name {
  font-size: 14px;
  font-weight: 600;
}
.week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.dot {
  width: 30px;
  height: 30px;
  margin: 0 auto;
  border-radius: 50%;
  border: 1.5px solid var(--card-border);
  background: var(--el-bg-color);
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  transition: transform 0.12s, background 0.12s;
}
.dot:hover {
  transform: scale(1.12);
}
.dot.today {
  box-shadow: 0 0 0 2px color-mix(in srgb, #6366f1 30%, transparent);
}
.h-stat {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
}
.h-stat b {
  font-size: 15px;
}
.del {
  justify-self: end;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
