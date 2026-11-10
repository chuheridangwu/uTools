<script setup lang="ts">
/**
 * 生物钟
 * 根据出生日期计算体力、情绪、智力三种生物节律的正弦周期,
 * 用曲线展示近 30 天走势,并给出今日所处阶段与高低潮提示,仅作娱乐参考。
 */
import { computed, reactive } from 'vue'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const f = reactive({ birth: '1995-06-15', base: todayStr() })

const CYCLES = [
  { key: 'physical', name: '体力', days: 23, color: '#ef4444' },
  { key: 'emotion', name: '情绪', days: 28, color: '#f59e0b' },
  { key: 'intellect', name: '智力', days: 33, color: '#0ea5e9' },
]

function parse(s: string): Date {
  return new Date(s + 'T00:00:00')
}

const daysSince = computed(() => {
  const b = parse(f.birth)
  const t = parse(f.base)
  if (isNaN(b.getTime()) || isNaN(t.getTime())) return 0
  return Math.round((t.getTime() - b.getTime()) / 86400000)
})

function valueAt(days: number, period: number): number {
  return Math.sin((2 * Math.PI * days) / period)
}

interface Today {
  key: string
  name: string
  color: string
  value: number
  pct: number
  status: string
}

const today = computed<Today[]>(() =>
  CYCLES.map((c) => {
    const v = valueAt(daysSince.value, c.days)
    let status = '临界期'
    if (v > 0.3) status = '高潮期'
    else if (v < -0.3) status = '低潮期'
    return { key: c.key, name: c.name, color: c.color, value: v, pct: Math.round(v * 100), status }
  }),
)

/** 近 30 天数据(以 base 为中心,前 15 后 14) */
const RANGE = 30

