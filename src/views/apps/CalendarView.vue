<script setup lang="ts">
/**
 * 日历
 * 月历视图,可切换月份,点击日期查看星期与「距今天数」,
 * 并在对应日期上标记今天。纯本地计算。
 */
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const today = new Date()
today.setHours(0, 0, 0, 0)

const view = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selected = ref<Date>(today)

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface Day {
  date: Date
  day: number
  inMonth: boolean
  isToday: boolean
  selected: boolean
  weekend: boolean
}

const days = computed<Day[]>(() => {
  const year = view.value.getFullYear()
  const month = view.value.getMonth()
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const start = new Date(year, month, 1 - startWeekday)
  const out: Day[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push({
      date: d,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: d.getTime() === today.getTime(),
      selected: d.getTime() === selected.value.getTime(),
      weekend: d.getDay() === 0 || d.getDay() === 6,
    })
  }
  return out
})

const header = computed(() => `${view.value.getFullYear()} 年 ${view.value.getMonth() + 1} 月`)

function shift(delta: number) {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + delta, 1)
}

function goToday() {
  view.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selected.value = today
}

function pick(d: Day) {
  selected.value = d.date
}

const diffFromToday = computed(() => {
  const d = Math.round((selected.value.getTime() - today.getTime()) / 86400000)
  if (d === 0) return '就是今天'
  if (d > 0) return `距今天还有 ${d} 天`
  return `距今天已过去 ${-d} 天`
})

const selWeekday = computed(() => '星期' + WEEKDAYS[selected.value.getDay()])

const weekOfYear = computed(() => {
  const start = new Date(selected.value.getFullYear(), 0, 1)
  const days = Math.floor((selected.value.getTime() - start.getTime()) / 86400000)
  return Math.ceil((days + start.getDay() + 1) / 7)
})

function isLunarNewYearish(): boolean {
  const m = selected.value.getMonth() + 1
  const d = selected.value.getDate()
  return m === 1 && d === 1
}
</script>

<template>
  <div class="cal">
    <div class="head">
      <div>
        <h3 class="title">日历</h3>
        <p class="sub">月历视图,点击日期查看详情</p>
      </div>
      <div class="nav">
        <el-button size="small" :icon="ArrowLeft" @click="shift(-1)" />
        <span class="month-label">{{ header }}</span>
        <el-button size="small" :icon="ArrowRight" @click="shift(1)" />
        <el-button size="small" @click="goToday">今天</el-button>
      </div>
    </div>

    <div class="week-head">
      <div v-for="(w, i) in WEEKDAYS" :key="w" class="wh" :class="{ we: i === 0 || i === 6 }">周{{ w }}</div>
    </div>

    <div class="grid">
      <button
        v-for="(d, i) in days"
        :key="i"
        class="cell"
        :class="{ out: !d.inMonth, today: d.isToday, sel: d.selected, we: d.weekend && d.inMonth }"
        @click="pick(d)"
      >
        <span class="d-num">{{ d.day }}</span>
        <span v-if="d.isToday" class="d-tag">今天</span>
      </button>
    </div>

    <div class="detail">
      <div class="dt-date">
        {{ selected.getFullYear() }} 年 {{ selected.getMonth() + 1 }} 月 {{ selected.getDate() }} 日
      </div>
      <div class="dt-meta">
        <span class="dt-chip">{{ selWeekday }}</span>
        <span class="dt-chip">第 {{ weekOfYear }} 周</span>
        <span class="dt-chip">{{ diffFromToday }}</span>
        <span v-if="isLunarNewYearish()" class="dt-chip highlight">元旦</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
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
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.month-label {
  font-size: 15px;
  font-weight: 600;
  min-width: 110px;
  text-align: center;
}
.week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
}
.wh {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 0;
}
.wh.we {
  color: #ef4444;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cell {
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-bg-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.12s;
  color: var(--el-text-color-primary);
}
.cell:hover {
  border-color: var(--el-color-primary);
}
.cell.out {
  opacity: 0.32;
}
.cell.we {
  color: #ef4444;
}
.cell.today {
  border-color: #14b8a6;
}
.cell.sel {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.d-num {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.d-tag {
  font-size: 9px;
  color: #14b8a6;
}
.cell.sel .d-tag {
  color: #fff;
}
.detail {
  margin-top: 18px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.dt-date {
  font-size: 16px;
  font-weight: 700;
}
.dt-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.dt-chip {
  font-size: 12px;
  padding: 3px 12px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}
.dt-chip.highlight {
  background: color-mix(in srgb, #ef4444 16%, transparent);
  color: #ef4444;
}
</style>
