<script setup lang="ts">
/**
 * API 测试器
 * 在浏览器内直接发起 HTTP 请求,unsupported:
 *  - 方法 GET/POST/PUT/DELETE/PATCH/HEAD
 *  - Body 类型:none / JSON / 纯文本 / form-urlencoded / multipart(文件)
 *  - 认证快捷方式:Bearer / Basic
 *  - 请求历史(localStorage,最多 20 条,可回填)
 *  - cURL 导入(粘贴 curl 命令解析出 method/url/headers/body)
 *  - 响应体 JSON 自动高亮折叠预览 + 原始视图切换
 * 说明:同源/跨域不受 App 代理,直接由浏览器发送;受 CORS 限制的接口会提示。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete as DeleteIcon } from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { downloadText } from '@/utils/common'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'
type BodyKind = 'none' | 'json' | 'text' | 'urlencoded' | 'form'

const method = ref<Method>('GET')
const url = ref('https://httpbin.org/get')
const headersText = ref('{"Accept":"application/json"}')
const bodyKind = ref<BodyKind>('none')
const bodyText = ref('')
/** multipart 的文件列表 */
const formFiles = ref<File[]>([])
/** 认证:类型 + 凭据 */
const authType = ref<'none' | 'bearer' | 'basic'>('none')
const authToken = ref('')
const authUser = ref('')
const authPass = ref('')

const loading = ref(false)
interface Resp {
  status: number
  statusText: string
  timeMs: number
  headers: Record<string, string>
  body: string
  sizeKb: number
  /** 请求头实测发送的完整清单(回显用) */
  sentHeaders: Record<string, string>
}
const resp = ref<Resp | null>(null)

/* --------------------------- 请求历史 --------------------------- */
interface HistoryItem {
  id: number
  method: Method
  url: string
  status: number
  timeMs: number
  /** 回填所需完整参数快照 */
  snapshot: {
    headersText: string
    bodyKind: BodyKind
    bodyText: string
    authType: 'none' | 'bearer' | 'basic'
    authToken: string
    authUser: string
    authPass: string
  }
  at: number
}
const HISTORY_KEY = 'api-tester-history'
const history = ref<HistoryItem[]>([])
const showHistory = ref(false)

function loadHistory() {
  try {
    history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    history.value = []
  }
}
function saveHistory(item: HistoryItem) {
  history.value = [item, ...history.value.filter((h) => h.id !== item.id)].slice(0, 20)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch { /* 存储满则忽略 */ }
}
function restoreHistory(h: HistoryItem) {
  method.value = h.method
  url.value = h.url
  headersText.value = h.snapshot.headersText
  bodyKind.value = h.snapshot.bodyKind
  bodyText.value = h.snapshot.bodyText
  authType.value = h.snapshot.authType
  authToken.value = h.snapshot.authToken
  authUser.value = h.snapshot.authUser
  authPass.value = h.snapshot.authPass
  showHistory.value = false
  ElMessage.success('已回填请求参数')
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

/* --------------------------- cURL 导入 --------------------------- */
const curlText = ref('')
const showCurl = ref(false)

/** 解析 curl 命令(支持 -X -H -d --data --data-raw -u -F 与无参数直写 URL 的常见写法) */
function parseCurl(cmd: string): boolean {
  const s = cmd.trim().replace(/\\\n/g, ' ').replace(/^curl\s+/i, '')
  if (!s) return false
  // 分词(支持成对单/双引号)
  const toks: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) toks.push(m[1] ?? m[2] ?? m[3] ?? '')

  let u = ''
  let hd: Record<string, string> = {}
  let data = ''
  let mmethod: Method | '' = ''
  const hdrs: string[] = []
  const datas: string[] = []
  const forms: string[] = []
  let basic = ''

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const next = () => toks[++i] ?? ''
    if (t === '-X' || t === '--request') mmethod = next().toUpperCase() as Method
    else if (t === '-H' || t === '--header') hdrs.push(next())
    else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-ascii') datas.push(next())
    else if (t === '-F' || t === '--form') forms.push(next())
    else if (t === '-u' || t === '--user') basic = next()
    else if (t === '--url') u = next()
    else if (!t.startsWith('-') && !u) u = t
  }
  if (!u) return false

  for (const h of hdrs) {
    const i = h.indexOf(':')
    if (i > 0) hd[h.slice(0, i).trim()] = h.slice(i + 1).trim()
  }
  // Basic 认证
  if (basic) {
    const i = basic.indexOf(':')
    authType.value = 'basic'
    authUser.value = i > 0 ? basic.slice(0, i) : basic
    authPass.value = i > 0 ? basic.slice(i + 1) : ''
  } else if (hd.Authorization?.startsWith('Bearer ')) {
    authType.value = 'bearer'
    authToken.value = hd.Authorization.slice(7).trim()
    delete hd.Authorization
  } else {
    authType.value = 'none'
  }
  // multipart 表单(文件字段浏览器端无法还原磁盘文件,退化为文本字段并提示)
  if (forms.length) {
    bodyKind.value = 'urlencoded'
    data = forms.map((f) => f.replace(/^(\w+)=/, '$1=')).join('&')
    if (forms.some((f) => f.includes('@'))) ElMessage.info('curl 里的文件字段(@)无法还原,已按文本处理')
  } else if (datas.length) {
    data = datas.join('&')
    bodyKind.value = looksJson(data) ? 'json' : /[^=]+=[^=]*&/.test(data) ? 'urlencoded' : 'text'
  } else {
    bodyKind.value = 'none'
  }
  // 推断 method
  if (!mmethod) mmethod = datas.length || forms.length ? 'POST' : 'GET'
  method.value = mmethod
  url.value = u
  bodyText.value = data
  headersText.value = Object.keys(hd).length ? Object.entries(hd).map(([k, v]) => `${k}: ${v}`).join('\n') : ''
  resp.value = null
  return true
}

