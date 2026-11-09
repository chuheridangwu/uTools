<script setup lang="ts">
/**
 * 单位换算
 * 覆盖长度、重量、面积、体积、温度、速度、存储、时间等常用单位,
 * 支持左右互换、实时换算与常用快捷值。
 */
import { computed, ref, watch } from 'vue'
import { Sort } from '@element-plus/icons-vue'

interface Unit {
  key: string
  name: string
  /** 相对基准单位的系数(温度除外) */
  factor: number
}

interface Category {
  key: string
  name: string
  base: string
  units: Unit[]
  special?: 'temp'
}

const CATEGORIES: Category[] = [
  {
    key: 'length', name: '长度', base: 'm',
    units: [
      { key: 'm', name: '米', factor: 1 },
      { key: 'km', name: '千米', factor: 1000 },
      { key: 'cm', name: '厘米', factor: 0.01 },
      { key: 'mm', name: '毫米', factor: 0.001 },
      { key: 'inch', name: '英寸', factor: 0.0254 },
      { key: 'foot', name: '英尺', factor: 0.3048 },
      { key: 'yard', name: '码', factor: 0.9144 },
      { key: 'mile', name: '英里', factor: 1609.344 },
      { key: 'nmi', name: '海里', factor: 1852 },
    ],
  },
  {
    key: 'weight', name: '重量', base: 'kg',
    units: [
      { key: 'kg', name: '千克', factor: 1 },
      { key: 'g', name: '克', factor: 0.001 },
      { key: 'mg', name: '毫克', factor: 1e-6 },
      { key: 't', name: '吨', factor: 1000 },
      { key: 'lb', name: '磅', factor: 0.45359237 },
      { key: 'oz', name: '盎司', factor: 0.028349523125 },
      { key: 'jin', name: '斤', factor: 0.5 },
      { key: 'liang', name: '两', factor: 0.05 },
    ],
  },
  {
    key: 'area', name: '面积', base: 'm2',
    units: [
      { key: 'm2', name: '平方米', factor: 1 },
      { key: 'km2', name: '平方千米', factor: 1e6 },
      { key: 'cm2', name: '平方厘米', factor: 1e-4 },
      { key: 'ha', name: '公顷', factor: 10000 },
      { key: 'mu', name: '亩', factor: 666.6667 },
      { key: 'ping', name: '坪', factor: 3.305785 },
      { key: 'ft2', name: '平方英尺', factor: 0.09290304 },
    ],
  },
  {
    key: 'volume', name: '体积', base: 'L',
    units: [
      { key: 'L', name: '升', factor: 1 },
      { key: 'mL', name: '毫升', factor: 0.001 },
      { key: 'm3', name: '立方米', factor: 1000 },
      { key: 'galus', name: '加仑(美)', factor: 3.785411784 },
      { key: 'galuk', name: '加仑(英)', factor: 4.54609 },
      { key: 'pintus', name: '品脱(美)', factor: 0.473176473 },
    ],
  },
  {
    key: 'temp', name: '温度', base: 'c', special: 'temp',
    units: [
      { key: 'c', name: '摄氏度', factor: 1 },
      { key: 'f', name: '华氏度', factor: 1 },
      { key: 'k', name: '开尔文', factor: 1 },
    ],
  },
  {
    key: 'speed', name: '速度', base: 'ms',
    units: [
      { key: 'ms', name: '米/秒', factor: 1 },
      { key: 'kmh', name: '千米/时', factor: 0.2777778 },
      { key: 'mph', name: '英里/时', factor: 0.44704 },
      { key: 'kn', name: '节', factor: 0.5144444 },
      { key: 'fts', name: '英尺/秒', factor: 0.3048 },
    ],
  },
  {
    key: 'storage', name: '存储', base: 'B',
    units: [
      { key: 'B', name: '字节 B', factor: 1 },
      { key: 'KB', name: 'KB', factor: 1024 },
      { key: 'MB', name: 'MB', factor: 1024 ** 2 },
      { key: 'GB', name: 'GB', factor: 1024 ** 3 },
      { key: 'TB', name: 'TB', factor: 1024 ** 4 },
      { key: 'PB', name: 'PB', factor: 1024 ** 5 },
    ],
  },
  {
    key: 'time', name: '时间', base: 's',
    units: [
      { key: 's', name: '秒', factor: 1 },
      { key: 'ms', name: '毫秒', factor: 0.001 },
      { key: 'min', name: '分钟', factor: 60 },
      { key: 'h', name: '小时', factor: 3600 },
      { key: 'd', name: '天', factor: 86400 },
      { key: 'wk', name: '周', factor: 604800 },
    ],
  },
]

