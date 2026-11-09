<script setup lang="ts">
/**
 * 贷款计算器
 * 支持商业贷款常用的两种还款方式:等额本息与等额本金,
 * 计算每月月供、总利息与总还款额,并展示逐月还款明细(前 12 期)。
 */
import { computed, reactive } from 'vue'

const f = reactive({
  amount: 100, // 万元
  years: 30,
  rate: 3.1, // 年利率 %
  type: 'equal' as 'equal' | 'principal',
})

const principal = computed(() => f.amount * 10000)
const months = computed(() => Math.round(f.years * 12))
const monthRate = computed(() => f.rate / 100 / 12)

/** 等额本息:每月还款额 */
const equalMonthly = computed(() => {
  const p = principal.value
  const r = monthRate.value
  const n = months.value
  if (!p || !n) return 0
  if (r === 0) return p / n
  return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
})

/** 等额本金:首月还款额 */
const principalFirst = computed(() => {
  const p = principal.value
  const n = months.value
  if (!n) return 0
  return p / n + p * monthRate.value
})

const totalPayment = computed(() => {
  if (f.type === 'equal') return equalMonthly.value * months.value
  // 等额本金总还款 = 本金 + 利息(等差)
  const p = principal.value
  const r = monthRate.value
  const n = months.value
  const interest = ((n + 1) / 2) * (p * r)
  return p + interest
})

const totalInterest = computed(() => totalPayment.value - principal.value)

/** 还款明细(前 12 期) */
interface Period {
  idx: number
  pay: number
  principal: number
  interest: number
  remain: number
}

const schedule = computed<Period[]>(() => {
  const p = principal.value
  const r = monthRate.value
  const n = months.value
  const list: Period[] = []
  if (!p || !n) return list
  if (f.type === 'equal') {
    const pay = equalMonthly.value
    let remain = p
    for (let i = 1; i <= n; i++) {
      const interest = remain * r
      const prin = pay - interest
      remain = Math.max(0, remain - prin)
      list.push({ idx: i, pay, principal: prin, interest, remain })
    }
  } else {
    const prin = p / n
    let remain = p
    for (let i = 1; i <= n; i++) {
      const interest = remain * r
      list.push({ idx: i, pay: prin + interest, principal: prin, interest, remain: remain - prin })
      remain -= prin
    }
  }
  return list
})

const showSchedule = computed(() => schedule.value.slice(0, 12))

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const summary = computed(() => {
  if (f.type === 'equal') {
    return [
      { l: '每月月供', v: fmt(equalMonthly.value), hl: true },
      { l: '贷款总额', v: fmt(principal.value) },
      { l: '支付利息', v: fmt(totalInterest.value) },
      { l: '本息合计', v: fmt(totalPayment.value) },
    ]
  }
  return [
    { l: '首月月供', v: fmt(principalFirst.value), hl: true },
    { l: '每月递减', v: fmt((principal.value / months.value) * monthRate.value) },
    { l: '支付利息', v: fmt(totalInterest.value) },
    { l: '本息合计', v: fmt(totalPayment.value) },
  ]
})
</script>

<template>
  <div class="lc">
    <div class="head">
      <div>
        <h3 class="title">贷款计算器</h3>
        <p class="sub">等额本息 / 等额本金,计算月供与利息(常见于房贷、车贷)</p>
      </div>
    </div>

    <div class="cols">
      <div class="panel">
        <div class="row">
          <span class="label">还款方式</span>
          <el-radio-group v-model="f.type" size="small">
            <el-radio-button value="equal">等额本息</el-radio-button>
            <el-radio-button value="principal">等额本金</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <span class="label">贷款金额</span>
          <el-input-number v-model="f.amount" :min="1" :max="10000" :step="10" />
          <span class="unit">万元</span>
        </div>
        <div class="row">
          <span class="label">贷款年限</span>
          <el-input-number v-model="f.years" :min="1" :max="40" />
          <span class="unit">年 ({{ months }} 期)</span>
        </div>
        <div class="row">
          <span class="label">年利率</span>
          <el-input-number v-model="f.rate" :min="0.1" :max="24" :step="0.1" :precision="2" />
          <span class="unit">%</span>
        </div>
      </div>

      <div class="panel result">
        <div class="sum">
          <div v-for="s in summary" :key="s.l" class="sum-item" :class="{ hl: s.hl }">
            <div class="sum-l">{{ s.l }}</div>
            <div class="sum-v">{{ s.v }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="schedule">
      <div class="sch-title">还款明细(前 12 期)</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>期数</th>
              <th>月供</th>
              <th>本金</th>
              <th>利息</th>
              <th>剩余本金</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in showSchedule" :key="p.idx">
              <td>{{ p.idx }}</td>
              <td>{{ fmt(p.pay) }}</td>
              <td>{{ fmt(p.principal) }}</td>
              <td>{{ fmt(p.interest) }}</td>
              <td>{{ fmt(p.remain) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="foot">计算为理论估算,未考虑 LPR 浮动、提前还款、保险费等;实际以银行放款合同为准。</p>
  </div>
</template>

<style scoped>
.lc {
  padding: 4px 2px;
}
.head {
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
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
@media (max-width: 820px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.panel {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.label {
  width: 76px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: none;
}
.unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.result {
  justify-content: center;
}
.sum {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sum-item {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.sum-item.hl {
  grid-column: 1 / -1;
  background: linear-gradient(120deg, #6366f1, #8b5cf6);
  border: none;
  color: #fff;
}
.sum-l {
  font-size: 12px;
  opacity: 0.85;
}
.sum-v {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sum-item.hl .sum-v {
  font-size: 30px;
}
.schedule {
  margin-top: 6px;
}
.sch-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  text-align: right;
  padding: 8px 12px;
  white-space: nowrap;
}
th:first-child,
td:first-child {
  text-align: center;
}
thead th {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  border-bottom: 1px solid var(--card-border);
}
tbody tr:nth-child(even) {
  background: var(--el-fill-color-light);
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
