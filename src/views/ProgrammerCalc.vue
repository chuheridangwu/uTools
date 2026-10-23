<script setup lang="ts">
/**
 * 程序员计算器
 * 基于 BigInt 的位运算/算术表达式求值,支持 BIN/OCT/DEC/HEX 四进制输入、
 * 8/16/32/64 位字长(二进制补码)以及结果的多进制联动显示。
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

type Base = 'BIN' | 'OCT' | 'DEC' | 'HEX'
const bases: Base[] = ['BIN', 'OCT', 'DEC', 'HEX']

const curBase = ref<Base>('DEC')
const expr = ref('')
const resultText = ref('')
const wordSize = ref<8 | 16 | 32 | 64>(32)

/* ─────────── 工具函数 ─────────── */

/** 按字长截断为有符号整数(二进制补码) */
function asInt(v: bigint): bigint {
  return BigInt.asIntN(wordSize.value, v)
}

/** 当前进制允许的数字字符 */
function digitPattern(base: Base): RegExp {
  return base === 'BIN' ? /^[01]+/ : base === 'OCT' ? /^[0-7]+/ : base === 'HEX' ? /^[0-9a-fA-F]+/ : /^[0-9]+/
}

/** 按当前进制把纯数字字符串解析成 BigInt */
function parseDigit(s: string): bigint {
  const t = s.toLowerCase()
  if (curBase.value === 'BIN') return BigInt('0b' + t)
  if (curBase.value === 'OCT') return BigInt('0o' + t)
  if (curBase.value === 'HEX') return BigInt('0x' + t)
  return BigInt(t)
}

/* ─────────── 表达式求值(递归下降) ─────────── */

/**
 * 优先级从低到高:`|`、`^`、`&`、移位 `<< >>`、`+ -`、`* / %`、一元 `~ -`、括号/数字。
 * 数字字面量始终按当前选定进制解析,运算结果统一按字长取补码截断。
 */

function evaluate(src: string): bigint {
  let pos = 0

  function as(v: bigint): bigint {
    return asInt(v)
  }

  function skipWs() {
    while (pos < src.length && /\s/.test(src[pos])) pos++
  }

  // lowest: bitwise OR
  function or(): bigint {
    let left = xor()
    for (;;) {
      skipWs()
      if (src[pos] === '|' && src[pos + 1] !== '|') {
        pos++
        left = as(left | xor())
      } else break
    }
    return left
  }

  function xor(): bigint {
    let left = and()
    for (;;) {
      skipWs()
      if (src[pos] === '^') {
        pos++
        left = as(left ^ and())
      } else break
    }
    return left
  }

  function and(): bigint {
    let left = shift()
    for (;;) {
      skipWs()
      if (src[pos] === '&' && src[pos + 1] !== '&') {
        pos++
        left = as(left & shift())
      } else break
    }
    return left
  }

  function shift(): bigint {
    let left = addSub()
    for (;;) {
      skipWs()
      if (src[pos] === '<' && src[pos + 1] === '<') {
        pos += 2
        left = as(left << addSub())
      } else if (src[pos] === '>' && src[pos + 1] === '>') {
        pos += 2
        // 有符号右移(补码语义)
        left = as(left >> addSub())
      } else break
    }
    return left
  }

  function addSub(): bigint {
    let left = mulDiv()
    for (;;) {
      skipWs()
      if (src[pos] === '+') {
        pos++
        left = as(left + mulDiv())
      } else if (src[pos] === '-' && src[pos + 1] !== '>') {
        pos++
        left = as(left - mulDiv())
      } else break
    }
    return left
  }

  function mulDiv(): bigint {
    let left = unary()
    for (;;) {
      skipWs()
      const c = src[pos]
      if (c === '*') {
        pos++
        left = as(left * unary())
      } else if (c === '/') {
        pos++
        const r = unary()
        if (r === 0n) throw new Error('除数为 0')
        left = as(left / r)
      } else if (c === '%') {
        pos++
        const r = unary()
        if (r === 0n) throw new Error('模数为 0')
        left = as(left % r)
      } else break
    }
    return left
  }

  function unary(): bigint {
    skipWs()
    if (src[pos] === '~') {
      pos++
      return as(~unary())
    }
    if (src[pos] === '-') {
      pos++
      return as(-unary())
    }
    if (src[pos] === '+') {
      pos++
      return as(unary())
    }
    return primary()
  }

  function primary(): bigint {
    skipWs()
    if (src[pos] === '(') {
      pos++
      const v = or()
      skipWs()
      if (src[pos] !== ')') throw new Error('缺少右括号')
      pos++
      return v
    }
    const rest = src.slice(pos)
    const m = rest.match(digitPattern(curBase.value))
    if (!m) throw new Error(`位置 ${pos + 1} 无法识别当前进制数字`)
    pos += m[0].length
    return parseDigit(m[0])
  }

  const v = or()
  skipWs()
  if (pos !== src.length) throw new Error(`位置 ${pos + 1} 有多余字符`)
  return as(v)
}

