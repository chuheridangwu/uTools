<script setup lang="ts">
/**
 * 翻译工具
 * 基于 MyMemory 免费翻译 API(https://api.mymemory.translated.net)。
 * 说明:该接口不支持 auto 检测,这里用启发式规则(CJK 占比高 → zh-CN,否则 en)做自动识别。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
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

/** 启发式语种检测:中文字符占比超过 10% 认为是中文,日文假名优先 */
function detectLang(s: string): string {
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(s)) return 'ja'
  if (/[\uac00-\ud7af]/.test(s)) return 'ko'
  if (/[\u4e00-\u9fff]/.test(s)) return 'zh-CN'
  if (/[\u0400-\u04ff]/.test(s)) return 'ru'
  return 'en'
}

async function translate() {
  if (!input.value.trim()) {
    ElMessage.warning('请输入要翻译的内容')
    return
  }
  const src = from.value === 'auto' ? detectLang(input.value) : from.value
  if (src === to.value) {
    ElMessage.info('源语种与目标语种相同')
    return
  }
  loading.value = true
  result.value = ''
  try {
    const u = new URL('https://api.mymemory.translated.net/get')
    u.searchParams.set('q', input.value)
    u.searchParams.set('langpair', `${src}|${to.value}`)
    const r = await fetch(u.toString())
    const j = await r.json()
    if (j.responseStatus === 200) {
      result.value = j.responseData.translatedText
      detectedLabel.value = LANGS.find((l) => l.code === src)?.label ?? src
    } else {
      result.value = `翻译失败: ${j.responseDetails ?? '未知错误'}`
    }
  } catch (e) {
    result.value = `请求失败: ${(e as Error).message}`
  } finally {
    loading.value = false
  }
}

/** 互换源/目标语种并把结果放进输入框 */
function swap() {
  if (from.value === 'auto') return
  const f = from.value
  from.value = to.value
  to.value = f
  if (result.value) {
    input.value = result.value
    result.value = ''
  }
}

function clearAll() {
  input.value = ''
  result.value = ''
}
</script>

<template>
  <ToolPage>
    <template #title>翻译工具</template>
    <template #desc>基于 MyMemory 免费接口的多语言互译;“自动检测”用好文启发式规则(中/日/韩/俄/英)。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <div class="langrow">
            <el-select v-model="from" size="small" style="width: 120px">
              <el-option label="自动检测" value="auto" />
              <el-option v-for="l in LANGS" :key="l.code" :value="l.code" :label="l.label" />
            </el-select>
            <el-button size="small" icon="Refresh" circle @click="swap" :disabled="from === 'auto'" />
            <el-select v-model="to" size="small" style="width: 120px">
              <el-option v-for="l in LANGS" :key="l.code" :value="l.code" :label="l.label" />
            </el-select>
          </div>
          <el-button size="small" @click="clearAll">清空</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-input v-model="input" type="textarea" :rows="8" class="mono" placeholder="要翻译的文本…" />
          <div class="btns">
            <el-button type="primary" :loading="loading" @click="translate">翻译</el-button>
            <span v-if="detectedLabel" class="muted small">已识别源语种: {{ detectedLabel }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="out mono">{{ result || '翻译结果…' }}</div>
          <div class="btns">
            <el-button size="small" :disabled="!result" @click="copyText(result)">复制结果</el-button>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-alert class="mt8" type="info" :closable="false">
      <template #title>说明</template>
      免费接口 MyMemory 支持常用语种互译,单次最长约 500 字符,网络请求在浏览器内直接完成。
    </el-alert>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.langrow { display: flex; align-items: center; gap: 8px; }
.btns { margin-top: 8px; display: flex; align-items: center; gap: 12px; }
.out { padding: 10px 12px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--el-fill-color-lighter); min-height: 180px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.small { font-size: 12px; }
</style>
