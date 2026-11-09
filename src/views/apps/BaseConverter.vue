<script setup lang="ts">
/**
 * 进制转换器
 * 在 2 / 8 / 10 / 16 进制之间实时互转,支持大整数(基于 BigInt),
 * 修改任一输入框其它进制自动更新,并可查看位宽与字节表示。
 */
import { ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const bases = [
  { radix: 2, label: '二进制', prefix: '0b' },
  { radix: 8, label: '八进制', prefix: '0o' },
  { radix: 10, label: '十进制', prefix: '' },
  { radix: 16, label: '十六进制', prefix: '0x' },
] as const

const values = ref<Record<number, string>>({ 2: '1010', 8: '12', 10: '10', 16: 'A' })
const error = ref('')

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function parseInBase(s: string, radix: number): bigint | null {
  let str = s.trim().replace(/^0[bBoOxX]/, '').replace(/[\s_]/g, '').toUpperCase()
  if (str === '') return null
  let neg = false
  if (str.startsWith('-')) { neg = true; str = str.slice(1) }
  if (str === '') return null
  let v = 0n
  const b = BigInt(radix)
  for (const ch of str) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= radix) return null
    v = v * b + BigInt(d)
  }
  return neg ? -v : v
}

function toBase(v: bigint, radix: number): string {
  if (v === 0n) return '0'
  const neg = v < 0n
  let n = neg ? -v : v
  const b = BigInt(radix)
  let out = ''
  while (n > 0n) {
    out = DIGITS[Number(n % b)] + out
    n /= b
  }
  return (neg ? '-' : '') + out
}

function updateFrom(radix: number, raw: string) {
  if (raw.trim() === '') {
    values.value = { 2: '', 8: '', 10: '', 16: '' }
    error.value = ''
    return
  }
  const v = parseInBase(raw, radix)
  if (v === null) {
    error.value = `不是合法的 ${bases.find((b) => b.radix === radix)?.label}`
    values.value[radix] = raw
    return
  }
  error.value = ''
  const next: Record<number, string> = { ...values.value }
  for (const b of bases) next[b.radix] = toBase(v, b.radix)
  values.value = next
}

function onInput(radix: number, value: string) {
  values.value[radix] = value
  updateFrom(radix, value)
}

async function copy(v: string) {
  if (!v) return
  await copyText(v)
  ElMessage.success('已复制')
}

/** 位宽与字节 */
const bigint = () => {
  const v = parseInBase(values.value[10] || '0', 10)
  return v ?? 0n
}
function bitInfo(): { bits: number; hexBytes: string } {
  const v = bigint()
  const abs = v < 0n ? -v : v
  const bits = abs === 0n ? 1 : abs.toString(2).length
  const byteLen = Math.max(1, Math.ceil(bits / 8))
  let hex = abs.toString(16).toUpperCase().padStart(byteLen * 2, '0')
  hex = hex.match(/../g)?.join(' ') ?? hex
  if (v < 0n) hex = '-' + hex
  return { bits, hexBytes: hex }
}
</script>

<template>
  <div class="bc">
    <div class="head">
      <div>
        <h3 class="title">进制转换器</h3>
        <p class="sub">2 / 8 / 10 / 16 进制实时互转,支持大整数</p>
      </div>
    </div>

    <div class="rows">
      <div v-for="b in bases" :key="b.radix" class="row">
        <span class="label">{{ b.label }}<small>({{ b.radix }})</small></span>
        <el-input
          :model-value="values[b.radix]"
          :placeholder="`输入 ${b.label}`"
          class="inp"
          spellcheck="false"
          @input="onInput(b.radix, $event)"
        >
          <template #prepend v-if="b.prefix">{{ b.prefix }}</template>
        </el-input>
        <el-button text :icon="CopyDocument" @click="copy(values[b.radix])" />
      </div>
    </div>

    <div v-if="error" class="err">{{ error }}</div>

    <div class="info">
      <div class="info-item"><span class="i-l">二进制位宽</span><span class="i-v">{{ bitInfo().bits }} bit</span></div>
      <div class="info-item"><span class="i-l">字节表示 (HEX)</span><span class="i-v mono">{{ bitInfo().hexBytes }}</span></div>
    </div>

    <p class="foot">说明:使用 BigInt 计算,不受 32/64 位浮点精度限制;可处理任意长度的整数。</p>
  </div>
</template>

<style scoped>
.bc {
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
.rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.label {
  width: 96px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: none;
}
.label small {
  color: var(--el-text-color-placeholder);
}
.inp {
  flex: 1;
}
.inp :deep(input) {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 15px;
  letter-spacing: 0.5px;
}
.err {
  margin-top: 10px;
  font-size: 12px;
  color: #ef4444;
}
.info {
  display: flex;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 8px 14px;
}
.i-l {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.i-v {
  font-size: 14px;
  font-weight: 600;
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
  word-break: break-all;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
