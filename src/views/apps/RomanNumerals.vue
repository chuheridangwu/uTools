<script setup lang="ts">
/**
 * 罗马数字转换
 * 阿拉伯数字(1–3999)与罗马数字双向转换,并附带常用罗马数字对照表。
 * 纯本地计算。
 */
import { computed, ref } from 'vue'
import { CopyDocument, Sort } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const TABLE: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

const mode = ref<'d2r' | 'r2d'>('d2r')
const numInput = ref('2026')
const romanInput = ref('MMXXVI')

function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return ''
  let v = n
  let out = ''
  for (const [val, sym] of TABLE) {
    while (v >= val) {
      out += sym
      v -= val
    }
  }
  return out
}

function fromRoman(s: string): number | null {
  const str = s.toUpperCase().replace(/\s/g, '')
  if (!/^[MDCLXVI]+$/.test(str)) return null
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let i = 0; i < str.length; i++) {
    const cur = map[str[i]]
    const next = map[str[i + 1]] || 0
    total += cur < next ? -cur : cur
  }
  // 回代校验,防止非法写法(如 IIII、VX)
  if (toRoman(total) !== str) return null
  return total
}

const numResult = computed(() => {
  const n = Number(numInput.value)
  if (!numInput.value.trim()) return ''
  if (!Number.isInteger(n) || n < 1 || n > 3999) return '请输入 1–3999 的整数'
  return toRoman(n)
})

const romanResult = computed(() => {
  if (!romanInput.value.trim()) return ''
  const v = fromRoman(romanInput.value)
  return v === null ? '不是合法的罗马数字(仅 I V X L C D M,范围 1–3999)' : String(v)
})

function swap() {
  mode.value = mode.value === 'd2r' ? 'r2d' : 'd2r'
  if (mode.value === 'r2d') romanInput.value = toRoman(Number(numInput.value)) || 'MMXXVI'
}

async function copy(v: string) {
  if (!v || v.includes('请输入') || v.includes('不是合法')) return
  await copyText(v)
  ElMessage.success('已复制')
}

const SAMPLE = [2026, 1999, 888, 400, 49, 4]
const result = computed(() => (mode.value === 'd2r' ? numResult.value : romanResult.value))

function pickSample(s: number) {
  mode.value = 'd2r'
  numInput.value = String(s)
}
</script>

<template>
  <div class="rn">
    <div class="head">
      <div>
        <h3 class="title">罗马数字转换</h3>
        <p class="sub">阿拉伯数字(1–3999)与罗马数字双向转换</p>
      </div>
      <el-button size="small" :icon="Sort" @click="swap">⇄ 切换方向</el-button>
    </div>

    <div class="converter">
      <div class="side">
        <div class="s-label">{{ mode === 'd2r' ? '阿拉伯数字' : '罗马数字' }}</div>
        <el-input v-if="mode === 'd2r'" v-model="numInput" size="large" placeholder="如 2026" class="inp" />
        <el-input v-else v-model="romanInput" size="large" placeholder="如 MMXXVI" class="inp" />
      </div>

      <div class="arrow">→</div>

      <div class="side">
        <div class="s-label">{{ mode === 'd2r' ? '罗马数字' : '阿拉伯数字' }}</div>
        <div class="out" :class="{ err: result.includes('请输入') || result.includes('不是合法') }">
          {{ result || '—' }}
          <el-icon v-if="result && !result.includes('请输入') && !result.includes('不是合法')" class="cp" @click="copy(result)"><CopyDocument /></el-icon>
        </div>
      </div>
    </div>

    <div class="sample">
      <span class="s-hint">示例:</span>
      <el-button v-for="s in SAMPLE" :key="s" size="small" text @click="pickSample(s)">
        {{ s }} = {{ toRoman(s) }}
      </el-button>
    </div>

    <details class="table-wrap">
      <summary>罗马数字对照表</summary>
      <div class="table">
        <div v-for="[val, sym] in TABLE" :key="val" class="cell">
          <span class="c-num">{{ val }}</span>
          <span class="c-sym">{{ sym }}</span>
        </div>
      </div>
    </details>

    <p class="foot">规则:采用标准减法记法,仅支持 1–3999(因罗马数字无 0 且大于 3999 通常加上划线表示千位)。</p>
  </div>
</template>

<style scoped>
.rn {
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
  align-items: end;
  gap: 16px;
  max-width: 720px;
}
@media (max-width: 640px) {
  .converter {
    grid-template-columns: 1fr;
  }
  .arrow {
    transform: rotate(90deg);
  }
}
.s-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.inp :deep(input) {
  font-size: 20px;
  font-family: ui-monospace, Menlo, monospace;
  letter-spacing: 1px;
}
.arrow {
  font-size: 22px;
  color: var(--el-text-color-placeholder);
  padding-bottom: 8px;
}
.out {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 22px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, monospace;
  letter-spacing: 2px;
  color: #6366f1;
}
.out.err {
  color: #ef4444;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  font-family: inherit;
}
.cp {
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  flex: none;
}
.sample {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.s-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.table-wrap {
  margin-top: 18px;
}
.table-wrap summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.table {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 6px 12px;
}
.c-num {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.c-sym {
  font-weight: 700;
  font-family: ui-monospace, Menlo, monospace;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
