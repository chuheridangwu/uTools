<script setup lang="ts">
/**
 * 一言卡片
 * 通过公开的「一言」接口获取随机句子,支持选择分类,
 * 生成带渐变背景的文字卡片,可复制文字或导出为图片。
 */
import { computed, onMounted, ref } from 'vue'
import { CopyDocument, Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

interface Quote {
  text: string
  from: string
  who: string
}

const CATS = [
  { key: '', label: '全部' },
  { key: 'd', label: '文学' },
  { key: 'i', label: '诗词' },
  { key: 'k', label: '哲学' },
  { key: 'j', label: '网易云' },
  { key: 'e', label: '笑话' },
  { key: 'c', label: '游戏' },
  { key: 'a', label: '动漫' },
]

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #ec4899)',
  'linear-gradient(135deg, #0ea5e9, #22d3ee)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #16a34a, #84cc16)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #0f172a, #334155)',
]

const cat = ref('')
const quote = ref<Quote>({ text: '正在获取…', from: '', who: '' })
const loading = ref(false)
const bg = ref(GRADIENTS[0])
const cardRef = ref<HTMLDivElement>()

async function fetchQuote() {
  loading.value = true
  try {
    const c = cat.value ? `?c=${cat.value}&encode=json` : '?encode=json'
    const res = await fetch('https://v1.hitokoto.cn/' + c)
    const data = await res.json()
    quote.value = { text: data.hitokoto || '', from: data.from || '', who: data.from_who || '' }
    bg.value = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]
  } catch {
    quote.value = { text: '获取失败,请检查网络后重试', from: '', who: '' }
  } finally {
    loading.value = false
  }
}

const attribution = computed(() => {
  const parts = [quote.value.who, quote.value.from].filter(Boolean)
  return parts.length ? '—— ' + parts.join('《') + (quote.value.from ? '》' : '') : ''
})

async function copy() {
  await copyText(quote.value.text + (attribution.value ? '\n' + attribution.value : ''))
  ElMessage.success('已复制')
}

function download() {
  const canvas = document.createElement('canvas')
  const W = 800
  const H = 500
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  // 背景
  const g = ctx.createLinearGradient(0, 0, W, H)
  const colors = bg.value.match(/#[0-9a-f]{6}/gi) || ['#6366f1', '#ec4899']
  g.addColorStop(0, colors[0])
  g.addColorStop(1, colors[1] || colors[0])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // 文字
  ctx.fillStyle = '#fff'
  ctx.font = '600 30px system-ui, "PingFang SC", sans-serif'
  ctx.textBaseline = 'top'
  const maxWidth = W - 120
  const chars = quote.value.text.split('')
  let line = ''
  let y = 120
  const lines: string[] = []
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  lines.push(line)
  for (const ln of lines) {
    ctx.fillText(ln, 60, y)
    y += 46
  }
  if (attribution.value) {
    ctx.font = '400 20px system-ui, "PingFang SC", sans-serif'
    ctx.globalAlpha = 0.85
    ctx.fillText(attribution.value, W - 60 - ctx.measureText(attribution.value).width, y + 20)
  }
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = 'quote.png'
  a.click()
}

onMounted(fetchQuote)
</script>

<template>
  <div class="q">
    <div class="head">
      <div>
        <h3 class="title">一言卡片</h3>
        <p class="sub">随机获取一句打动你的话,可复制或导出为图片</p>
      </div>
      <div class="acts">
        <el-select v-model="cat" size="small" style="width: 100px" @change="fetchQuote">
          <el-option v-for="c in CATS" :key="c.key" :value="c.key" :label="c.label" />
        </el-select>
        <el-button size="small" :icon="Refresh" :loading="loading" @click="fetchQuote">换一句</el-button>
      </div>
    </div>

    <div ref="cardRef" class="card" :style="{ background: bg }">
      <div class="q-text">{{ quote.text }}</div>
      <div v-if="attribution" class="q-attr">{{ attribution }}</div>
    </div>

    <div class="foot-acts">
      <el-button :icon="CopyDocument" @click="copy">复制文字</el-button>
      <el-button type="primary" :icon="Download" @click="download">导出图片</el-button>
    </div>
  </div>
</template>

<style scoped>
.q {
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
.acts {
  display: flex;
  gap: 8px;
}
.card {
  border-radius: 18px;
  min-height: 240px;
  padding: 40px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
  box-shadow: 0 12px 30px rgb(0 0 0 / 15%);
  transition: background 0.4s;
  margin-bottom: 18px;
}
.q-text {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.6;
  text-shadow: 0 1px 8px rgb(0 0 0 / 15%);
}
.q-attr {
  margin-top: 22px;
  font-size: 15px;
  opacity: 0.9;
  align-self: flex-end;
}
.foot-acts {
  display: flex;
  gap: 10px;
}
</style>
