<script setup lang="ts">
/**
 * 金额大写转换
 * 把阿拉伯数字金额转换为中文大写(财务规范),支持正负、小数角分与万元单位,
 * 输入实时转换,一键复制结果。
 */
import { computed, ref } from 'vue'
import { CopyDocument, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const input = ref('1234.56')

const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const UNIT1 = ['', '拾', '佰', '仟'] // 组内
const UNIT2 = ['', '万', '亿', '万亿'] // 组间

/** 转换整数部分 */
function intToChinese(intStr: string): string {
  if (!/^\d+$/.test(intStr)) return ''
  const num = intStr.replace(/^0+/, '')
  if (num === '') return '零'
  // 按四位分组
  const groups: string[] = []
  for (let i = num.length; i > 0; i -= 4) {
    groups.unshift(num.slice(Math.max(0, i - 4), i))
  }
  let out = ''
  groups.forEach((g, gi) => {
    const unit2 = UNIT2[groups.length - 1 - gi]
    const gNum = Number(g)
    if (gNum === 0) {
      // 整组为零,补零(末尾不加)
      if (out && !out.endsWith('零')) out += '零'
      return
    }
    let seg = ''
    const digits = g.padStart(4, '0')
    let hasNonZero = false
    for (let d = 0; d < 4; d++) {
      const n = Number(digits[d])
      const unit = UNIT1[3 - d]
      if (n === 0) {
        if (hasNonZero && !seg.endsWith('零')) seg += '零'
      } else {
        seg += DIGITS[n] + unit
        hasNonZero = true
      }
    }
    seg = seg.replace(/零+$/, '')
    out += seg + unit2
  })
  out = out.replace(/零+/g, '零').replace(/零$/, '')
  return out
}

/** 转换小数(角分) */
function decToChinese(decStr: string): string {
  const d = (decStr + '00').slice(0, 2)
  const jiao = Number(d[0])
  const fen = Number(d[1])
  let out = ''
  if (jiao === 0 && fen === 0) return ''
  if (jiao > 0) out += DIGITS[jiao] + '角'
  else if (fen > 0) out += '零' // 有分无角需补零
  if (fen > 0) out += DIGITS[fen] + '分'
  return out
}

const result = computed(() => {
  let raw = input.value.trim().replace(/,/g, '').replace(/，/g, '').replace(/￥|¥/g, '')
  if (raw === '') return ''
  const negative = raw.startsWith('-')
  raw = raw.replace(/^[+-]/, '')
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === '.') return '输入格式不正确'
  const [intPart = '0', decPart = ''] = raw.split('.')
  const intText = intToChinese(intPart || '0')
  const decText = decToChinese(decPart)
  let out = ''
  // 整数部分为 0 且有角分时省略「零元」以外的冗余
  if (intText === '零' && decText) out = '零元'
  else out = intText + '元'
  if (decText) out += decText
  else out += '整'
  return (negative ? '负' : '') + out
})

/** 万元表示 */
const inWan = computed(() => {
  const n = Number(input.value.replace(/,/g, ''))
  if (!Number.isFinite(n)) return '—'
  return (n / 10000).toFixed(4).replace(/\.?0+$/, '') + ' 万元'
})

async function copy() {
  if (!result.value) return
  await copyText(result.value)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="rc">
    <div class="head">
      <div>
        <h3 class="title">金额大写转换</h3>
        <p class="sub">把数字金额转换成财务规范的中文大写,支持角分与负数</p>
      </div>
      <el-button size="small" :icon="RefreshLeft" @click="input = ''">清空</el-button>
    </div>

    <div class="input-row">
      <el-input v-model="input" size="large" placeholder="输入金额,如 1234.56" class="inp" />
      <el-button size="large" type="primary" :icon="CopyDocument" @click="copy">复制</el-button>
    </div>

    <div class="out-card">
      <div class="out-label">中文大写</div>
      <div class="out-text" :class="{ err: result === '输入格式不正确' }">{{ result || '—' }}</div>
    </div>

    <div class="extra">
      <div class="ex-item"><span class="ex-l">万元表示</span><span class="ex-v">{{ inWan }}</span></div>
    </div>

    <div class="quick">
      <span class="q-label">示例:</span>
      <el-button v-for="v in ['100', '1234.56', '10086', '100000000', '0.05', '-520.13']" :key="v" size="small" text @click="input = v">{{ v }}</el-button>
    </div>

    <p class="foot">规则:整数部分按「亿/万」分组,角分不足补零,金额为整时以「整」结尾,符合财务书写习惯。</p>
  </div>
</template>

<style scoped>
.rc {
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
.input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.inp {
  flex: 1;
}
.inp :deep(input) {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.out-card {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 18px 20px;
  background: var(--el-fill-color-light);
  margin-bottom: 14px;
}
.out-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.out-text {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #14b8a6;
  word-break: break-all;
  line-height: 1.4;
}
.out-text.err {
  color: #ef4444;
  font-size: 16px;
  font-weight: 400;
}
.extra {
  display: flex;
  gap: 14px;
  margin-bottom: 14px;
}
.ex-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 14px;
}
.ex-l {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ex-v {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.quick {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.q-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
