<script setup lang="ts">
/**
 * 文本统计工具
 * 字数 / 字符数 / 行数 / 词数 / 字节大小,附中英 Russo 词分词说明。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const text = ref(`自然语言处理(NLP)是人工智能领域的重要分支。
A tokenization demo here. Second line.`)

const charCount = computed(() => text.value.length)
const cnCount = computed(() => (text.value.match(/[\u4e00-\u9fa5]/g) || []).length)
const enWordCount = computed(() => {
  const m = text.value.match(/[a-zA-Z]+(?:['’-][a-zA-Z]+)*/g)
  return m ? m.length : 0
})
const commas = computed(() => (text.value.match(/[,，]/g) || []).length)
const periods = computed(() => (text.value.match(/[.。!?!?]/g) || []).length)
const lines = computed(() => text.value.split('\n').filter((l) => l.trim() !== '').length)
const bytes = computed(() => new TextEncoder().encode(text.value).length)
/** 中文语义上字数 = 汉字数 + 英文单词数 + 数字串数 */
const cnSanCount = computed(() => {
  const digits = text.value.match(/\d+/g)
  return cnCount.value + enWordCount.value + (digits ? digits.length : 0)
})

const listItems = computed(() => [
  { name: '字符数(含空白)', value: charCount.value },
  { name: '汉字数', value: cnCount.value },
  { name: '英文单词数', value: enWordCount.value },
  { name: '字数(中语义)', value: cnSanCount.value },
  { name: '行数', value: lines.value },
  { name: '标点符号数', value: commas.value + periods.value },
  { name: 'UTF-8 字节', value: bytes.value },
])

const topWords = computed(() => {
  const words = (text.value.toLowerCase().match(/[a-zA-Z]{2,}/g) || [])
  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, n]) => ({ word, n }))
})

function clearAll() {
  text.value = ''
}
</script>

<template>
  <ToolPage>
    <template #title>文本统计</template>
    <template #desc>即时统计文本字符数、汉字/英文词数、标点与字节大小;并给出高频词排行。</template>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>输入文本</span>
              <el-button size="small" @click="clearAll">清空</el-button>
            </div>
          </template>
          <el-input v-model="text" type="textarea" :rows="10" class="mono" />
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>统计概览</span>
              <el-button size="small" @click="copyText(text)">复制原文</el-button>
            </div>
          </template>
          <div class="stat-list">
            <div v-for="s in listItems" :key="s.name" class="row">
              <span class="n">{{ s.name }}</span>
              <span class="v mono">{{ s.value }}</span>
            </div>
          </div>
        </el-card>

        <div v-if="topWords.length" class="mt12">
          <div class="lab">英文高频词 Top12</div>
          <el-tag v-for="(w, i) in topWords" :key="i" size="small" class="wordtag mono">
            {{ w.word }} × {{ w.n }}
          </el-tag>
        </div>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.stat-list { display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 4px 2px; border-bottom: 1px dashed var(--card-border); font-size: 13px; }
.row .v { font-weight: 600; color: var(--el-color-primary); }
.lab { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.wordtag { margin: 0 6px 6px 0; }
</style>
