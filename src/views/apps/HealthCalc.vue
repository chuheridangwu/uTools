<script setup lang="ts">
/**
 * 健康计算器
 * 输入身高体重年龄性别,计算 BMI、基础代谢(BMR)、每日消耗(TDEE)、
 * 理想体重与体脂率(BMI 法),并给出体型判断。公式为常用估算,仅供参考。
 */
import { computed, reactive } from 'vue'

const f = reactive({
  gender: 'male' as 'male' | 'female',
  age: 25,
  height: 170,
  weight: 65,
  activity: 1.375,
})

const ACTIVITIES = [
  { v: 1.2, label: '久坐(几乎不运动)' },
  { v: 1.375, label: '轻度(每周 1-3 次)' },
  { v: 1.55, label: '中度(每周 3-5 次)' },
  { v: 1.725, label: '高度(每周 6-7 次)' },
  { v: 1.9, label: '极高(体力劳动/集训)' },
]

const bmi = computed(() => {
  const h = f.height / 100
  if (!h) return 0
  return f.weight / (h * h)
})

const bmiInfo = computed(() => {
  const v = bmi.value
  if (!v) return { text: '—', color: '#94a3b8' }
  if (v < 18.5) return { text: '偏瘦', color: '#0ea5e9' }
  if (v < 24) return { text: '正常', color: '#16a34a' }
  if (v < 28) return { text: '超重', color: '#f59e0b' }
  return { text: '肥胖', color: '#ef4444' }
})

const bmr = computed(() => {
  // Mifflin-St Jeor
  if (!f.height || !f.weight) return 0
  const base = 10 * f.weight + 6.25 * f.height - 5 * f.age
  return f.gender === 'male' ? base + 5 : base - 161
})

const tdee = computed(() => bmr.value * f.activity)

const idealWeight = computed(() => {
  // 以 BMI 22 为理想
  const h = f.height / 100
  return 22 * h * h
})

const bodyFat = computed(() => {
  const v = bmi.value
  if (!v) return 0
  // Deurenberg 公式
  const sex = f.gender === 'male' ? 1 : 0
  return 1.2 * v + 0.23 * f.age - 10.8 * sex - 5.4
})

const bmiPct = computed(() => Math.max(0, Math.min(100, ((bmi.value - 12) / (40 - 12)) * 100)))

function num(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—'
}
</script>

<template>
  <div class="hc">
    <div class="head">
      <div>
        <h3 class="title">健康计算器</h3>
        <p class="sub">估算 BMI、基础代谢与每日热量需求,结果仅供参考</p>
      </div>
    </div>

    <div class="cols">
      <div class="panel">
        <div class="row">
          <span class="label">性别</span>
          <el-radio-group v-model="f.gender" size="small">
            <el-radio-button value="male">男</el-radio-button>
            <el-radio-button value="female">女</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <span class="label">年龄</span>
          <el-input-number v-model="f.age" :min="10" :max="100" />
        </div>
        <div class="row">
          <span class="label">身高 (cm)</span>
          <el-input-number v-model="f.height" :min="100" :max="230" />
        </div>
        <div class="row">
          <span class="label">体重 (kg)</span>
          <el-input-number v-model="f.weight" :min="30" :max="200" :precision="1" />
        </div>
        <div class="row">
          <span class="label">活动量</span>
          <el-select v-model="f.activity" style="width: 100%">
            <el-option v-for="a in ACTIVITIES" :key="a.v" :value="a.v" :label="a.label" />
          </el-select>
        </div>
      </div>

      <div class="panel result">
        <div class="bmi-box">
          <div class="bmi-label">BMI 身体质量指数</div>
          <div class="bmi-value" :style="{ color: bmiInfo.color }">{{ num(bmi) }}</div>
          <div class="bmi-tag" :style="{ background: bmiInfo.color + '22', color: bmiInfo.color }">{{ bmiInfo.text }}</div>
          <div class="bmi-bar">
            <div class="marker" :style="{ left: bmiPct + '%' }" />
          </div>
          <div class="bmi-scale"><span>偏瘦</span><span>正常</span><span>超重</span><span>肥胖</span></div>
        </div>

        <div class="stats">
          <div class="st">
            <div class="st-l">基础代谢 BMR</div>
            <div class="st-v">{{ num(bmr, 0) }} <span class="u">kcal/天</span></div>
          </div>
          <div class="st">
            <div class="st-l">每日消耗 TDEE</div>
            <div class="st-v">{{ num(tdee, 0) }} <span class="u">kcal/天</span></div>
          </div>
          <div class="st">
            <div class="st-l">理想体重</div>
            <div class="st-v">{{ num(idealWeight) }} <span class="u">kg</span></div>
          </div>
          <div class="st">
            <div class="st-l">估算体脂率</div>
            <div class="st-v">{{ num(bodyFat) }} <span class="u">%</span></div>
          </div>
        </div>
      </div>
    </div>

    <p class="foot">说明:BMR 采用 Mifflin-St Jeor 公式,体脂率采用 Deurenberg 公式,均为估算值,不能替代医学建议。</p>
  </div>
</template>

<style scoped>
.hc {
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
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 780px) {
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
}
.label {
  width: 92px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: none;
}
.bmi-box {
  text-align: center;
}
.bmi-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.bmi-value {
  font-size: 46px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  margin: 4px 0;
}
.bmi-tag {
  display: inline-block;
  font-size: 12px;
  padding: 2px 12px;
  border-radius: 12px;
}
.bmi-bar {
  position: relative;
  height: 10px;
  border-radius: 6px;
  margin: 14px 4px 4px;
  background: linear-gradient(90deg, #0ea5e9 0%, #0ea5e9 23%, #16a34a 23%, #16a34a 42%, #f59e0b 42%, #f59e0b 57%, #ef4444 57%, #ef4444 100%);
}
.marker {
  position: absolute;
  top: -4px;
  width: 4px;
  height: 18px;
  background: #111827;
  border-radius: 2px;
  transform: translateX(-50%);
  transition: left 0.3s;
}
.bmi-scale {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin: 0 4px;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.st {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
}
.st-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.st-v {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.u {
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