function looksJson(s: string) {
  const t = s.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

function doImportCurl() {
  if (parseCurl(curlText.value)) {
    ElMessage.success('cURL 已解析')
    showCurl.value = false
    curlText.value = ''
  } else {
    ElMessage.error('未能识别 cURL 命令,请检查格式')
  }
}

/* --------------------------- 发送 --------------------------- */
function parseHeaders(): Record<string, string> {
  if (!headersText.value.trim()) return {}
  try {
    const o = JSON.parse(headersText.value)
    return typeof o === 'object' && o !== null ? (o as Record<string, string>) : {}
  } catch {
    const out: Record<string, string> = {}
    headersText.value.split('\n').forEach((l) => {
      const i = l.indexOf(':')
      if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
    })
    return out
  }
}

/** 组装最终 headers 与 body(body 同时返回给 fetch) */
function buildRequest(): { headers: Record<string, string>; body?: BodyInit } {
  const headers = parseHeaders()
  let body: BodyInit | undefined

  // 认证
  if (authType.value === 'bearer' && authToken.value) headers.Authorization = `Bearer ${authToken.value}`
  else if (authType.value === 'basic' && (authUser.value || authPass.value)) headers.Authorization = `Basic ${btoa(`${authUser.value}:${authPass.value}`)}`

  const hasBody = method.value !== 'GET' && method.value !== 'HEAD' && bodyKind.value !== 'none'
  if (hasBody) {
    if (bodyKind.value === 'form') {
      const fd = new FormData()
      for (const f of formFiles.value) fd.append('file', f, f.name)
      // 其它文本字段暂不提供;文件即为主体
      body = fd
    } else {
      if (bodyKind.value === 'json') headers['Content-Type'] ??= 'application/json'
      else if (bodyKind.value === 'urlencoded') headers['Content-Type'] ??= 'application/x-www-form-urlencoded'
      body = bodyText.value
    }
  }
  return { headers, body }
}

function pickColor(s: number): 'info' | 'success' | 'warning' | 'primary' | 'danger' {
  if (s >= 500) return 'danger'
  if (s >= 400) return 'warning'
  if (s >= 300) return 'primary'
  if (s >= 200) return 'success'
  return 'info'
}

let abort: AbortController | null = null

async function send() {
  if (!/^https?:\/\//.test(url.value)) {
    ElMessage.warning('URL 需以 http:// 或 https:// 开头')
    return
  }
  loading.value = true
  abort = new AbortController()
  const t0 = performance.now()
  try {
    const { headers, body } = buildRequest()
    const r = await fetch(url.value, { method: method.value, headers, body, signal: abort.signal })
    const text = await r.text()
    resp.value = {
      status: r.status,
      statusText: r.statusText,
      timeMs: Math.round(performance.now() - t0),
      headers: Object.fromEntries(r.headers.entries()),
      body: text,
      sizeKb: Math.round((text.length / 1024) * 100) / 100,
      sentHeaders: headers,
    }
    saveHistory({
      id: Date.now(),
      method: method.value,
      url: url.value,
      status: r.status,
      timeMs: resp.value.timeMs,
      snapshot: {
        headersText: headersText.value,
        bodyKind: bodyKind.value,
        bodyText: bodyText.value,
        authType: authType.value,
        authToken: authToken.value,
        authUser: authUser.value,
        authPass: authPass.value,
      },
      at: Date.now(),
    })
  } catch (e) {
    const err = e as Error
    resp.value = {
      status: 0,
      statusText: err.name === 'AbortError' ? '请求已取消' : err.message.includes('Failed to fetch') ? '网络错误(CORS 或网络不可达)' : `网络错误: ${err.message}`,
      timeMs: Math.round(performance.now() - t0),
      headers: {},
      body: '',
      sizeKb: 0,
      sentHeaders: {},
    }
  } finally {
    loading.value = false
  }
}

function cancel() {
  abort?.abort()
}

/* --------------------------- 响应体展示 --------------------------- */
type RespView = 'pretty' | 'raw'
const respView = ref<RespView>('pretty')
const isRespJson = computed(() => {
  if (!resp.value) return false
  const t = resp.value.body.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
})
const prettyJson = computed(() => {
  if (!isRespJson.value || !resp.value) return ''
  try {
    return JSON.stringify(JSON.parse(resp.value.body), null, 2)
  } catch {
    return resp.value.body
  }
})

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  formFiles.value = Array.from(input.files ?? [])
  input.value = ''
}

