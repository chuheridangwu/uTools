<script setup lang="ts">
/**
 * 日期计算器
 * 计算两个日期之间相差的天数 / 周数 / 月数(含工作日),并支持在指定日期上
 * 加上或减去若干天(周 / 月 / 年),给出结果日期与星期。纯本地计算。
 */
import { computed, reactive, ref } from 'vue'
import { Calendar, Switch } from '@element-plus/icons-vue'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const tab = ref<'diff' | 'add'>('diff')

/* --------------------------- 日期间隔 --------------------------- */
const diff = reactive({ a: '2026-01-01', b: today(), workOnly: false })

function parse(s: string): Date {
  return new Date(s + 'T00:00:00')
}

const diffDays = computed(() => {
  const a = parse(diff.a)
  const b = parse(diff.b)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
})

const diffWorkdays = computed(() => {
  const a = parse(diff.a)
  const b = parse(diff.b)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  const from = a < b ? a : b
  const to = a < b ? b : a
  let count = 0
  const d = new Date(from)
  while (d < to) {
    d.setDate(d.getDate() + 1)
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) count++
  }
  return a < b ? count : -count
})

const diffStats = computed(() => {
  const days = diffDays.value
  const abs = Math.abs(days)
  return [
    { l: '相差天数', v: days.toLocaleString() + ' 天' },
    { l: '相差周数', v: (days / 7).toFixed(2) + ' 周' },
    { l: '按整月折算', v: (days / 30.4375).toFixed(2) + ' 月' },
    { l: '按整年折算', v: (days / 365.25).toFixed(2) + ' 年' },
    { l: '工作日', v: diffWorkdays.value.toLocaleString() + ' 天' },
    { l: '总天数(绝对值)', v: abs.toLocaleString() + ' 天' },
  ]
})

/* --------------------------- 日期偏移 --------------------------- */
const add = reactive({
  base: today(),
  unit: 'day' as 'day' | 'week' | 'month' | 'year',
  amount: 100,
})

const addResult = computed(() => {
  const d = parse(add.base)
  if (isNaN(d.getTime())) return null
  const n = Number(add.amount) || 0
  if (add.unit === 'day') d.setDate(d.getDate() + n)
  else if (add.unit === 'week') d.setDate(d.getDate() + n * 7)
  else if (add.unit === 'month') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return d
})

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const addText = computed(() => {
  const d = addResult.value
  if (!d) return '—'
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEKDAYS[d.getDay()]}`
})

function swap() {
  const t = diff.a
  diff.a = diff.b
  diff.b = t
}
</script>

<template>
  <div class="dc">
    <div class="head">
      <div>
        <h3 class="title">日期计算器</h3>
        <p class="sub">计算日期间隔,或在某日期上加减天数</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="diff">日期间隔</el-radio-button>
        <el-radio-button value="add">日期偏移</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 间隔 -->
    <template v-if="tab === 'diff'">
      <div class="row">
        <span class="label">开始日期</span>
        <el-date-picker v-model="diff.a" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        <el-button circle :icon="Switch" @click="swap" />
        <span class="label">结束日期</span>
        <el-date-picker v-model="diff.b" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
      </div>

      <div class="big">
        <div class="big-num">{{ Math.abs(diffDays).toLocaleString() }}</div>
        <div class="big-unit">天</div>
      </div>
      <div class="big-hint">
        {{ diffDays >= 0 ? '结束日期在开始日期之后' : '结束日期在开始日期之前' }}
      </div>

      <div class="stats">
        <div v-for="s in diffStats" :key="s.l" class="st">
          <div class="st-l">{{ s.l }}</div>
          <div class="st-v">{{ s.v }}</div>
        </div>
      </div>
    </template>

    <!-- 偏移 -->
    <template v-else>
      <div class="row">
        <span class="label">基准日期</span>
        <el-date-picker v-model="add.base" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
      </div>
      <div class="row">
        <span class="label">加上 / 减去</span>
        <el-input-number v-model="add.amount" :min="-10000" :max="10000" />
        <el-select v-model="add.unit" style="width: 110px">
          <el-option value="day" label="天" />
          <el-option value="week" label="周" />
          <el-option value="month" label="月" />
          <el-option value="year" label="年" />
        </el-select>
      </div>

      <div class="result">
        <el-icon :size="22"><Calendar /></el-icon>
        <span class="res-text">{{ addText }}</span>
      </div>
      <p class="res-hint">提示:负数即为向前推算,例如输入 -30 天表示往前 30 天。</p>
    </template>

    <p class="foot">工作日按周一至周五计算,不含法定节假日调休安排。</p>
  </div>
</template>

<style scoped>
.dc {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
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
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.big {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
}
.big-num {
  font-size: 58px;
  font-weight: 700;
  color: #6366f1;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.big-unit {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}
.big-hint {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 20px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 640px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
.st {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: center;
}
.st-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.st-v {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 12px;
  background: color-mix(in srgb, #6366f1 10%, transparent);
  color: #6366f1;
}
.res-text {
  font-size: 20px;
  font-weight: 700;
}
.res-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.foot {
  margin-top: 18px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
