<script setup lang="ts">
/**
 * 摸鱼日历
 * 展示今天的日期与星期,计算距离本周周末、下一个法定节假日还有多久,
 * 并提供「工作日计算器」:给定起始日推算 N 个工作日后的日期。
 * 节假日为公开参考日期,可能与实际放假安排存在差异。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { Calendar, Clock, Suitcase } from '@element-plus/icons-vue'

/* ------------------------------ 节假日(参考) ------------------------------ */
interface Holiday {
  name: string
  date: string // YYYY-MM-DD
  days: number
}

const HOLIDAYS: Holiday[] = [
  { name: '元旦', date: '2026-01-01', days: 1 },
  { name: '春节', date: '2026-02-17', days: 7 },
  { name: '清明节', date: '2026-04-05', days: 1 },
  { name: '劳动节', date: '2026-05-01', days: 3 },
  { name: '端午节', date: '2026-06-19', days: 1 },
  { name: '中秋节', date: '2026-09-25', days: 1 },
  { name: '国庆节', date: '2026-10-01', days: 7 },
  { name: '元旦', date: '2027-01-01', days: 1 },
]

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const now = ref(new Date())
const today0 = computed(() => {
  const d = new Date(now.value)
  d.setHours(0, 0, 0, 0)
  return d
})

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

const isWeekend = computed(() => {
  const d = today0.value.getDay()
  return d === 0 || d === 6
})

const isFriday = computed(() => today0.value.getDay() === 5)

/** 距离本周六 00:00 还有几天 */
const toWeekend = computed(() => {
  const d = today0.value.getDay()
  const daysToSat = (6 - d + 7) % 7
  return daysToSat === 0 && !isWeekend.value ? 0 : daysToSat
})

const weekendText = computed(() => {
  if (isWeekend.value) return '周末快乐!今天已放假 🎉'
  if (isFriday.value) return '明天就是周末啦 🎊'
  const d = toWeekend.value
  return `距离周末还有 ${d} 天`
})

/** 下一个节假日(含未来第一个) */
const nextHoliday = computed(() => {
  const t = today0.value
  for (const h of HOLIDAYS) {
    const hd = new Date(h.date + 'T00:00:00')
    if (hd.getTime() >= t.getTime()) {
      return { ...h, diff: daysBetween(t, hd), dateObj: hd }
    }
  }
  return null
})

const holidayText = computed(() => {
  const h = nextHoliday.value
  if (!h) return '暂无后续节假日数据'
  if (h.diff === 0) return `今天是${h.name},好好休息 🎉`
  return `距离${h.name}还有 ${h.diff} 天`
})

const progressOfWeek = computed(() => {
  const d = today0.value
  // 周一 0% → 周五结束 100%
  const day = (d.getDay() + 6) % 7 // 周一=0
  const pct = Math.min(100, Math.max(0, ((day + 1) / 5) * 100))
  return Math.round(pct)
})

const nowClock = computed(() => {
  const d = now.value
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})

/** ------------------------------ 工作日计算器 ------------------------------ */
const calc = reactive({
  start: new Date().toISOString().slice(0, 10),
  n: 5,
})

function isHolidayDay(d: Date): boolean {
  return HOLIDAYS.some((h) => {
    const hd = new Date(h.date + 'T00:00:00')
    const diff = daysBetween(hd, d)
    return diff >= 0 && diff < h.days
  })
}

function isWorkday(d: Date): boolean {
  const wd = d.getDay()
  if (wd === 0 || wd === 6) return false
  return !isHolidayDay(d)
}

