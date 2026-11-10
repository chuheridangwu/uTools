<script setup lang="ts">
/**
 * 字节换算(仿找Tab「字节换算」)
 * bit / B / K~P 任意互转,可切 1024(二进制)或 1000(十进制)进制,支持批量换算。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const STEPS = ['B', 'K', 'M', 'G', 'T', 'P'] as const
type Step = typeof STEPS[number]
type Unit = 'bit' | Step

const base = ref<1024 | 1000>(1024)
const single = reactive({ value: 1, unit: 'M' as string })
const batch = reactive({ text: '1 GB\n512 MiB\n2048 KB\n8 bit', target: 'M' as string, out: '' })

const unitOptions = computed(() => [
  { key: 'bit', label: 'bit(比特)' },
  { key: 'B', label: 'B(字节)' },
  ...STEPS.slice(1).map((s) => ({
    key: s,
    label: base.value === 1024 ? `${s}iB` : `${s}B`,
  })),
])

/** 归一化内部单位名:允许用户输入 MB / MiB / M 等写法 */
function normUnit(raw: string): Unit | null {
  const u = raw.trim().replace(/iB$/i, 'B').replace(/bytes?$/i, 'B')
  if (/^bits?$/i.test(u)) return 'bit'
  if (/^b$/i.test(u)) return 'B'
  const m = u.match(/^([kmgtp])b?$/i)
  return m ? (m[1].toUpperCase() as Step) : null
}

const powerOf = (u: Unit): number => (u === 'bit' ? -1 : STEPS.indexOf(u as Step))

function labelOf(u: Unit): string {
  if (u === 'bit') return 'bit'
  const i = STEPS.indexOf(u as Step)
  return i === 0 ? 'B' : (base.value === 1024 ? `${u}iB` : `${u}B`)
}

/** 统一换算成 bit 再换算回来,避免各级单位反复乘除积累误差 */
function toBits(v: number, u: Unit): number {
  const p = powerOf(u)
  return p < 0 ? v : v * 8 * Math.pow(base.value, p)
}
function fromBits(bits: number, u: Unit): number {
  const p = powerOf(u)
  return p < 0 ? bits : bits / (8 * Math.pow(base.value, p))
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v !== 0 && Math.abs(v) < 1e-9) return v.toExponential(4)
  return Number(v.toPrecision(10)).toLocaleString('zh-CN', { maximumFractionDigits: 10 })
}

const bits = computed(() => {
  const u = normUnit(single.unit)
  const v = Number(single.value)
  if (!u || !Number.isFinite(v)) return NaN
  return toBits(v, u)
})

const rows = computed(() => {
  const all: Unit[] = ['bit', ...STEPS]
  return all.map((u) => ({ unit: u, label: labelOf(u), value: fmt(fromBits(bits.value, u)) }))
})

function convertBatch() {
  const target = normUnit(batch.target)
  if (!target) { ElMessage.warning('目标单位不认识,请用 B / KB / MB / GB 等写法'); return }
  const lines: string[] = []
  for (const raw of batch.text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^([\d.,]+)\s*([a-zA-Z]+)?$/)
    if (!m) { lines.push(`${line}  ← 无法解析`); continue }
    const v = Number(m[1].replace(/,/g, ''))
    const u = normUnit(m[2] || 'B')
    if (!u || !Number.isFinite(v)) { lines.push(`${line}  ← 无法解析`); continue }
    lines.push(`${line} = ${fmt(fromBits(toBits(v, u), target))} ${labelOf(target)}`)
  }
  batch.out = lines.join('\n')
}

async function copy(v: string) {
  if (!v) return
  await copyText(v)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="bc">
    <div class="head">
      <div>
        <h3 class="title">字节换算</h3>
        <p class="sub">bit / B / KB ~ PB 任意互转,支持 1024 与 1000 两种进制</p>
      </div>
      <el-radio-group v-model="base" size="small">
        <el-radio-button :value="1024">1024(二进制)</el-radio-button>
        <el-radio-button :value="1000">1000(十进制)</el-radio-button>
      </el-radio-group>
    </div>

    <div class="row">
      <span class="lbl">数值</span>
      <el-input v-model.number="single.value" class="num" placeholder="输入数值" />
      <span class="lbl">单位</span>
      <el-select v-model="single.unit" class="unit" filterable allow-create default-first-option>
        <el-option v-for="u in unitOptions" :key="u.key" :label="u.label" :value="u.key" />
      </el-select>
      <span class="tip">也可直接输入 MB、MiB、bit 等写法</span>
    </div>

    <div class="grid">
      <button v-for="r in rows" :key="r.unit" class="cell" @click="copy(r.value)">
        <span class="c-label">{{ r.label }}</span>
        <span class="c-value">{{ bits >= 0 ? r.value : '—' }}</span>
      </button>
    </div>
    <p class="foot">点击任意卡片复制数值。{{ base === 1024 ? 'KiB / MiB / GiB 按 1024 进位' : 'KB / MB / GB 按 1000 进位' }};1 B = 8 bit。</p>

    <div class="divider" />
    <div class="block-head">
      <span>批量换算(每行一个,如 <code>1 GB</code>)</span>
      <div class="acts">
        <span class="lbl">换算为</span>
        <el-select v-model="batch.target" class="unit small" filterable allow-create default-first-option>
          <el-option v-for="u in unitOptions" :key="u.key" :label="u.label" :value="u.key" />
        </el-select>
        <el-button size="small" type="primary" @click="convertBatch">换算</el-button>
        <el-button size="small" :disabled="!batch.out" @click="copy(batch.out)">复制结果</el-button>
        <el-button size="small" :disabled="!batch.out" @click="downloadText(batch.out, 'byte-convert.txt')">下载</el-button>
      </div>
    </div>
    <div class="two">
      <el-input v-model="batch.text" type="textarea" :rows="6" spellcheck="false" placeholder="1 GB&#10;512 MiB&#10;2048 KB" />
      <el-input v-model="batch.out" type="textarea" :rows="6" readonly placeholder="换算结果" />
    </div>
  </div>
</template>

<style scoped>
.bc { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.lbl { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; }
.num { width: 180px; }
.unit { width: 150px; }
.unit.small { width: 120px; }
.tip { font-size: 11px; color: var(--el-text-color-secondary); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.cell {
  display: flex; flex-direction: column; gap: 6px; text-align: left;
  padding: 12px 14px; border: 1px solid var(--el-border-color);
  border-radius: 10px; background: var(--el-fill-color-blank); cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.cell:hover { border-color: var(--el-color-primary); transform: translateY(-2px); }
.c-label { font-size: 11px; color: var(--el-text-color-secondary); }
.c-value { font-size: 15px; font-weight: 700; word-break: break-all; font-variant-numeric: tabular-nums; }
.foot { font-size: 11px; color: var(--el-text-color-secondary); margin: 10px 0 0; }
.divider { height: 1px; background: var(--el-border-color-lighter); margin: 18px 0; }
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.acts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
</style>