/* ─────────── 计算 ─────────── */

/** 求 expr 的值(内部都用 DEC 语义,已把数字按当前进制解析) */
function calc() {
  const src = expr.value.trim()
  if (!src) return
  try {
    const v = evaluate(src === '-' ? '0' : src)
    resultText.value = v.toString()
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
}

/* ─────────── 键盘 ─────────── */

interface KeyDef {
  label: string
  insert?: string
  action?: 'eq' | 'clear' | 'back' | 'not' | 'swap-base'
  /** 允许出现的进制;不填 = 全部 */
  only?: Base[]
  cls?: 'op' | 'fn' | 'eq'
}

const digitKeys = computed<KeyDef[]>(() => {
  const alphabet = curBase.value === 'BIN' ? '01' : curBase.value === 'OCT' ? '234567' : curBase.value === 'DEC' ? '23456789' : 'ABCDEF'
  return ['0', '1', ...alphabet.split('')].map((d) => ({ label: d, insert: d }))
})

const opKeys: KeyDef[] = [
  { label: '+', insert: '+', cls: 'op' },
  { label: '−', insert: '-', cls: 'op' },
  { label: '×', insert: '*', cls: 'op' },
  { label: '÷', insert: '/', cls: 'op' },
  { label: '%', insert: '%', cls: 'op' },
  { label: '(', insert: '(', cls: 'op' },
  { label: ')', insert: ')', cls: 'op' },
  { label: '&', insert: '&', only: ['BIN', 'HEX'], cls: 'op' },
  { label: '|', insert: '|', only: ['BIN', 'HEX'], cls: 'op' },
  { label: '^', insert: '^', only: ['BIN', 'HEX'], cls: 'op' },
  { label: '<<', insert: '<<', cls: 'op' },
  { label: '>>', insert: '>>', cls: 'op' },
  { label: '~', insert: '~', only: ['BIN', 'HEX'], cls: 'op' },
]

const funcKeys: KeyDef[] = [
  { label: 'AC', action: 'clear', cls: 'fn' },
  { label: '⌫', action: 'back', cls: 'fn' },
  { label: '=', action: 'eq', cls: 'eq' },
]

function press(k: KeyDef) {
  if (k.insert) {
    expr.value += k.insert
    return
  }
  if (k.action === 'clear') {
    expr.value = ''
    resultText.value = ''
    return
  }
  if (k.action === 'back') {
    expr.value = expr.value.slice(0, -1)
    return
  }
  if (k.action === 'eq') {
    calc()
    return
  }
}

/* ─────────── 结果多进制显示 ─────────── */

const resultRows = computed(() => {
  if (!resultText.value) return []
  const v = BigInt(resultText.value) // 求值时已按字长截断过
  const signed = BigInt.asIntN(wordSize.value, v)
  const unsigned = BigInt.asUintN(wordSize.value, v)
  const rows: Array<{ label: string; value: string }> = [
    { label: 'DEC', value: String(signed) },
    { label: 'HEX', value: '0x' + unsigned.toString(16).toUpperCase() },
    { label: 'OCT', value: '0o' + unsigned.toString(8) },
    { label: 'BIN', value: '0b' + unsigned.toString(2).padStart(wordSize.value, '0') },
    { label: 'U-DEC', value: String(unsigned) },
  ]
  return rows
})

function copyRow(r: { label: string; value: string }) {
  copyText(r.value)
  ElMessage.success(`${r.label} 已复制`)
}
</script>

<template>
  <ToolPage>
    <template #title>程序员计算器</template>
    <template #desc>基于 BigInt 的位运算/四则计算,支持四进制输入与 8/16/32/64 位字长补码,多进制联动显示结果。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>字长(补码)</span>
          <el-radio-group v-model="wordSize" size="small">
            <el-radio-button :value="8">8 位</el-radio-button>
            <el-radio-button :value="16">16 位</el-radio-button>
            <el-radio-button :value="32">32 位</el-radio-button>
            <el-radio-button :value="64">64 位</el-radio-button>
          </el-radio-group>
          <span class="muted small">数字按选定进制解析,表达式为十进制语义中转计算</span>
        </div>
      </template>

      <el-input
        v-model="resultText"
        readonly
        class="calc-out mono"
        placeholder="点击 = 求值"
      />

      <el-input v-model="expr" class="calc-in mono" placeholder="输入表达式,如 0x1F & 0x0F 为 HEX 时" @keydown.enter="calc" />

      <div class="pad">
        <!-- 进制切换 -->
        <div class="baserow">
          <el-radio-group v-model="curBase" size="small">
            <el-radio-button v-for="b in bases" :key="b" :value="b">{{ b }}</el-radio-button>
          </el-radio-group>
        </div>

        <div class="keys">
          <el-button v-for="k in opKeys" :key="k.label" class="key" :class="k.cls" :type="k.cls === 'eq' ? 'primary' : 'default'" :disabled="k.only && !k.only.includes(curBase)" @click="press(k)">{{ k.label }}</el-button>
          <el-button v-for="k in digitKeys" :key="k.label" class="key" @click="press(k)">{{ k.label }}</el-button>
          <el-button v-for="k in funcKeys" :key="k.label" class="key" :class="k.cls" :type="k.action === 'eq' ? 'primary' : k.action === 'clear' ? 'danger' : 'info'" @click="press(k)">{{ k.label }}</el-button>
        </div>
      </div>

      <div v-if="resultRows.length" class="res">
        <div class="rlabel">结果(当前字长 {{ wordSize }} 位)</div>
        <div v-for="r in resultRows" :key="r.label" class="rrow" @click="copyRow(r)">
          <span class="rl mono">{{ r.label }}</span>
          <span class="rv mono">{{ r.value }}</span>
        </div>
        <div class="small muted">点击任一行复制</div>
      </div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.calc-out { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
.calc-in { margin-bottom: 10px; }
.pad { margin-top: 6px; }
.baserow { margin-bottom: 10px; }
.keys { display: flex; flex-wrap: wrap; gap: 6px; }
.key { margin: 0 !important; width: 56px; }
.key.op { --el-button-text-color: var(--el-color-primary); }
.key.fn { font-weight: 600; }
.key.eq { font-weight: 700; }
.res { margin-top: 14px; border-top: 1px solid var(--card-border); padding-top: 10px; }
.rlabel { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.rrow { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s; }
.rrow:hover { background: var(--el-fill-color-lighter); }
.rl { width: 56px; font-size: 12px; color: var(--el-text-color-secondary); }
.rv { font-size: 13px; word-break: break-all; }
</style>
