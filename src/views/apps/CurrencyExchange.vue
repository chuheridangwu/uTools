<script setup lang="ts">
/**
 * 汇率换算
 * 基于 open.er-api.com 的免费汇率接口(无需密钥),支持常用货币互转,
 * 可左右互换、输入金额实时换算,并展示相对基准的换算表。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Refresh, Sort } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Currency {
  code: string
  name: string
  flag: string
}

const CURRENCIES: Currency[] = [
  { code: 'CNY', name: '人民币', flag: '🇨🇳' },
  { code: 'USD', name: '美元', flag: '🇺🇸' },
  { code: 'EUR', name: '欧元', flag: '🇪🇺' },
  { code: 'JPY', name: '日元', flag: '🇯🇵' },
  { code: 'GBP', name: '英镑', flag: '🇬🇧' },
  { code: 'HKD', name: '港币', flag: '🇭🇰' },
  { code: 'KRW', name: '韩元', flag: '🇰🇷' },
  { code: 'AUD', name: '澳元', flag: '🇦🇺' },
  { code: 'CAD', name: '加元', flag: '🇨🇦' },
  { code: 'SGD', name: '新加坡元', flag: '🇸🇬' },
  { code: 'THB', name: '泰铢', flag: '🇹🇭' },
  { code: 'RUB', name: '卢布', flag: '🇷🇺' },
  { code: 'CHF', name: '瑞士法郎', flag: '🇨🇭' },
  { code: 'TWD', name: '新台币', flag: '🇹🇼' },
  { code: 'MYR', name: '林吉特', flag: '🇲🇾' },
  { code: 'INR', name: '印度卢比', flag: '🇮🇳' },
]

const state = reactive({
  amount: 100,
  from: 'CNY',
  to: 'USD',
  /** 以 from 为基准的汇率表:rates[c] = 1 from 等于多少 c */
  rates: {} as Record<string, number>,
  updated: '',
  loading: false,
})

const fromCur = computed(() => CURRENCIES.find((c) => c.code === state.from)!)
const toCur = computed(() => CURRENCIES.find((c) => c.code === state.to)!)

const rate = computed(() => {
  const r = state.rates
  if (!r[state.to]) return 0
  return r[state.to]
})

const converted = computed(() => (Number(state.amount) || 0) * rate.value)

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n !== 0 && (Math.abs(n) >= 1e9 || Math.abs(n) < 1e-4)) return n.toExponential(4)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

async function loadRates() {
  state.loading = true
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${state.from}`)
    const data = await res.json()
    if (data.result === 'success' && data.rates) {
      state.rates = data.rates
      state.updated = new Date().toLocaleString('zh-CN')
    } else {
      ElMessage.error('汇率获取失败,请稍后重试')
    }
  } catch {
    ElMessage.error('网络请求失败,请检查网络')
  } finally {
    state.loading = false
  }
}

function swap() {
  const a = state.from
  state.from = state.to
  state.to = a
  loadRates()
}

watch(
  () => state.from,
  (nv, ov) => {
    if (nv !== ov && ov !== undefined) loadRates()
  },
)

const table = computed(() =>
  CURRENCIES.filter((c) => c.code !== state.from)
    .map((c) => ({ ...c, value: state.rates[c.code] }))
    .filter((c) => c.value),
)

onMounted(loadRates)
</script>

<template>
  <div class="fx">
    <div class="head">
      <div>
        <h3 class="title">汇率换算</h3>
        <p class="sub">基于公开汇率接口,数据仅供参考;更新时间 {{ state.updated || '—' }}</p>
      </div>
      <el-button size="small" :icon="Refresh" :loading="state.loading" @click="loadRates">刷新汇率</el-button>
    </div>

    <div class="converter">
      <div class="side">
        <el-select v-model="state.from" size="large" style="width: 100%">
          <el-option v-for="c in CURRENCIES" :key="c.code" :value="c.code" :label="`${c.flag} ${c.code} ${c.name}`" />
        </el-select>
        <el-input v-model.number="state.amount" size="large" type="number" class="amount" />
      </div>

      <el-button circle :icon="Sort" class="swap" @click="swap" />

      <div class="side">
        <el-select v-model="state.to" size="large" style="width: 100%">
          <el-option v-for="c in CURRENCIES" :key="c.code" :value="c.code" :label="`${c.flag} ${c.code} ${c.name}`" />
        </el-select>
        <div class="out">
          <span class="flag">{{ toCur.flag }}</span>
          {{ fmt(converted) }}
        </div>
      </div>
    </div>

    <div v-if="rate" class="rate-line">
      1 {{ fromCur.code }} = {{ fmt(rate) }} {{ toCur.code }} · 1 {{ toCur.code }} = {{ fmt(1 / rate) }} {{ fromCur.code }}
    </div>

    <div class="table">
      <div class="t-title">1 {{ state.from }} 可兑换</div>
      <div class="t-grid">
        <div v-for="c in table" :key="c.code" class="t-item">
          <span class="t-flag">{{ c.flag }}</span>
          <span class="t-code">{{ c.code }}</span>
          <span class="t-val">{{ fmt(c.value) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fx {
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
.converter {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  max-width: 760px;
}
@media (max-width: 720px) {
  .converter {
    grid-template-columns: 1fr;
  }
  .swap {
    justify-self: center;
  }
}
.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.amount :deep(input) {
  font-size: 18px;
}
.out {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #14b8a6;
  word-break: break-all;
}
.flag {
  font-size: 18px;
}
.rate-line {
  margin-top: 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.table {
  margin-top: 18px;
}
.t-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.t-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.t-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 12px;
}
.t-flag {
  font-size: 16px;
}
.t-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  width: 34px;
}
.t-val {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
