<script setup lang="ts">
/**
 * 科学计算器
 * 自带表达式解析器(递归下降,不使用 eval),支持四则运算、乘方、取模、
 * 括号、阶乘、三角函数、对数与常数 π/e,带历史记录。
 */
import { ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'

const expr = ref('')
const display = ref('0')
const history = ref<{ expr: string; result: string }[]>([])
const angleMode = ref<'deg' | 'rad'>('rad')

/* ------------------------------ 表达式求值 ------------------------------ */
function tokenize(src: string): string[] {
  const s = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/\s+/g, '')
  const tokens: string[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let num = ''
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++]
      tokens.push(num)
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = ''
      while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++]
      tokens.push(name)
      continue
    }
    if ('+-*/%^()!'.includes(c)) {
      tokens.push(c)
      i++
      continue
    }
    throw new Error('非法字符: ' + c)
  }
  return tokens
}

const FUNCS: Record<string, (x: number) => number> = {
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  sqrt: (x) => Math.sqrt(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  abs: (x) => Math.abs(x),
  exp: (x) => Math.exp(x),
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

function evaluate(source: string, deg: boolean): number {
  const tokens = tokenize(source)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  const toAngle = (v: number) => (deg ? (v * Math.PI) / 180 : v)
  const fromAngle = (v: number) => (deg ? (v * 180) / Math.PI : v)

  function parseExpr(): number {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  function parseTerm(): number {
    let v = parseUnary()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next()
      const r = parseUnary()
      if (op === '*') v *= r
      else if (op === '/') v /= r
      else v %= r
    }
    return v
  }

  function parseUnary(): number {
    if (peek() === '-') {
      next()
      return -parseUnary()
    }
    if (peek() === '+') {
      next()
      return parseUnary()
    }
    return parsePower()
  }

  function parsePower(): number {
    const base = parsePostfix()
    if (peek() === '^') {
      next()
      const exp = parseUnary()
      return base ** exp
    }
    return base
  }

  function parsePostfix(): number {
    let v = parsePrimary()
    while (peek() === '!') {
      next()
      v = factorial(v)
    }
    return v
  }

  function parsePrimary(): number {
    const t = next()
    if (t === undefined) throw new Error('表达式不完整')
    if (t === '(') {
      const v = parseExpr()
      if (next() !== ')') throw new Error('缺少右括号')
      return v
    }
    if (/^[0-9.]+$/.test(t)) return Number(t)
    if (t in CONSTS) return CONSTS[t]
    if (t in FUNCS) {
      if (next() !== '(') throw new Error('函数后需要括号')
      const v = parseExpr()
      if (next() !== ')') throw new Error('缺少右括号')
      if (t === 'sin' || t === 'cos' || t === 'tan') return FUNCS[t](toAngle(v))
      if (t === 'asin' || t === 'acos' || t === 'atan') return fromAngle(FUNCS[t](v))
      return FUNCS[t](v)
    }
    throw new Error('未知符号: ' + t)
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new Error('表达式有误')
  return result
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error('阶乘仅支持非负整数')
  if (n > 170) return Infinity
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/* ------------------------------ 交互 ------------------------------ */
function input(tok: string) {
  expr.value += tok
  updatePreview()
}

function updatePreview() {
  if (!expr.value) {
    display.value = '0'
    return
  }
  try {
    const v = evaluate(expr.value, angleMode.value === 'deg')
    display.value = Number.isFinite(v) ? String(round(v)) : '错误'
  } catch {
    display.value = '…'
  }
}

function round(v: number): number {
  if (Number.isInteger(v)) return v
  return Number(v.toPrecision(12))
}

function equals() {
  if (!expr.value) return
  try {
    const v = evaluate(expr.value, angleMode.value === 'deg')
    const res = String(round(v))
    history.value.unshift({ expr: expr.value, result: res })
    if (history.value.length > 20) history.value.length = 20
    display.value = res
    expr.value = res
  } catch (e) {
    display.value = '错误'
    expr.value = ''
    void e
  }
}

function clearAll() {
  expr.value = ''
  display.value = '0'
}

function backspace() {
  expr.value = expr.value.slice(0, -1)
  updatePreview()
}

function useHistory(r: string) {
  expr.value = r
  updatePreview()
}

const KEYS: { label: string; ins: string; cls?: string }[][] = [
  [{ label: 'C', ins: '', cls: 'fn' }, { label: '⌫', ins: '', cls: 'fn' }, { label: '(', ins: '(' }, { label: ')', ins: ')' }, { label: '÷', ins: '/' }],
  [{ label: 'sin', ins: 'sin(', cls: 'fn' }, { label: 'cos', ins: 'cos(', cls: 'fn' }, { label: 'tan', ins: 'tan(', cls: 'fn' }, { label: '^', ins: '^' }, { label: '×', ins: '*' }],
  [{ label: '√', ins: 'sqrt(', cls: 'fn' }, { label: 'ln', ins: 'ln(', cls: 'fn' }, { label: 'log', ins: 'log(', cls: 'fn' }, { label: '!', ins: '!' }, { label: '−', ins: '-' }],
  [{ label: '7', ins: '7' }, { label: '8', ins: '8' }, { label: '9', ins: '9' }, { label: '%', ins: '%' }, { label: '+', ins: '+' }],
  [{ label: '4', ins: '4' }, { label: '5', ins: '5' }, { label: '6', ins: '6' }, { label: 'π', ins: 'pi' }, { label: '.', ins: '.' }],
  [{ label: '1', ins: '1' }, { label: '2', ins: '2' }, { label: '3', ins: '3' }, { label: 'e', ins: 'e' }, { label: '=', ins: '=', cls: 'eq' }],
  [{ label: '0', ins: '0', cls: 'zero' }],
]

function press(k: { label: string; ins: string; cls?: string }) {
  if (k.label === 'C') return clearAll()
  if (k.label === '⌫') return backspace()
  if (k.label === '=') return equals()
  input(k.ins)
}
</script>

<template>
  <div class="calc">
    <div class="head">
      <h3 class="title">科学计算器</h3>
      <el-radio-group v-model="angleMode" size="small" @change="updatePreview">
        <el-radio-button value="rad">弧度</el-radio-button>
        <el-radio-button value="deg">角度</el-radio-button>
      </el-radio-group>
    </div>

    <div class="screen">
      <div class="expr">{{ expr || ' ' }}</div>
      <div class="result">{{ display }}</div>
    </div>

    <div class="body">
      <div class="pad">
        <div v-for="(row, ri) in KEYS" :key="ri" class="row">
          <button
            v-for="k in row"
            :key="k.label"
            class="key"
            :class="k.cls"
            @click="press(k)"
          >{{ k.label }}</button>
        </div>
      </div>

      <div class="history">
        <div class="h-head">
          历史
          <el-button text size="small" :icon="Delete" @click="history = []" />
        </div>
        <div class="h-list">
          <div v-for="(h, i) in history" :key="i" class="h-item" @click="useHistory(h.result)">
            <div class="h-expr">{{ h.expr }}</div>
            <div class="h-res">= {{ h.result }}</div>
          </div>
          <div v-if="!history.length" class="h-empty">暂无记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calc {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.screen {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  margin-bottom: 12px;
  text-align: right;
}
.expr {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  min-height: 20px;
  word-break: break-all;
  font-variant-numeric: tabular-nums;
}
.result {
  font-size: 32px;
  font-weight: 700;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}
.body {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 14px;
}
@media (max-width: 760px) {
  .body {
    grid-template-columns: 1fr;
  }
}
.row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.key {
  height: 46px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-bg-color);
  font-size: 16px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  transition: background 0.12s, transform 0.08s;
}
.key:hover {
  background: var(--el-fill-color-light);
}
.key:active {
  transform: scale(0.96);
}
.key.fn {
  font-size: 14px;
  color: #0ea5e9;
}
.key.eq {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.key.zero {
  grid-column: span 5;
}
.history {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 12px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
}
.h-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.h-list {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.h-item {
  border-bottom: 1px dashed var(--card-border);
  padding-bottom: 6px;
  cursor: pointer;
}
.h-item:hover .h-res {
  color: var(--el-color-primary);
}
.h-expr {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.h-res {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.h-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 20px 0;
}
</style>
