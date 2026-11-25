<script setup lang="ts">
/**
 * 翻译工具
 * 双免费源:MyMemory(主)+ LibreTranslate(mirrors 轮询,故障切换)。
 *  - 自动检测:启发式(中日韩俄英);MyMemory 不支持 auto,需先判定
 *  - 长文本:>490 字符自动按句切分逐段翻译再拼接(MyMemory 免费档限制)
 *  - 历史:localStorage 最近 30 条,可回填
 */
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete as DeleteIcon } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const LANGS = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'ru', label: '俄语' },
  { code: 'es', label: '西班牙语' },
  { code: 'pt', label: '葡萄牙语' },
  { code: 'it', label: '意大利语' },
  { code: 'th', label: '泰语' },
  { code: 'vi', label: '越南语' },
  { code: 'ar', label: '阿拉伯语' },
]

const from = ref('auto')
const to = ref('en')
const input = ref('今天也要好好干活。')
const loading = ref(false)
const result = ref('')
const detectedLabel = ref('')
const usedEngine = ref('')
/** LibreTranslate 永久公益实例多数要求 key;以下为当前可匿名访问的公开镜像,失败会自动回退 MyMemory */
const LIBRE_MIRRORS = [
  'https://translate.disroot.org',
  'https://libretranslate.com',
]

/** 启发式语种检测:假名 → 日语,谚文 → 韩语,汉字 → 中文,西里尔 → 俄语,否则英语 */
function detectLang(s: string): string {
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(s)) return 'ja'
  if (/[\uac00-\ud7af]/.test(s)) return 'ko'
  if (/[\u4e00-\u9fff]/.test(s)) return 'zh-CN'
  if (/[\u0400-\u04ff]/.test(s)) return 'ru'
  if (/[\u0600-\u06ff]/.test(s)) return 'ar'
  if (/[\u0e00-\u0e7f]/.test(s)) return 'th'
  return 'en'
}

/* --------------------------- 历史 --------------------------- */
interface HistoryItem { id: number; from: string; to: string; input: string; result: string; at: number }
const HISTORY_KEY = 'translator-history'
const history = ref<HistoryItem[]>([])
const showHistory = ref(false)

function loadHistory() {
  try {
    history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    history.value = []
  }
}
function pushHistory(item: HistoryItem) {
  history.value = [item, ...history.value.filter((h) => h.input !== item.input || h.to !== item.to)].slice(0, 30)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch { /* 满则忽略 */ }
}
function restoreHistory(h: HistoryItem) {
  from.value = h.from
  to.value = h.to
  input.value = h.input
  result.value = h.result
  showHistory.value = false
}
function clearHistory() {
  history.value = []
  localStorage.removeItem(HISTORY_KEY)
}
function fmtTime(at: number) {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* --------------------------- 分段(MyMemory 免费档 500 字符上限) --------------------------- */
/** 按句子边界切段,每段 ≤ limit 字符 */
function splitChunks(text: string, limit = 490): string[] {
  if (text.length <= limit) return [text]
  const sentences = text.split(/(?<=[。!??\.\!\?\n])/)
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if (cur.length + s.length > limit && cur) {
      chunks.push(cur)
      cur = s
    } else {
      cur += s
    }
    // 单句超限则硬切
    while (cur.length > limit) {
      chunks.push(cur.slice(0, limit))
      cur = cur.slice(limit)
    }
  }
  if (cur.trim()) chunks.push(cur)
  return chunks
}

/* --------------------------- 引擎 --------------------------- */
async function viaMyMemory(src: string, dst: string, text: string): Promise<string> {
  const u = new URL('https://api.mymemory.translated.net/get')
  u.searchParams.set('q', text)
  u.searchParams.set('langpair', `${src}|${dst}`)
  const r = await fetch(u.toString())
  const j = await r.json()
  if (j.responseStatus !== 200 || !j.responseData?.translatedText) {
    throw new Error(j.responseDetails || 'MyMemory 返回异常')
  }
  return j.responseData.translatedText as string
}

