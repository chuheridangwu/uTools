<script setup lang="ts">
/**
 * AA 分账
 * 输入总金额、人数与可选的服务费/折扣,自动计算每人应付;
 * 支持按份数分摊与自定义每人份额,并计算最小找零的收款方案。
 */
import { computed, reactive } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Member {
  id: string
  name: string
  shares: number
}

const f = reactive({
  total: 300,
  tipPct: 0,
  discountPct: 0,
})

const members = reactive<Member[]>([
  { id: 'm1', name: '我', shares: 1 },
  { id: 'm2', name: '朋友 A', shares: 1 },
  { id: 'm3', name: '朋友 B', shares: 1 },
])

function addMember() {
  members.push({ id: 'm' + Date.now(), name: '成员 ' + (members.length + 1), shares: 1 })
}

function removeMember(id: string) {
  const i = members.findIndex((m) => m.id === id)
  if (i >= 0) members.splice(i, 1)
}

const totalShares = computed(() => members.reduce((s, m) => s + (Number(m.shares) || 0), 0))

const finalTotal = computed(() => {
  const t = Number(f.total) || 0
  const afterTip = t * (1 + (Number(f.tipPct) || 0) / 100)
  return afterTip * (1 - (Number(f.discountPct) || 0) / 100)
})

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Row {
  name: string
  shares: number
  exact: number
  pay: number
  change: number
}

const rows = computed<Row[]>(() => {
  const total = finalTotal.value
  const ts = totalShares.value
  if (ts <= 0) return []
  // 精确分摊
  const raw = members.map((m) => (total * (Number(m.shares) || 0)) / ts)
  // 四舍五入到分,并调整尾差
  const rounded = raw.map((r) => Math.round(r * 100) / 100)
  const diff = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 100) / 100
  if (diff !== 0 && rounded.length) rounded[0] = Math.round((rounded[0] + diff) * 100) / 100

  return members.map((m, i) => {
    const exact = raw[i]
    const pay = rounded[i]
    // 最小整数收款(向上取整到角)
    const change = Math.ceil(pay * 10) / 10 - pay
    return { name: m.name, shares: Number(m.shares) || 0, exact, pay, change }
  })
})

const collectEven = computed(() => rows.value.map((r) => Math.ceil(r.pay * 10) / 10))
const evenTotal = computed(() => collectEven.value.reduce((a, b) => a + b, 0))
const changeTotal = computed(() => collectEven.value.reduce((a, b, i) => a + (b - rows.value[i].pay), 0))

function addPerson() {
  addMember()
}

function reset() {
  f.total = 300
  f.tipPct = 0
  f.discountPct = 0
  members.splice(0, members.length,
    { id: 'm1', name: '我', shares: 1 },
    { id: 'm2', name: '朋友 A', shares: 1 },
    { id: 'm3', name: '朋友 B', shares: 1 },
  )
}

function copyPlan() {
  if (!rows.value.length) return
  const lines = rows.value.map((r, i) => `${r.name}:应收 ￥${fmt(r.pay)}(凑整 ￥${fmt(collectEven.value[i])})`)
  const text = `总额 ￥${fmt(finalTotal.value)}\n` + lines.join('\n')
  navigator.clipboard?.writeText(text)
  ElMessage.success('已复制分账方案')
}
</script>

<template>
  <div class="sb">
    <div class="head">
      <div>
        <h3 class="title">AA 分账</h3>
        <p class="sub">聚餐、拼单按份数分摊,自动计算每人应付与凑整收款</p>
      </div>
      <el-button size="small" @click="reset">重置</el-button>
    </div>

    <div class="cols">
      <div class="panel">
        <div class="row">
          <span class="label">总金额</span>
          <el-input-number v-model="f.total" :min="0" :step="10" :precision="2" style="width: 160px" />
          <span class="unit">元</span>
        </div>
        <div class="row">
          <span class="label">服务费 %</span>
          <el-input-number v-model="f.tipPct" :min="0" :max="100" :step="1" />
        </div>
        <div class="row">
          <span class="label">折扣 %</span>
          <el-input-number v-model="f.discountPct" :min="0" :max="100" :step="1" />
        </div>

        <div class="final">
          <span>折后总额</span>
          <b>￥{{ fmt(finalTotal) }}</b>
        </div>
      </div>

      <div class="panel">
        <div class="mem-head">
          <span>成员与份数(共 {{ totalShares }} 份)</span>
          <el-button size="small" :icon="Plus" @click="addPerson">添加</el-button>
        </div>
        <div class="mem-list">
          <div v-for="m in members" :key="m.id" class="mem">
            <el-input v-model="m.name" size="small" style="flex: 1" />
            <el-input-number v-model="m.shares" size="small" :min="0" :max="99" />
            <el-button size="small" text :icon="Delete" @click="removeMember(m.id)" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="rows.length" class="result">
      <div class="r-head">
        <span class="r-title">分账结果</span>
        <el-button size="small" @click="copyPlan">复制方案</el-button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>成员</th>
              <th>份数</th>
              <th>精确分摊</th>
              <th>实际应付</th>
              <th>凑整收款</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td>{{ r.name }}</td>
              <td>{{ r.shares }}</td>
              <td>￥{{ fmt(r.exact) }}</td>
              <td class="pay">￥{{ fmt(r.pay) }}</td>
              <td>￥{{ fmt(collectEven[i]) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">合计</td>
              <td class="pay">￥{{ fmt(finalTotal) }}</td>
              <td>￥{{ fmt(evenTotal) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="note">凑整收款按角向上取整,共多收 ￥{{ fmt(changeTotal) }},可用于下次或留作小费。</p>
    </div>

    <p v-else class="empty">请添加成员并设置份数</p>

    <p class="foot">份数越多承担越多;结果保留两位小数,尾差已计入第一人。</p>
  </div>
</template>

<style scoped>
.sb {
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
  gap: 12px;
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
.final {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 10px;
  padding: 12px 16px;
  background: linear-gradient(120deg, #6366f1, #8b5cf6);
  color: #fff;
}
.final b {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.mem-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.mem-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mem {
  display: flex;
  align-items: center;
  gap: 8px;
}
.result {
  margin-top: 6px;
}
.r-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.r-title {
  font-size: 14px;
  font-weight: 600;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  text-align: right;
  padding: 9px 12px;
  white-space: nowrap;
}
th:first-child,
td:first-child {
  text-align: left;
}
thead th {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  border-bottom: 1px solid var(--card-border);
}
tbody tr:nth-child(even) {
  background: var(--el-fill-color-light);
}
td.pay {
  color: #6366f1;
  font-weight: 700;
}
tfoot td {
  border-top: 1px solid var(--card-border);
  font-weight: 700;
}
.note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.empty {
  text-align: center;
  padding: 30px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
