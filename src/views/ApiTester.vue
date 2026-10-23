<script setup lang="ts">
/**
 * API 测试器
 * 在浏览器内直接发起 HTTP 请求(GET/POST/PUT/DELETE/PATCH/HEAD),自定义请求头与 Body。
 * 显示状态码、耗时、响应头与响应体(带类型判断)。同源/跨域不受 App 代理,直接由浏览器发送。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { downloadText } from '@/utils/common'

const method = ref<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'>('GET')
const url = ref('https://httpbin.org/get')
const headersText = ref('{"Accept":"application/json"}')
const bodyText = ref('')

const loading = ref(false)
interface Resp {
  status: number
  statusText: string
  timeMs: number
  headers: Record<string, string>
  body: string
  sizeKb: number
}
const resp = ref<Resp | null>(null)

/** 把多行 "k: v" 形式的 Headers 文本转为对象 */
function parseHeaders(): Record<string, string> {
  if (!headersText.value.trim()) return {}
  try {
    const o = JSON.parse(headersText.value)
    return typeof o === 'object' && o !== null ? (o as Record<string, string>) : {}
  } catch {
    // 用 "key: value" 文本格式解析
    const out: Record<string, string> = {}
    headersText.value.split('\n').forEach((l) => {
      const i = l.indexOf(':')
      if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
    })
    return out
  }
}

function pickColor(s: number) {
  if (s >= 500) return 'red'
  if (s >= 400) return 'orange'
  if (s >= 300) return 'blue'
  if (s >= 200) return 'green'
  return 'info'
}

let abort: AbortController | null = null

async function send() {
  if (!url.value.startsWith('http')) {
    ElMessage.warning('URL 需以 http:// 或 https:// 开头')
    return
  }
  loading.value = true
  abort = new AbortController()
  const t0 = performance.now()
  try {
    const opts: RequestInit = {
      method: method.value,
      headers: parseHeaders(),
      signal: abort.signal,
    }
    if (bodyText.value && method.value !== 'GET' && method.value !== 'HEAD') opts.body = bodyText.value
    const r = await fetch(url.value, opts)
    const body = await r.text()
    resp.value = {
      status: r.status,
      statusText: r.statusText,
      timeMs: Math.round(performance.now() - t0),
      headers: Object.fromEntries(r.headers.entries()),
      body,
      sizeKb: Math.round((body.length / 1024) * 100) / 100,
    }
  } catch (e) {
    const err = e as Error
    resp.value = {
      status: 0,
      statusText: err.name === 'AbortError' ? '请求已取消' : `网络错误: ${err.message}`,
      timeMs: Math.round(performance.now() - t0),
      headers: {},
      body: '',
      sizeKb: 0,
    }
  } finally {
    loading.value = false
  }
}

function cancel() {
  abort?.abort()
}
</script>

<template>
  <ToolPage>
    <template #title>API 测试器</template>
    <template #desc>浏览器内直接发送 HTTP 请求,查看状态码、耗时与响应体,支持请求头与 Body 自定义。</template>

    <el-card shadow="never">
      <template #header>请求</template>

      <div class="urlrow">
        <el-select v-model="method" style="width: 120px">
          <el-option v-for="m in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']" :key="m" :value="m" :label="m" />
        </el-select>
        <el-input v-model="url" class="mono" placeholder="https://api.example.com/xxx">
          <template #append>
            <el-button v-if="!loading" size="small" type="primary" @click="send">发送</el-button>
            <el-button v-else size="small" @click="cancel">取消</el-button>
          </template>
        </el-input>
      </div>

      <div class="mt8 grid2">
        <div>
          <div class="lab">请求头(JSON 或 "k: v" 每行)</div>
          <el-input v-model="headersText" type="textarea" :rows="4" class="mono" />
        </div>
        <div>
          <div class="lab">请求 Body(仅 POST/PUT 等生效)</div>
          <el-input v-model="bodyText" type="textarea" :rows="4" class="mono" placeholder='{"key":"value"}' />
        </div>
      </div>
    </el-card>

    <el-card v-if="resp" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>响应</span>
          <div class="chips">
            <el-tag size="small" :type="pickColor(resp.status)">状态: {{ resp.status || '—' }} {{ resp.statusText }}</el-tag>
            <el-tag size="small" type="info">耗时: {{ resp.timeMs }} ms</el-tag>
            <el-tag size="small" type="info">大小: {{ resp.sizeKb }} KB</el-tag>
            <el-button size="small" @click="downloadText('resp.txt', resp?.body ?? '')">导出</el-button>
          </div>
        </div>
      </template>

      <div class="lab">响应头(部分)</div>
      <div class="hd mono">
        <div v-for="(v, k) in resp.headers" :key="k"><b>{{ k }}</b>: {{ v }}</div>
        <div v-if="!Object.keys(resp.headers).length" class="muted">(未获取)</div>
      </div>

      <div class="lab" style="margin-top: 12px">响应体</div>
      <div class="bd mono">{{ resp.body || '(空)' }}</div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.chips { display: flex; gap: 8px; align-items: center; }
.urlrow { display: flex; gap: 8px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.hd { background: var(--el-fill-color-lighter); border-radius: 8px; padding: 8px 12px; font-size: 12px; }
.bd { background: var(--el-fill-color-lighter); border-radius: 8px; padding: 10px 12px; font-size: 12.5px; max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
</style>