const chart = computed(() => {
  const out: { day: number; label: string; points: Record<string, number>; isBase: boolean }[] = []
  for (let i = -14; i <= RANGE - 15; i++) {
    const d = new Date(parse(f.base))
    d.setDate(d.getDate() + i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const days = daysSince.value + i
    const points: Record<string, number> = {}
    for (const c of CYCLES) points[c.key] = valueAt(days, c.days)
    out.push({ day: i, label, points, isBase: i === 0 })
  }
  return out
})

/** SVG 路径 */
const W = 720
const H = 220
const PAD = 24

function pathFor(key: string): string {
  const points = chart.value
  const stepX = (W - PAD * 2) / (points.length - 1 || 1)
  return points
    .map((p, i) => {
      const x = PAD + i * stepX
      const y = PAD + ((1 - (p.points[key] + 1) / 2) * (H - PAD * 2))
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const zeroY = PAD + (H - PAD * 2) / 2

const tips = computed(() => {
  const list: string[] = []
  const p = today.value
  if (p[0].value > 0.5) list.push('体力处于高峰,适合运动或处理消耗体力的任务。')
  else if (p[0].value < -0.5) list.push('体力偏低,注意休息,避免高强度活动。')
  if (p[1].value > 0.5) list.push('情绪积极,适合社交与沟通。')
  else if (p[1].value < -0.5) list.push('情绪容易波动,保持平和,避免冲动决定。')
  if (p[2].value > 0.5) list.push('思维清晰,适合学习与攻克难题。')
  else if (p[2].value < -0.5) list.push('注意力可能下降,把重要工作安排在状态好的时段。')
  if (!list.length) list.push('各项节律较为平稳,是普通而踏实的一天。')
  return list
})

function fmtDate(s: string) {
  const d = parse(s)
  if (isNaN(d.getTime())) return '—'
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
</script>

<template>
  <div class="br">
    <div class="head">
      <div>
        <h3 class="title">生物钟</h3>
        <p class="sub">体力 / 情绪 / 智力三节律曲线,输入生日即可查看</p>
      </div>
      <div class="inputs">
        <span class="lbl">出生日期</span>
        <el-date-picker v-model="f.birth" type="date" value-format="YYYY-MM-DD" placeholder="出生日期" size="small" />
        <span class="lbl">查看日期</span>
        <el-date-picker v-model="f.base" type="date" value-format="YYYY-MM-DD" placeholder="查看日期" size="small" />
      </div>
    </div>

    <div class="cards">
      <div v-for="t in today" :key="t.key" class="card" :style="{ borderColor: t.color }">
        <div class="c-name" :style="{ color: t.color }">{{ t.name }}</div>
        <div class="c-pct" :style="{ color: t.color }">{{ t.pct > 0 ? '+' : '' }}{{ t.pct }}%</div>
        <div class="c-status">{{ t.status }}</div>
        <div class="c-bar">
          <div class="c-bar-fill" :style="{ width: Math.abs(t.pct) + '%', background: t.color, marginLeft: t.pct < 0 ? (50 - Math.abs(t.pct) / 2) + '%' : '50%' }" />
          <div class="c-bar-mid" />
        </div>
      </div>
    </div>

    <div class="chart">
      <div class="chart-head">
        <span class="ch-title">近 30 天曲线({{ fmtDate(f.base) }} 为中心)</span>
        <div class="legend">
          <span v-for="c in CYCLES" :key="c.key" class="lg">
            <i :style="{ background: c.color }" />{{ c.name }}({{ c.days }}天)
          </span>
        </div>
      </div>
      <svg :viewBox="`0 0 ${W} ${H}`" class="svg" preserveAspectRatio="none">
        <line :x1="PAD" :y1="zeroY" :x2="W - PAD" :y2="zeroY" stroke="var(--card-border)" stroke-dasharray="4 4" />
        <line
          v-for="(p, i) in chart"
          v-show="p.isBase"
          :key="i"
          :x1="PAD + i * ((W - PAD * 2) / (chart.length - 1))"
          :y1="PAD"
          :x2="PAD + i * ((W - PAD * 2) / (chart.length - 1))"
          :y2="H - PAD"
          stroke="#6366f1"
          stroke-dasharray="3 3"
          opacity="0.6"
        />
        <path
          v-for="c in CYCLES"
          :key="c.key"
          :d="pathFor(c.key)"
          fill="none"
          :stroke="c.color"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </svg>
      <div class="axis">
        <span v-for="(p, i) in chart" :key="i" class="ax-x">
          <span v-if="i % 3 === 0">{{ p.label }}</span>
        </span>
      </div>
    </div>

    <div class="tips">
      <div class="tp-title">今日提示</div>
      <ul>
        <li v-for="(t, i) in tips" :key="i">{{ t }}</li>
      </ul>
    </div>

    <p class="foot">生物节律源自上世纪的经验公式,并无严格科学依据,请仅作娱乐与自我观察参考,不要据此做重要决策。</p>
  </div>
</template>

<style scoped>
.br {
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
.inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
@media (max-width: 640px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
.card {
  border: 1px solid var(--card-border);
  border-top-width: 3px;
  border-radius: 12px;
  padding: 14px 16px;
}
.c-name {
  font-size: 13px;
  font-weight: 600;
}
.c-pct {
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin: 4px 0;
}
.c-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}
.c-bar {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  overflow: hidden;
}
.c-bar-fill {
  position: absolute;
  top: 0;
  height: 100%;
}
.c-bar-mid {
  position: absolute;
  left: 50%;
  top: 0;
  width: 1px;
  height: 100%;
  background: var(--el-text-color-placeholder);
}
.chart {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px 16px;
}
.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ch-title {
  font-size: 13px;
  font-weight: 600;
}
.legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.lg {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.lg i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.svg {
  width: 100%;
  height: 220px;
  display: block;
}
.axis {
  display: flex;
  font-size: 10px;
  color: var(--el-text-color-placeholder);
}
.ax-x {
  flex: 1;
  text-align: center;
}
.tips {
  margin-top: 18px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
}
.tp-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.tips ul {
  margin: 0;
  padding-left: 18px;
}
.tips li {
  font-size: 13px;
  line-height: 2;
  color: var(--el-text-color-regular);
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
