<script setup lang="ts">
/**
 * 密码生成器
 * 使用 crypto.getRandomValues 生成强随机密码,可自定义长度与字符集,
 * 支持排除易混淆字符、批量生成、强度评估与口令短语模式。
 */
import { computed, ref } from 'vue'
import { CopyDocument, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const mode = ref<'random' | 'phrase'>('random')
const length = ref(16)
const upper = ref(true)
const lower = ref(true)
const digits = ref(true)
const symbols = ref(true)
const excludeAmbiguous = ref(true)
const count = ref(5)
const passwords = ref<string[]>([])

const WORDS = [
  'apple', 'river', 'cloud', 'stone', 'tiger', 'music', 'piano', 'candle', 'garden', 'silver',
  'orange', 'pencil', 'rocket', 'summer', 'winter', 'forest', 'marble', 'planet', 'shadow', 'coffee',
  'banana', 'dragon', 'flower', 'guitar', 'hammer', 'island', 'jungle', 'knight', 'ladder', 'magnet',
  'napkin', 'ocean', 'pepper', 'quartz', 'rabbit', 'sunset', 'tunnel', 'umbrella', 'valley', 'wizard',
]

function rand(n: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

function pick(chars: string): string {
  return chars[rand(chars.length)]
}

function charset(): string {
  let s = ''
  if (upper.value) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (lower.value) s += 'abcdefghijklmnopqrstuvwxyz'
  if (digits.value) s += '0123456789'
  if (symbols.value) s += '!@#$%^&*()-_=+[]{};:,.<>?'
  if (excludeAmbiguous.value) s = s.replace(/[Il1O0o]/g, '')
  return s
}

function generateOne(): string {
  if (mode.value === 'phrase') {
    const n = Math.max(3, Math.min(8, Math.round(length.value / 5)))
    const words: string[] = []
    for (let i = 0; i < n; i++) words.push(WORDS[rand(WORDS.length)])
    const sep = symbols.value ? '-' : ''
    let p = words.join(sep || '-')
    if (digits.value) p += String(rand(90) + 10)
    return p
  }
  const cs = charset()
  if (!cs) return ''
  // 保证每类至少一个
  const strip = (s: string, re: RegExp) => (excludeAmbiguous.value ? s.replace(re, '') : s)
  const pools: string[] = []
  if (upper.value) pools.push(strip('ABCDEFGHIJKLMNOPQRSTUVWXYZ', /[IO]/g))
  if (lower.value) pools.push(strip('abcdefghijklmnopqrstuvwxyz', /[lo]/g))
  if (digits.value) pools.push(strip('0123456789', /[01]/g))
  if (symbols.value) pools.push('!@#$%^&*()-_=+[]{};:,.<>?')
  const arr: string[] = []
  for (const p of pools) if (p) arr.push(pick(p))
  while (arr.length < length.value) arr.push(pick(cs))
  // 洗牌
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, length.value).join('')
}

function generate() {
  const list: string[] = []
  for (let i = 0; i < count.value; i++) {
    const p = generateOne()
    if (!p) break
    list.push(p)
  }
  passwords.value = list
}

const strength = computed(() => {
  const p = passwords.value[0] || ''
  if (!p) return { text: '—', color: '#94a3b8', pct: 0 }
  let pool = 0
  if (/[a-z]/.test(p)) pool += 26
  if (/[A-Z]/.test(p)) pool += 26
  if (/[0-9]/.test(p)) pool += 10
  if (/[^a-zA-Z0-9]/.test(p)) pool += 20
  const bits = Math.round(p.length * Math.log2(Math.max(pool, 2)))
  if (bits >= 128) return { text: `极强 · 约 ${bits} bit`, color: '#16a34a', pct: 100 }
  if (bits >= 80) return { text: `很强 · 约 ${bits} bit`, color: '#22c55e', pct: 80 }
  if (bits >= 60) return { text: `较强 · 约 ${bits} bit`, color: '#84cc16', pct: 60 }
  if (bits >= 40) return { text: `一般 · 约 ${bits} bit`, color: '#f59e0b', pct: 40 }
  return { text: `偏弱 · 约 ${bits} bit`, color: '#ef4444', pct: 20 }
})

async function copyOne(p: string) {
  await copyText(p)
  ElMessage.success('已复制')
}

async function copyAll() {
  await copyText(passwords.value.join('\n'))
  ElMessage.success('已复制全部')
}

// 首次进入自动生成
generate()
</script>

<template>
  <div class="pw">
    <div class="head">
      <div>
        <h3 class="title">密码生成器</h3>
        <p class="sub">基于 Web Crypto 的强随机密码,任何内容都不会离开本机</p>
      </div>
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="random">随机密码</el-radio-button>
        <el-radio-button value="phrase">口令短语</el-radio-button>
      </el-radio-group>
    </div>

    <div class="panel">
      <div class="row">
        <span class="label">{{ mode === 'phrase' ? '短语长度(示意)' : '密码长度' }}</span>
        <el-slider v-model="length" :min="6" :max="64" show-input />
      </div>
      <div class="row">
        <span class="label">生成数量</span>
        <el-input-number v-model="count" :min="1" :max="20" />
      </div>
      <div class="opts">
        <el-checkbox v-model="upper">大写字母</el-checkbox>
        <el-checkbox v-model="lower">小写字母</el-checkbox>
        <el-checkbox v-model="digits">数字</el-checkbox>
        <el-checkbox v-model="symbols">符号</el-checkbox>
        <el-checkbox v-model="excludeAmbiguous">排除易混淆 (I l 1 O 0)</el-checkbox>
      </div>
      <div class="acts">
        <el-button type="primary" :icon="Refresh" @click="generate">生成</el-button>
        <el-button :icon="CopyDocument" @click="copyAll">复制全部</el-button>
      </div>
      <div class="strength">
        <div class="s-bar">
          <div class="s-fill" :style="{ width: strength.pct + '%', background: strength.color }" />
        </div>
        <span class="s-text" :style="{ color: strength.color }">{{ strength.text }}</span>
      </div>
    </div>

    <div class="list">
      <div v-for="(p, i) in passwords" :key="i" class="item" @click="copyOne(p)">
        <span class="idx">{{ i + 1 }}</span>
        <code class="pw-text">{{ p }}</code>
        <el-icon class="copy"><CopyDocument /></el-icon>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pw {
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
  gap: 14px;
}
.row .label {
  width: 130px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: none;
}
.opts {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.acts {
  display: flex;
  gap: 10px;
}
.strength {
  display: flex;
  align-items: center;
  gap: 10px;
}
.s-bar {
  flex: 1;
  height: 8px;
  border-radius: 5px;
  background: var(--el-fill-color);
  overflow: hidden;
}
.s-fill {
  height: 100%;
  transition: width 0.3s, background 0.3s;
}
.s-text {
  font-size: 12px;
  white-space: nowrap;
}
.list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.item:hover {
  border-color: var(--el-color-primary);
}
.idx {
  width: 20px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex: none;
}
.pw-text {
  flex: 1;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 15px;
  word-break: break-all;
  color: var(--el-text-color-primary);
}
.copy {
  color: var(--el-text-color-placeholder);
  flex: none;
}
</style>