const calcResult = computed(() => {
  const start = new Date(calc.start + 'T00:00:00')
  if (isNaN(start.getTime())) return null
  let d = new Date(start)
  const n = Math.floor(Number(calc.n) || 0)
  let count = 0
  let guard = 0
  while (count < Math.abs(n) && guard < 3660) {
    d = new Date(d)
    d.setDate(d.getDate() + (n >= 0 ? 1 : -1))
    if (isWorkday(d)) count++
    guard++
  }
  return {
    date: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`,
    weekday: WEEKDAYS[d.getDay()],
    skipped: guard - Math.abs(n),
  }
})

let timer: number | undefined
timer = window.setInterval(() => {
  now.value = new Date()
}, 1000)

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

const todayStr = computed(() => {
  const d = now.value
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
})
</script>

<template>
  <div class="wc">
    <div class="head">
      <div>
        <h3 class="title">摸鱼日历</h3>
        <p class="sub">看看离周末和假期还有多远,顺便算算工作日</p>
      </div>
      <div class="clock"><el-icon><Clock /></el-icon>{{ nowClock }}</div>
    </div>

    <div class="hero" :class="{ rest: isWeekend }">
      <div class="hero-left">
        <div class="hero-date">{{ todayStr }}</div>
        <div class="hero-wd">{{ WEEKDAYS[now.getDay()] }}</div>
        <div class="hero-tag">{{ isWeekend ? '今天放假' : '今天上班' }}</div>
      </div>
      <div class="hero-right">
        <el-icon :size="46"><Suitcase v-if="!isWeekend" /><Calendar v-else /></el-icon>
      </div>
    </div>

    <div v-if="!isWeekend" class="week-progress">
      <div class="wp-label">
        <span>本周进度</span><span>{{ progressOfWeek }}%</span>
      </div>
      <el-progress :percentage="progressOfWeek" :show-text="false" :stroke-width="10" />
    </div>

    <div class="cards">
      <div class="card">
        <div class="c-l"><el-icon><Calendar /></el-icon> 距周末</div>
        <div class="c-v" :class="{ good: toWeekend <= 1 || isWeekend }">{{ weekendText }}</div>
      </div>
      <div class="card">
        <div class="c-l"><el-icon><Suitcase /></el-icon> 下个假期</div>
        <div class="c-v" :class="{ good: (nextHoliday?.diff ?? 99) <= 3 }">{{ holidayText }}</div>
        <div v-if="nextHoliday" class="c-sub">
          {{ nextHoliday.date }} ・ 放假 {{ nextHoliday.days }} 天
        </div>
      </div>
    </div>

    <div class="holidays">
      <div class="h-title">节假日一览</div>
      <div class="h-list">
        <div v-for="h in HOLIDAYS" :key="h.name" class="h-item" :class="{ near: nextHoliday?.name === h.name }">
          <span class="h-name">{{ h.name }}</span>
          <span class="h-date">{{ h.date.slice(5).replace('-', '/') }}</span>
          <span class="h-days">{{ h.days }} 天</span>
        </div>
      </div>
    </div>

    <div class="calc">
      <div class="calc-title">工作日计算器</div>
      <div class="calc-row">
        <span class="cr-l">起始日期</span>
        <el-date-picker v-model="calc.start" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        <span class="cr-l">之后第</span>
        <el-input-number v-model="calc.n" :min="-60" :max="60" />
        <span class="cr-l">个工作日</span>
        <span class="cr-l">是在</span>
        <template v-if="calcResult">
          <span class="cr-res">{{ calcResult.date }} {{ calcResult.weekday }}</span>
        </template>
        <span v-else class="cr-res">—</span>
      </div>
    </div>

    <p class="foot">提示:周末按周六周日计算,并排除上方列出的法定节假日;节假日日期为参考值,实际以官方放假安排为准。</p>
  </div>
</template>

<style scoped>
.wc {
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
.clock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 24px;
  border-radius: 16px;
  background: linear-gradient(120deg, #6366f1, #8b5cf6);
  color: #fff;
  margin-bottom: 16px;
}
.hero.rest {
  background: linear-gradient(120deg, #16a34a, #22c55e);
}
.hero-date {
  font-size: 22px;
  font-weight: 700;
}
.hero-wd {
  font-size: 14px;
  opacity: 0.92;
  margin-top: 4px;
}
.hero-tag {
  display: inline-block;
  margin-top: 10px;
  font-size: 12px;
  padding: 2px 12px;
  border-radius: 12px;
  background: rgb(255 255 255 / 22%);
}
.week-progress {
  margin-bottom: 16px;
}
.wp-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 640px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.c-l {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.c-v {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
}
.c-v.good {
  color: #16a34a;
}
.c-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.holidays {
  margin-top: 18px;
}
.h-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.h-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.h-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
}
.h-item.near {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.h-name {
  font-weight: 600;
}
.h-date {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.h-days {
  margin-left: auto;
  font-size: 11px;
  color: #f59e0b;
}
.calc {
  margin-top: 18px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.calc-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}
.calc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cr-l {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.cr-res {
  font-size: 15px;
  font-weight: 700;
  color: #6366f1;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
