<script setup lang="ts">
/**
 * 摩斯密码
 * 文本 ↔ 摩斯电码双向转换,支持字母数字与常用标点,
 * 可播放短点/长划提示音,并展示对照表。
 */
import { computed, ref } from 'vue'
import { CopyDocument, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', "'": '.----.', '"': '.-..-.',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.',
  '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '@': '.--.-.', '$': '...-..-',
}
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

const mode = ref<'t2m' | 'm2t'>('t2m')
const input = ref('SOS HELLO')
const sound = ref(false)

const output = computed(() => {
  if (mode.value === 't2m') {
    return input.value
      .toUpperCase()
      .split('')
      .map((ch) => {
        if (ch === ' ') return '/'
        if (ch === '\n') return '\n'
        return MORSE[ch] ?? '?'
      })
      .join(' ')
      .replace(/\s+\/\s+/g, ' / ')
      .trim()
  }
  return input.value
    .trim()
    .split(/\s+/)
    .map((code) => {
      if (code === '/') return ' '
      return REVERSE[code] ?? '?'
    })
    .join('')
})

function swap() {
  mode.value = mode.value === 't2m' ? 'm2t' : 't2m'
  input.value = output.value
}

async function copy() {
  if (!output.value) return
  await copyText(output.value)
  ElMessage.success('已复制')
}

let audioCtx: AudioContext | null = null
function beep(duration: number, when: number) {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  osc.frequency.value = 640
  osc.type = 'sine'
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.3, when + 0.01)
  g.gain.setValueAtTime(0.3, when + duration - 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(g).connect(audioCtx.destination)
  osc.start(when)
  osc.stop(when + duration + 0.02)
}

function play() {
  const code = (mode.value === 't2m' ? output.value : '').trim()
  if (!code) {
    ElMessage.info('请先输入文本生成摩斯电码')
    return
  }
  if (!audioCtx) audioCtx = new AudioContext()
  void audioCtx.resume()
  const unit = 0.09
  let t = audioCtx.currentTime + 0.1
  const tokens = code.split(' ')
  for (const tok of tokens) {
    if (tok === '/' || tok === '') {
      t += unit * 4
      continue
    }
    for (const s of tok) {
      const d = s === '-' ? unit * 3 : unit
      beep(d, t)
      t += d + unit
    }
    t += unit * 2
  }
}

const table = Object.entries(MORSE).filter(([k]) => /[A-Z0-9]/.test(k))
</script>

<template>
  <div class="mo">
    <div class="head">
      <div>
        <h3 class="title">摩斯密码</h3>
        <p class="sub">文本与摩斯电码双向转换,支持字母、数字与常用标点</p>
      </div>
      <div class="acts">
        <el-button size="small" @click="swap">⇄ 切换方向</el-button>
        <el-switch v-model="sound" active-text="提示音" />
        <el-button size="small" type="primary" :icon="VideoPlay" @click="play">播放</el-button>
      </div>
    </div>

    <div class="cols">
      <div class="side">
        <div class="s-label">{{ mode === 't2m' ? '文本' : '摩斯电码' }}</div>
        <el-input v-model="input" type="textarea" :rows="8" :placeholder="mode === 't2m' ? '输入文本,如 SOS' : '输入摩斯电码,字母间用空格,单词间用 /'" />
      </div>
      <div class="side">
        <div class="s-label">
          {{ mode === 't2m' ? '摩斯电码' : '文本' }}
          <el-icon class="cp" @click="copy"><CopyDocument /></el-icon>
        </div>
        <div class="out mono">{{ output || '—' }}</div>
      </div>
    </div>

    <details class="table-wrap">
      <summary>摩斯电码对照表</summary>
      <div class="table">
        <div v-for="([k, v]) in table" :key="k" class="cell">
          <span class="cell-k">{{ k }}</span>
          <span class="cell-v mono">{{ v }}</span>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.mo {
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
.acts {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 720px) {
  .cols {
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
  font-size: 15px;
  line-height: 1.9;
  word-break: break-all;
  letter-spacing: 1px;
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
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 6px;
}
.cell {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 5px 10px;
}
.cell-k {
  font-weight: 700;
  font-size: 13px;
  width: 16px;
}
.cell-v {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.mono {
  font-family: ui-monospace, Menlo, monospace;
}
</style>
