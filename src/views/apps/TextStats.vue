<script setup lang="ts">
/**
 * 文本统计
 * 实时统计字符数(含/不含空格)、中英文词数、行数、段落数、
 * 预计阅读时长,并列出词频 TOP,方便写作与校对。
 */
import { computed, ref } from 'vue'
import { Delete, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const text = ref('')

const chars = computed(() => text.value.length)
const charsNoSpace = computed(() => text.value.replace(/\s/g, '').length)
const charsNoPunct = computed(() => text.value.replace(/[\s\p{P}]/gu, '').length)

const cjkCount = computed(() => (text.value.match(/[\u4e00-\u9fa5]/g) || []).length)
const letters = computed(() => (text.value.match(/[A-Za-z]+/g) || []).length)
const words = computed(() => {
  const en = (text.value.match(/[A-Za-z0-9]+/g) || []).length
  return cjkCount.value + en
})
const lines = computed(() => (text.value === '' ? 0 : text.value.split(/\r?\n/).length))
const paragraphs = computed(() => text.value.split(/\n\s*\n/).filter((p) => p.trim()).length)

const readingTime = computed(() => {
  // 中文 300 字/分,英文 200 词/分
  const min = cjkCount.value / 300 + letters.value / 200
  if (min < 1 / 60) return '0 秒'
  if (min < 1) return Math.round(min * 60) + ' 秒'
  return min.toFixed(1) + ' 分钟'
})

const topWords = computed(() => {
  const map = new Map<string, number>()
  // 英文词
  for (const w of text.value.toLowerCase().match(/[a-z]{2,}/g) || []) map.set(w, (map.get(w) || 0) + 1)
  // 中文二字词(简单按连续汉字切片)
  const cjk = text.value.match(/[\u4e00-\u9fa5]{2,}/g) || []
  for (const seg of cjk) {
    for (let i = 0; i + 1 < seg.length; i++) {
      const w = seg.slice(i, i + 2)
      map.set(w, (map.get(w) || 0) + 1)
    }
  }
  return [...map.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 24)
})

async function copy() {
  await copyText(text.value)
  ElMessage.success('已复制全文')
}

const METRICS = computed(() => [
  { l: '字符(含空格)', v: chars.value },
  { l: '字符(不含空格)', v: charsNoSpace.value },
  { l: '字符(不含标点)', v: charsNoPunct.value },
  { l: '中文字数', v: cjkCount.value },
  { l: '英文词数', v: letters.value },
  { l: '总词数', v: words.value },
  { l: '行数', v: lines.value },
  { l: '段落数', v: paragraphs.value },
])
</script>

<template>
  <div class="ts">
    <div class="head">
      <div>
        <h3 class="title">文本统计</h3>
        <p class="sub">实时统计字数、词数、行数与阅读时长</p>
      </div>
      <div class="acts">
        <span class="rt">预计阅读 {{ readingTime }}</span>
        <el-button size="small" :icon="CopyDocument" @click="copy">复制全文</el-button>
        <el-button size="small" :icon="Delete" @click="text = ''">清空</el-button>
      </div>
    </div>

    <el-input v-model="text" type="textarea" :rows="10" placeholder="在此粘贴或输入文本,统计结果实时更新…" resize="vertical" />

    <div class="metrics">
      <div v-for="m in METRICS" :key="m.l" class="metric">
        <div class="m-v">{{ m.v.toLocaleString() }}</div>
        <div class="m-l">{{ m.l }}</div>
      </div>
    </div>

    <div class="freq">
      <div class="f-title">高频词 (出现 ≥ 2 次)</div>
      <div class="chips">
        <span v-for="([w, c]) in topWords" :key="w" class="chip">{{ w }} <b>{{ c }}</b></span>
        <span v-if="!topWords.length" class="chip-empty">暂无可统计的高频词</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ts {
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
  align-items: center;
  gap: 8px;
}
.rt {
  font-size: 12px;
  color: #14b8a6;
  margin-right: 4px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 14px;
}
@media (max-width: 640px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
.metric {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 14px;
  text-align: center;
}
.m-v {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.m-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.freq {
  margin-top: 18px;
}
.f-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}
.chip b {
  color: #6366f1;
  margin-left: 2px;
}
.chip-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