onMounted(() => {
  loadHistory()
  window.addEventListener('beforeunload', () => { /* 历史已在每次请求后实时落盘 */ })
})
onBeforeUnmount(() => { abort?.abort() })
</script>

<template>
  <ToolPage>
    <template #title>API 测试器</template>
    <template #desc>浏览器内直接发送 HTTP 请求:Body 四种类型、Bearer/Basic 认证、请求历史、cURL 导入、JSON 高亮折叠。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>请求</span>
          <div class="chips">
            <el-button size="small" @click="showCurl = !showCurl">cURL 导入</el-button>
            <el-button size="small" @click="showHistory = !showHistory">
              历史{{ history.length ? `(${history.length})` : '' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- cURL 导入面板 -->
      <div v-if="showCurl" class="curl-box">
        <div class="lab">粘贴 cURL 命令(支持 -X -H -d --data-raw -u -F 与行尾反斜杠)</div>
        <el-input v-model="curlText" type="textarea" :rows="3" class="mono" placeholder="curl -X POST 'https://api.example.com' -H 'Content-Type: application/json' -d '{&quot;a&quot;:1}'" />
        <div class="mt8">
          <el-button type="primary" size="small" @click="doImportCurl">解析并填入</el-button>
          <el-button size="small" @click="showCurl = false">收起</el-button>
        </div>
      </div>

      <!-- 历史面板 -->
      <div v-if="showHistory" class="history-box">
        <div class="hist-head">
          <span class="lab">请求历史(最多 20 条,存本地)</span>
          <el-button size="small" text :icon="DeleteIcon" @click="clearHistory">清空</el-button>
        </div>
        <div v-for="h in history" :key="h.id" class="hist-item" @click="restoreHistory(h)">
          <el-tag size="small" :type="pickColor(h.status)" class="mono">{{ h.method }}</el-tag>
          <span class="hist-url mono">{{ h.url }}</span>
          <span class="hist-meta">{{ h.status || '失败' }} · {{ h.timeMs }}ms · {{ fmtTime(h.at) }}</span>
        </div>
        <div v-if="!history.length" class="muted small" style="padding: 8px 0">暂无历史</div>
      </div>

      <div class="urlrow">
        <el-select v-model="method" style="width: 110px" class="mono">
          <el-option v-for="m in (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as Method[])" :key="m" :value="m" :label="m" />
        </el-select>
        <el-input v-model="url" class="mono" placeholder="https://api.example.com/xxx" @keydown.enter="send">
          <template #append>
            <el-button v-if="!loading" type="primary" @click="send">发送</el-button>
            <el-button v-else @click="cancel">取消</el-button>
          </template>
        </el-input>
      </div>

      <div class="mt8">
        <span class="lab">认证</span>
        <div class="authrow">
          <el-radio-group v-model="authType" size="small">
            <el-radio-button value="none">无</el-radio-button>
            <el-radio-button value="bearer">Bearer Token</el-radio-button>
            <el-radio-button value="basic">Basic</el-radio-button>
          </el-radio-group>
          <el-input v-if="authType === 'bearer'" v-model="authToken" class="mono auth-input" placeholder="粘贴 access token" show-password clearable />
          <template v-if="authType === 'basic'">
            <el-input v-model="authUser" class="mono auth-input" placeholder="用户名" clearable />
            <el-input v-model="authPass" class="mono auth-input" type="password" placeholder="密码" show-password clearable />
          </template>
        </div>
      </div>

      <div class="mt8">
        <span class="lab">Body 类型</span>
        <div class="authrow">
          <el-radio-group v-model="bodyKind" size="small">
            <el-radio-button value="none">无</el-radio-button>
            <el-radio-button value="json">JSON</el-radio-button>
            <el-radio-button value="text">纯文本</el-radio-button>
            <el-radio-button value="urlencoded">form-urlencoded</el-radio-button>
            <el-radio-button value="form">multipart(文件)</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div v-if="bodyKind === 'form'" class="mt8">
        <span class="lab">选择文件(将作为 file 字段发送)</span>
        <input type="file" multiple hidden @change="onPickFiles" ref="pickRef" />
        <el-button size="small" @click="($refs.pickRef as HTMLInputElement)?.click()">选择文件</el-button>
        <span v-if="formFiles.length" class="muted small" style="margin-left: 8px">
          已选 {{ formFiles.length }} 个:{{ formFiles.map((f) => f.name).join(', ') }}
        </span>
      </div>

      <div v-if="bodyKind !== 'none' && bodyKind !== 'form'" class="mt8">
        <div class="lab">请求 Body</div>
        <el-input
          v-model="bodyText"
          type="textarea"
          :rows="5"
          class="mono"
          :placeholder='bodyKind === "json" ? `{"key": "value"}` : bodyKind === "urlencoded" ? "a=1&b=2" : "任意文本"'
        />
      </div>

      <div class="mt8">
        <div class="lab">请求头(JSON 对象 或 "k: v" 每行;认证与 Content-Type 会自动叠加)</div>
        <el-input v-model="headersText" type="textarea" :rows="3" class="mono" />
      </div>
    </el-card>

    <el-card v-if="resp" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>响应</span>
          <div class="chips">
            <el-tag size="small" :type="pickColor(resp.status)" class="mono">{{ resp.status || '—' }} {{ resp.statusText }}</el-tag>
            <el-tag size="small" type="info">{{ resp.timeMs }} ms</el-tag>
            <el-tag size="small" type="info">{{ resp.sizeKb }} KB</el-tag>
            <el-button v-if="isRespJson" size="small" @click="respView = respView === 'pretty' ? 'raw' : 'pretty'">
              {{ respView === 'pretty' ? '原始' : '格式化' }}
            </el-button>
            <el-button size="small" @click="downloadText('resp.txt', resp?.body ?? '')">导出</el-button>
          </div>
        </div>
      </template>

      <div class="lab">请求头发送内容</div>
      <div class="hd mono">
        <div v-for="(v, k) in resp.sentHeaders" :key="k"><b>{{ k }}</b>: {{ k.toLowerCase() === 'authorization' ? v.slice(0, 20) + '…' : v }}</div>
        <div v-if="!Object.keys(resp.sentHeaders).length" class="muted">(无)</div>
      </div>

      <div class="lab" style="margin-top: 12px">响应头(浏览器可见部分)</div>
      <div class="hd mono">
        <div v-for="(v, k) in resp.headers" :key="k"><b>{{ k }}</b>: {{ v }}</div>
        <div v-if="!Object.keys(resp.headers).length" class="muted">(未获取)</div>
      </div>

      <div class="lab" style="margin-top: 12px">响应体</div>
      <pre class="bd mono">{{ (respView === 'pretty' && isRespJson ? prettyJson : resp.body) || '(空)' }}</pre>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 10px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.urlrow { display: flex; gap: 8px; }
.lab { display: block; font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.hd { background: var(--el-fill-color-lighter); border-radius: 8px; padding: 8px 12px; font-size: 12px; max-height: 160px; overflow: auto; }
.bd { background: var(--el-fill-color-lighter); border-radius: 8px; padding: 10px 12px; font-size: 12.5px; max-height: 380px; overflow: auto; white-space: pre-wrap; word-break: break-all; margin: 0; }
.authrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.auth-input { width: 240px; }
.curl-box, .history-box { background: var(--el-fill-color-light); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
.hist-head { display: flex; justify-content: space-between; align-items: center; }
.hist-item { display: flex; gap: 8px; align-items: center; padding: 5px 4px; cursor: pointer; border-radius: 6px; font-size: 12px; }
.hist-item:hover { background: var(--el-fill-color-lighter); }
.hist-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-meta { color: var(--el-text-color-secondary); flex: none; }
.muted { color: var(--el-text-color-secondary); }
.small { font-size: 12px; }
</style>