async function viaLibre(src: string, dst: string, text: string): Promise<string> {
  const srcCode = src === 'zh-CN' ? 'zh' : src
  const dstCode = dst === 'zh-CN' ? 'zh' : dst
  for (const base of LIBRE_MIRRORS) {
    try {
      const r = await fetch(`${base}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: srcCode, target: dstCode, format: 'text' }),
      })
      if (!r.ok) continue
      const j = await r.json()
      if (j.translatedText) return j.translatedText
    } catch { /* 换下一个镜像 */ }
  }
  throw new Error('LibreTranslate 不可用')
}

/** 依次尝试 LibreTranslate(质量更高)→ MyMemory(更稳),失败自动降级 */
async function translateOnce(src: string, dst: string, text: string): Promise<{ text: string; engine: string }> {
  try {
    return { text: await viaLibre(src, dst, text), engine: 'LibreTranslate' }
  } catch { /* 降级 */ }
  return { text: await viaMyMemory(src, dst, text), engine: 'MyMemory' }
}

async function translate() {
  const raw = input.value.trim()
  if (!raw) {
    ElMessage.warning('请输入要翻译的内容')
    return
  }
  const src = from.value === 'auto' ? detectLang(raw) : from.value
  if (src === to.value) {
    ElMessage.info('源语种与目标语种相同')
    return
  }
  loading.value = true
  result.value = ''
  try {
    const chunks = splitChunks(raw)
    const parts: string[] = []
    let engine = ''
    for (const c of chunks) {
      const r = await translateOnce(src, to.value, c)
      parts.push(r.text)
      engine = engine || r.engine
    }
    result.value = parts.join(' ')
    detectedLabel.value = LANGS.find((l) => l.code === src)?.label ?? src
    usedEngine.value = `${engine}${chunks.length > 1 ? ` · 已分 ${chunks.length} 段` : ''}`
    pushHistory({ id: Date.now(), from: src, to: to.value, input: raw, result: result.value, at: Date.now() })
  } catch (e) {
    result.value = `翻译失败: ${(e as Error).message}`
    usedEngine.value = ''
    ElMessage.error(result.value)
  } finally {
    loading.value = false
  }
}

/** 目标语与源语互换;自动检测时先按启发式定源 */
function swap() {
  if (from.value === 'auto') {
    // 自动检测时也可以换:把检测出的语言设为源,当前目标设为目标
    from.value = detectLang(input.value)
  }
  const f = from.value
  from.value = to.value
  to.value = f
  if (result.value && !result.value.startsWith('翻译失败')) {
    input.value = result.value
    result.value = ''
  }
}

function clearAll() {
  input.value = ''
  result.value = ''
  usedEngine.value = ''
}

onMounted(loadHistory)
</script>

<template>
  <ToolPage>
    <template #title>翻译工具</template>
    <template #desc>
      双免费引擎自动切换:LibreTranslate(质量优)→ MyMemory(更稳)。长文本自动分段,最近 30 条历史可回填。
    </template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <div class="langrow">
            <el-select v-model="from" size="small" style="width: 128px">
              <el-option label="自动检测" value="auto" />
              <el-option v-for="l in LANGS" :key="l.code" :value="l.code" :label="l.label" />
            </el-select>
            <el-button size="small" icon="Refresh" circle @click="swap" />
            <el-select v-model="to" size="small" style="width: 128px">
              <el-option v-for="l in LANGS" :key="l.code" :value="l.code" :label="l.label" />
            </el-select>
          </div>
          <div>
            <el-button size="small" @click="showHistory = !showHistory">
              历史{{ history.length ? `(${history.length})` : '' }}
            </el-button>
            <el-button size="small" @click="clearAll">清空</el-button>
          </div>
        </div>
      </template>

      <div v-if="showHistory" class="hist-box">
        <div class="hist-head">
          <span class="muted small">点击任意一条回填(源/目标/原文/译文)</span>
          <el-button size="small" text :icon="DeleteIcon" @click="clearHistory">清空历史</el-button>
        </div>
        <div v-for="h in history" :key="h.id" class="hist-item" @click="restoreHistory(h)">
          <el-tag size="small" type="info">{{ h.from }} → {{ h.to }}</el-tag>
          <span class="hist-text">{{ h.input }}</span>
          <span class="hist-text dim">{{ h.result }}</span>
          <span class="muted small" style="flex: none">{{ fmtTime(h.at) }}</span>
        </div>
        <div v-if="!history.length" class="muted small" style="padding: 6px 0">暂无历史</div>
      </div>

      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-input v-model="input" type="textarea" :rows="8" class="mono" placeholder="要翻译的文本…" />
          <div class="btns">
            <el-button type="primary" :loading="loading" @click="translate">翻译</el-button>
            <span class="muted small">({{ input.length }} 字符)</span>
            <span v-if="detectedLabel" class="muted small">源语种 {{ detectedLabel }}{{ usedEngine ? ` · ${usedEngine}` : '' }}</span>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="out mono">{{ result || '翻译结果…' }}</div>
          <div class="btns">
            <el-button size="small" :disabled="!result || result.startsWith('翻译失败')" @click="copyText(result)">复制结果</el-button>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-alert type="info" :closable="false" class="mt8">
      <template #title>引擎说明</template>
      优先走 LibreTranslate 公共镜像(语种更全),失败自动切回 MyMemory;两者都是免费公共服务,偶发限流属正常。长文本超 490 字符会按句切段逐段翻译后拼接。
    </el-alert>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.langrow { display: flex; align-items: center; gap: 8px; }
.btns { margin-top: 8px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.out { padding: 10px 12px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--el-fill-color-lighter); min-height: 180px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.small { font-size: 12px; }
.muted { color: var(--el-text-color-secondary); }
.hist-box { background: var(--el-fill-color-light); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.hist-head { display: flex; justify-content: space-between; align-items: center; }
.hist-item { display: flex; gap: 8px; align-items: center; padding: 5px 4px; cursor: pointer; border-radius: 6px; font-size: 12px; }
.hist-item:hover { background: var(--el-fill-color-lighter); }
.hist-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-text.dim { color: var(--el-text-color-secondary); max-width: 32%; }
</style>
