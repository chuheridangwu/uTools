<script setup lang="ts">
/**
 * 打字练习
 * 提供英文段落与常用代码片段,实时高亮正确/错误字符,
 * 统计速度(CPM / WPM)与正确率,支持重新开始与换一段。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'

const SAMPLES = [
  'The quick brown fox jumps over the lazy dog while the sun sets slowly behind the quiet hills and the river keeps flowing to the sea.',
  'Programming is the art of telling another human what one wants the computer to do, and clarity is the most important quality of good code.',
  'In the middle of difficulty lies opportunity, so keep learning, keep building, and never be afraid to start something new today.',
  'const sum = (a, b) => a + b;\nconst list = [1, 2, 3].map((n) => n * 2);\nconsole.log(list.reduce(sum, 0));',
  'Practice makes progress, not perfection; the more you type, the faster and more accurate your fingers become over time.',
]

const idx = ref(0)
const passage = ref(SAMPLES[0])
const typed = ref('')
const started = ref(false)
const startAt = ref(0)
const elapsed = ref(0)
const inputEl = ref<HTMLTextAreaElement>()

let timer: number | null = null

const correct = computed(() => {
  let n = 0
  for (let i = 0; i < typed.value.length; i++) if (typed.value[i] === passage.value[i]) n++
  return n
})

const cpm = computed(() => (elapsed.value > 0 ? Math.round((correct.value / elapsed.value) * 60) : 0))
const wpm = computed(() => (elapsed.value > 0 ? Math.round((correct.value / 5 / elapsed.value) * 60) : 0))
const accuracy = computed(() => (typed.value.length ? Math.round((correct.value / typed.value.length) * 100) : 100))
const finished = computed(() => typed.value.length >= passage.value.length)

const chars = computed(() => {
  const out: { ch: string; cls: string }[] = []
  for (let i = 0; i < passage.value.length; i++) {
    const expected = passage.value[i]
    if (i >= typed.value.length) out.push({ ch: expected, cls: 'pending' })
    else if (typed.value[i] === expected) out.push({ ch: expected, cls: 'ok' })
    else out.push({ ch: expected, cls: 'bad' })
  }
  return out
})

function startTimer() {
  if (timer) return
  started.value = true
  startAt.value = Date.now()
  timer = window.setInterval(() => {
    elapsed.value = (Date.now() - startAt.value) / 1000
  }, 200)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function onInput() {
  if (!started.value && typed.value.length) startTimer()
  if (finished.value) stopTimer()
}

function reset(same = true) {
  typed.value = ''
  started.value = false
  elapsed.value = 0
  stopTimer()
  if (!same) {
    idx.value = (idx.value + 1) % SAMPLES.length
    passage.value = SAMPLES[idx.value]
  }
  inputEl.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    reset(true)
  }
}

watch(passage, () => {
  typed.value = ''
})

onBeforeUnmount(stopTimer)

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
</script>

<template>
  <div class="tt">
    <div class="head">
      <div>
        <h3 class="title">打字练习</h3>
        <p class="sub">开始输入即计时,实时统计速度与正确率;按 Tab 可重来</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="Refresh" @click="reset(true)">重来</el-button>
        <el-button size="small" @click="reset(false)">换一段</el-button>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><div class="ml">速度 CPM</div><div class="mv">{{ cpm }}</div></div>
      <div class="metric"><div class="ml">词/分 WPM</div><div class="mv">{{ wpm }}</div></div>
      <div class="metric"><div class="ml">正确率</div><div class="mv" :style="{ color: accuracy < 90 ? '#ef4444' : '#16a34a' }">{{ accuracy }}%</div></div>
      <div class="metric"><div class="ml">用时</div><div class="mv">{{ fmtTime(elapsed) }}</div></div>
    </div>

    <div class="passage" :class="{ finished }">
      <span v-for="(c, i) in chars" :key="i" class="ch" :class="c.cls">{{ c.ch === '\n' ? '↵\n' : c.ch }}</span>
    </div>

    <textarea
      ref="inputEl"
      v-model="typed"
      class="typing-area"
      placeholder="在此处开始输入上面的文字…"
      spellcheck="false"
      :disabled="finished"
      @input="onInput"
      @keydown="onKeydown"
    />

    <div v-if="finished" class="done">
      🎉 完成!速度 {{ wpm }} WPM · 正确率 {{ accuracy }}% · 用时 {{ fmtTime(elapsed) }}
      <el-button size="small" type="primary" @click="reset(false)">下一段</el-button>
    </div>
  </div>
</template>

<style scoped>
.tt {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
  gap: 8px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
@media (max-width: 640px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
.metric {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 14px;
  text-align: center;
}
.ml {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.mv {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.passage {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
  font-size: 17px;
  line-height: 2;
  letter-spacing: 0.4px;
  font-family: ui-monospace, Menlo, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 12px;
  max-height: 220px;
  overflow: auto;
}
.passage.finished {
  border-color: #16a34a;
}
.ch.ok {
  color: #16a34a;
}
.ch.bad {
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 18%, transparent);
  border-radius: 3px;
}
.ch.pending {
  color: var(--el-text-color-secondary);
}
.typing-area {
  width: 100%;
  min-height: 110px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  line-height: 1.8;
  font-family: ui-monospace, Menlo, monospace;
  resize: vertical;
  outline: none;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
.typing-area:focus {
  border-color: var(--el-color-primary);
}
.done {
  margin-top: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
