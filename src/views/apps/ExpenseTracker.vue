<script setup lang="ts">
/**
 * 记账本
 * 记录收入 / 支出,按分类与日期统计,展示本月收支与结余;
 * 数据仅存本机浏览器,支持删除与分类汇总。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Bill {
  id: string
  type: 'expense' | 'income'
  amount: number
  category: string
  note: string
  date: string // YYYY-MM-DD
  ts: number
}

const CATS = ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '学习', '人情', '其他']
const INC_CATS = ['工资', '奖金', '兼职', '理财', '红包', '其他']

const KEY = 'utools_expense'
const bills = reactive<{ list: Bill[] }>({ list: [] })

const form = reactive({
  type: 'expense' as 'expense' | 'income',
  amount: undefined as number | undefined,
  category: '餐饮',
  note: '',
  date: new Date().toISOString().slice(0, 10),
})

const month = ref(new Date().toISOString().slice(0, 7))

const monthBills = computed(() => bills.list.filter((b) => b.date.startsWith(month.value)))
const totalExpense = computed(() => monthBills.value.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0))
const totalIncome = computed(() => monthBills.value.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0))
const balance = computed(() => totalIncome.value - totalExpense.value)

const byCategory = computed(() => {
  const map = new Map<string, number>()
  monthBills.value.filter((b) => b.type === 'expense').forEach((b) => map.set(b.category, (map.get(b.category) || 0) + b.amount))
  const total = totalExpense.value || 1
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }))
    .sort((a, b) => b.value - a.value)
})

const sorted = computed(() => [...monthBills.value].sort((a, b) => b.ts - a.ts))

const catOptions = computed(() => (form.type === 'expense' ? CATS : INC_CATS))

function save() {
  localStorage.setItem(KEY, JSON.stringify(bills.list))
}

function add() {
  if (!form.amount || form.amount <= 0) {
    ElMessage.warning('请输入金额')
    return
  }
  bills.list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type: form.type,
    amount: Math.round(form.amount * 100) / 100,
    category: form.category,
    note: form.note.trim(),
    date: form.date,
    ts: Date.now(),
  })
  form.amount = undefined
  form.note = ''
  save()
  ElMessage.success('已记录')
}

function remove(id: string) {
  bills.list = bills.list.filter((b) => b.id !== id)
  save()
}

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shiftMonth(d: number) {
  const [y, m] = month.value.split('-').map(Number)
  const date = new Date(y, m - 1 + d, 1)
  month.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

onMounted(() => {
  try {
    bills.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    bills.list = []
  }
})
</script>

<template>
  <div class="ex">
    <div class="head">
      <div>
        <h3 class="title">记账本</h3>
        <p class="sub">记录收支,查看本月结余与分类占比(数据仅存本机)</p>
      </div>
      <div class="month">
        <el-button size="small" @click="shiftMonth(-1)">上月</el-button>
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" size="small" style="width: 130px" />
        <el-button size="small" @click="shiftMonth(1)">下月</el-button>
      </div>
    </div>

    <div class="cards">
      <div class="m">
        <div class="m-label">本月支出</div>
        <div class="m-value exp">¥{{ fmt(totalExpense) }}</div>
      </div>
      <div class="m">
        <div class="m-label">本月收入</div>
        <div class="m-value inc">¥{{ fmt(totalIncome) }}</div>
      </div>
      <div class="m">
        <div class="m-label">本月结余</div>
        <div class="m-value" :class="balance >= 0 ? 'inc' : 'exp'">¥{{ fmt(balance) }}</div>
      </div>
    </div>

    <div class="add">
      <el-radio-group v-model="form.type" size="small" @change="form.category = form.type === 'expense' ? '餐饮' : '工资'">
        <el-radio-button value="expense">支出</el-radio-button>
        <el-radio-button value="income">收入</el-radio-button>
      </el-radio-group>
      <el-input-number v-model="form.amount" :min="0" :precision="2" :controls="false" placeholder="金额" style="width: 120px" />
      <el-select v-model="form.category" size="default" style="width: 120px">
        <el-option v-for="c in catOptions" :key="c" :value="c" :label="c" />
      </el-select>
      <el-input v-model="form.note" placeholder="备注(可选)" style="flex: 1; min-width: 120px" />
      <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 140px" />
      <el-button type="primary" :icon="Plus" @click="add">记录</el-button>
    </div>

    <div class="body">
      <div class="list-wrap">
        <div v-for="b in sorted" :key="b.id" class="row">
          <span class="badge" :class="b.type">{{ b.category }}</span>
          <span class="note">{{ b.note || '—' }}</span>
          <span class="date">{{ b.date.slice(5) }}</span>
          <span class="amt" :class="b.type">{{ b.type === 'expense' ? '-' : '+' }}¥{{ fmt(b.amount) }}</span>
          <el-button text size="small" type="danger" :icon="Delete" @click="remove(b.id)" />
        </div>
        <div v-if="!sorted.length" class="empty">本月还没有记录</div>
      </div>

      <div class="stats">
        <div class="stats-title">支出分类</div>
        <div v-for="c in byCategory" :key="c.name" class="stat-row">
          <span class="st-name">{{ c.name }}</span>
          <div class="st-bar"><div class="st-fill" :style="{ width: c.pct + '%' }" /></div>
          <span class="st-val">¥{{ fmt(c.value) }}</span>
        </div>
        <div v-if="!byCategory.length" class="st-empty">暂无支出</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ex {
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
.month {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.m {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.m-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.m-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.m-value.exp {
  color: #ef4444;
}
.m-value.inc {
  color: #16a34a;
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
.body {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 14px;
}
@media (max-width: 800px) {
  .body {
    grid-template-columns: 1fr;
  }
  .cards {
    grid-template-columns: 1fr;
  }
}
.list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 12px;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  flex: none;
}
.badge.expense {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #ef4444;
}
.badge.income {
  background: color-mix(in srgb, #16a34a 14%, transparent);
  color: #16a34a;
}
.note {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.date {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  flex: none;
}
.amt {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.amt.expense {
  color: #ef4444;
}
.amt.income {
  color: #16a34a;
}
.empty {
  text-align: center;
  padding: 30px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.stats {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
}
.stats-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}
.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.st-name {
  width: 42px;
  font-size: 12px;
  flex: none;
}
.st-bar {
  flex: 1;
  height: 8px;
  border-radius: 5px;
  background: var(--el-fill-color);
  overflow: hidden;
}
.st-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}
.st-val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 72px;
  text-align: right;
  flex: none;
}
.st-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
