<script setup lang="ts">
/**
 * 文本加密
 * 提供凯撒密码、ROT13、维吉尼亚密码与埃特巴什(Atbash)等经典置换密码,
 * 支持加密与解密,仅处理英文字母,非字母字符原样保留。
 */
import { computed, reactive } from 'vue'
import { CopyDocument, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const state = reactive({
  method: 'caesar' as 'caesar' | 'rot13' | 'vigenere' | 'atbash',
  shift: 3,
  key: 'KEY',
  input: 'Hello, World!',
  reverse: false,
})

const METHODS = [
  { key: 'caesar', label: '凯撒密码', desc: '每个字母向后平移固定位数' },
  { key: 'rot13', label: 'ROT13', desc: '凯撒密码的位移 13 特例,自反' },
  { key: 'vigenere', label: '维吉尼亚密码', desc: '用关键词控制每个字母的位移' },
  { key: 'atbash', label: '埃特巴什(Atbash)', desc: '字母表首尾互换 A↔Z' },
]

function shiftChar(ch: string, n: number): string {
  const code = ch.charCodeAt(0)
  const isUpper = ch >= 'A' && ch <= 'Z'
  const isLower = ch >= 'a' && ch <= 'z'
  if (!isUpper && !isLower) return ch
  const base = isUpper ? 65 : 97
  const offset = ((code - base + (n % 26) + 26) % 26)
  return String.fromCharCode(base + offset)
}

function atbash(ch: string): string {
  const isUpper = ch >= 'A' && ch <= 'Z'
  const isLower = ch >= 'a' && ch <= 'z'
  if (!isUpper && !isLower) return ch
  const base = isUpper ? 65 : 97
  return String.fromCharCode(base + (25 - (ch.charCodeAt(0) - base)))
}

function encrypt(text: string): string {
  const dir = state.reverse ? -1 : 1
  switch (state.method) {
    case 'caesar':
      return [...text].map((c) => shiftChar(c, state.shift * dir)).join('')
    case 'rot13':
      return [...text].map((c) => shiftChar(c, 13)).join('')
    case 'atbash':
      return [...text].map(atbash).join('')
    case 'vigenere': {
      const key = state.key.replace(/[^a-zA-Z]/g, '').toUpperCase()
      if (!key) return text
      let ki = 0
      return [...text]
        .map((c) => {
          if (!/[a-zA-Z]/.test(c)) return c
          const k = key.charCodeAt(ki % key.length) - 65
          ki++
          return shiftChar(c, k * dir)
        })
        .join('')
    }
    default:
      return text
  }
}

const output = computed(() => encrypt(state.input))

async function copy() {
  await copyText(output.value)
  ElMessage.success('已复制')
}

function swap() {
  // 把结果当输入,并反转方向(对可逆密码)
  state.input = output.value
  if (state.method !== 'rot13' && state.method !== 'atbash') state.reverse = !state.reverse
}

const curMethod = computed(() => METHODS.find((m) => m.key === state.method)!)
</script>

<template>
  <div class="tc">
    <div class="head">
      <div>
        <h3 class="title">文本加密</h3>
        <p class="sub">经典置换密码:凯撒、ROT13、维吉尼亚与 Atbash</p>
      </div>
      <el-button size="small" :icon="Switch" @click="swap">结果作为输入 ⇄</el-button>
    </div>

    <div class="methods">
      <button
        v-for="m in METHODS"
        :key="m.key"
        class="method"
        :class="{ on: state.method === m.key }"
        @click="state.method = m.key as typeof state.method"
      >
        <span class="mt-name">{{ m.label }}</span>
        <span class="mt-desc">{{ m.desc }}</span>
      </button>
    </div>

    <div class="opts">
      <template v-if="state.method === 'caesar'">
        <span class="lbl">位移</span>
        <el-input-number v-model="state.shift" :min="0" :max="25" />
      </template>
      <template v-if="state.method === 'vigenere'">
        <span class="lbl">关键词</span>
        <el-input v-model="state.key" style="width: 180px" placeholder="仅字母有效" />
      </template>
      <el-checkbox v-if="state.method === 'caesar' || state.method === 'vigenere'" v-model="state.reverse">
        解密(反向位移)
      </el-checkbox>
    </div>

    <div class="pane">
      <div class="side">
        <div class="s-label">输入</div>
        <el-input v-model="state.input" type="textarea" :rows="6" placeholder="输入要处理的文本…" />
      </div>
      <div class="side">
        <div class="s-label">
          输出
          <el-icon class="cp" @click="copy"><CopyDocument /></el-icon>
        </div>
        <div class="out">{{ output || '—' }}</div>
      </div>
    </div>

    <p class="foot">
      说明:{{ curMethod.label }}——{{ curMethod.desc }};仅字母参与变换,数字、标点与中文保持原样,结果不涉及真正的安全性,仅作学习与趣味用途。
    </p>
  </div>
</template>

<style scoped>
.tc {
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
.methods {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.method {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  text-align: left;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.method.on {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.mt-name {
  font-size: 14px;
  font-weight: 600;
}
.mt-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.opts {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.pane {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 720px) {
  .pane {
    grid-template-columns: 1fr;
  }
}
.s-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cp {
  cursor: pointer;
}
.out {
  min-height: 142px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-all;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