const catKey = ref('length')
const amount = ref<number>(1)
const fromKey = ref('m')
const toKey = ref('km')

const category = computed(() => CATEGORIES.find((c) => c.key === catKey.value)!)
const units = computed(() => category.value.units)

function toBase(v: number, u: Unit, cat: Category): number {
  if (cat.special === 'temp') {
    if (u.key === 'c') return v
    if (u.key === 'f') return ((v - 32) * 5) / 9
    return v - 273.15
  }
  return v * u.factor
}
function fromBase(v: number, u: Unit, cat: Category): number {
  if (cat.special === 'temp') {
    if (u.key === 'c') return v
    if (u.key === 'f') return (v * 9) / 5 + 32
    return v + 273.15
  }
  return v / u.factor
}

const result = computed(() => {
  const cat = category.value
  const f = units.value.find((u) => u.key === fromKey.value)!
  const t = units.value.find((u) => u.key === toKey.value)!
  const base = toBase(Number(amount.value) || 0, f, cat)
  return fromBase(base, t, cat)
})

const resultText = computed(() => {
  const r = result.value
  if (!Number.isFinite(r)) return '—'
  if (r !== 0 && (Math.abs(r) >= 1e9 || Math.abs(r) < 1e-6)) return r.toExponential(6)
  return String(Number(r.toPrecision(10)))
})

function swap() {
  const a = fromKey.value
  fromKey.value = toKey.value
  toKey.value = a
}

const QUICK: Record<string, number[]> = {
  length: [1, 10, 100, 1000],
  weight: [1, 10, 100, 1000],
  area: [1, 10, 100, 1000],
  volume: [1, 10, 100, 1000],
  temp: [0, 25, 37, 100],
  speed: [1, 10, 60, 100],
  storage: [1, 100, 1024, 10240],
  time: [1, 60, 3600, 86400],
}

// 切换类别时重置单位
watch(catKey, () => {
  const cat = category.value
  fromKey.value = cat.units[0].key
  toKey.value = cat.units[1]?.key ?? cat.units[0].key
})
</script>

<template>
  <div class="uc">
    <div class="head">
      <h3 class="title">单位换算</h3>
      <el-radio-group v-model="catKey" size="small">
        <el-radio-button v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.name }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="converter">
      <div class="side">
        <div class="side-label">从</div>
        <el-select v-model="fromKey" size="large" style="width: 100%">
          <el-option v-for="u in units" :key="u.key" :value="u.key" :label="u.name" />
        </el-select>
        <el-input v-model.number="amount" size="large" type="number" class="amount" />
      </div>

      <el-button circle :icon="Sort" class="swap" @click="swap" />

      <div class="side">
        <div class="side-label">到</div>
        <el-select v-model="toKey" size="large" style="width: 100%">
          <el-option v-for="u in units" :key="u.key" :value="u.key" :label="u.name" />
        </el-select>
        <div class="out">{{ resultText }}</div>
      </div>
    </div>

    <div class="quick">
      <span class="q-label">快捷:</span>
      <el-button v-for="v in QUICK[catKey]" :key="v" size="small" text @click="amount = v">{{ v }}</el-button>
    </div>
  </div>
</template>

<style scoped>
.uc {
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
.side-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.amount {
  font-size: 18px;
}
.out {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
  color: #14b8a6;
}
.swap {
  align-self: center;
}
.quick {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.q-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
