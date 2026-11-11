<script setup lang="ts">
/**
 * Whois 查询(RDAP)
 * 通过 rdap.org 的引导服务查询域名 / IP 的注册信息:注册商、状态、关键时间、
 * DNS 与 DNSSEC,并保留完整原始 JSON 便于核对。纯前端直连,不经过本站后端。
 */
import { computed, onMounted, ref } from 'vue'
import { Aim, DocumentCopy, Link, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface RdapEvent { eventAction?: string; eventDate?: string }
interface RdapEntity {
  roles?: string[]
  handle?: string
  vcardArray?: [string, Array<unknown[]>]
  entities?: RdapEntity[]
}
interface RdapNs { ldhName?: string; unicodeName?: string }
interface RdapJson {
  objectClassName?: string
  ldhName?: string
  unicodeName?: string
  handle?: string
  status?: string[]
  events?: RdapEvent[]
  entities?: RdapEntity[]
  nameservers?: RdapNs[]
  secureDNS?: { delegationSigned?: boolean }
  errorCode?: number
  title?: string
  description?: string[]
}

type QueryType = 'domain' | 'ip'

const RECENT_KEY = 'utools_whois-recent-v1'
const SAMPLES = ['example.com', 'openai.com', 'baidu.com', '8.8.8.8']

const input = ref('')
const loading = ref(false)
const error = ref('')
const record = ref<RdapJson | null>(null)
const rawText = ref('')
const elapsed = ref(0)
const queryType = ref<QueryType>('domain')
const usedTarget = ref('')
const recent = ref<string[]>([])

const STATUS_TEXT: Record<string, string> = {
  ok: '正常',
  active: '正常',
  inactive: '未激活',
  clientTransferProhibited: '禁止转移(注册商)',
  clientDeleteProhibited: '禁止删除(注册商)',
  clientUpdateProhibited: '禁止更新(注册商)',
  clientRenewProhibited: '禁止续费(注册商)',
  serverTransferProhibited: '禁止转移(注册局)',
  serverDeleteProhibited: '禁止删除(注册局)',
  serverUpdateProhibited: '禁止更新(注册局)',
  serverRenewProhibited: '禁止续费(注册局)',
  serverHold: '注册局暂停解析',
  clientHold: '注册商暂停解析',
  pendingDelete: '待删除',
  pendingTransfer: '转移中',
  pendingCreate: '待创建',
  pendingRenew: '待续费',
  pendingUpdate: '待更新',
  redemptionPeriod: '赎回期',
  autoRenewPeriod: '自动续费期',
  transferPeriod: '转移期',
  addPeriod: '新增宽限期',
  renewPeriod: '续费宽限期',
}

const EVENT_TEXT: Record<string, string> = {
  registration: '注册时间',
  expiration: '到期时间',
  'last changed': '最后修改',
  'last update of rdap database': 'RDAP 数据库更新',
  transfer: '转移时间',
  'registrar registration expiration date': '到期时间(注册商)',
}

const rdapUrl = computed(() => {
  if (!usedTarget.value) return 'https://rdap.org/'
  return `https://rdap.org/${queryType.value}/${encodeURIComponent(usedTarget.value)}`
})

/* ------------------------------ 输入归一化 ------------------------------ */

function normalizeTarget(raw: string): { type: QueryType; target: string } | null {
  let s = raw.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '')
  s = s.replace(/^www\./, '').replace(/\.$/, '')
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) {
    const parts = s.split('.').map(Number)
    if (parts.every((n) => n >= 0 && n <= 255)) return { type: 'ip', target: s }
    return null
  }
  // IPv6(宽松判断,交给 RDAP 校验)
  if (s.includes(':')) return { type: 'ip', target: s }
  // 域名:至少两段,允许 punycode
  const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
  const re = new RegExp(`^(?:${label}\\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
  if (!re.test(s) || s.length > 253) return null
  if (/^\d+$/.test(s.split('.').pop() ?? '')) return null
  return { type: 'domain', target: s }
}

/* ------------------------------ 解析辅助 ------------------------------ */

function vcardValue(entity: RdapEntity, key: string): string {
  const arr = entity.vcardArray?.[1]
  if (!Array.isArray(arr)) return ''
  for (const item of arr) {
    if (Array.isArray(item) && item[0] === key && typeof item[3] === 'string') return item[3]
  }
  return ''
}

function walkEntities(list: RdapEntity[] | undefined, out: RdapEntity[] = []): RdapEntity[] {
  for (const e of list ?? []) {
    out.push(e)
    if (e.entities?.length) walkEntities(e.entities, out)
  }
  return out
}

const allEntities = computed(() => walkEntities(record.value?.entities))

const registrar = computed(() => {
  const hit = allEntities.value.find((e) => (e.roles ?? []).includes('registrar'))
  if (!hit) return ''
  return vcardValue(hit, 'fn') || hit.handle || ''
})

const abuseEmail = computed(() => {
  const hit = allEntities.value.find((e) => (e.roles ?? []).includes('abuse'))
  return hit ? vcardValue(hit, 'email') : ''
})

interface EventRow { key: string; label: string; date: string; raw: string }

const eventRows = computed<EventRow[]>(() => {
  const rows: EventRow[] = []
  for (const e of record.value?.events ?? []) {
    const action = (e.eventAction ?? '').trim()
    if (!action || !e.eventDate) continue
    const key = action.toLowerCase()
    const label = EVENT_TEXT[key] ?? action
    rows.push({ key: label + e.eventDate, label, date: fmtDate(e.eventDate), raw: e.eventDate })
  }
  return rows
})

const expiration = computed(() => {
  const hit = (record.value?.events ?? []).find((e) => (e.eventAction ?? '').toLowerCase() === 'expiration')
  return hit?.eventDate ? new Date(hit.eventDate) : null
})

const daysLeft = computed<number | null>(() => {
  const d = expiration.value
  if (!d || Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
})

const STATUS_LOOKUP = new Map(
  Object.entries(STATUS_TEXT).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v]),
)

const statusList = computed(() =>
  (record.value?.status ?? []).map((s) => ({
    raw: s,
    text: STATUS_LOOKUP.get(s.toLowerCase().replace(/[\s_-]/g, '')) ?? s,
  })),
)

const nameservers = computed(() =>
  (record.value?.nameservers ?? []).map((n) => n.ldhName ?? n.unicodeName ?? '').filter(Boolean),
)

const displayName = computed(() => record.value?.unicodeName || record.value?.ldhName || usedTarget.value)

const dnssecText = computed(() => (record.value?.secureDNS?.delegationSigned ? '已签名 (DNSSEC)' : '未签名'))

const summaryText = computed(() => {
  const lines = [
    `对象:${displayName.value}`,
    `类型:${queryType.value === 'ip' ? 'IP 地址' : '域名'}`,
    registrar.value ? `注册商:${registrar.value}` : '',
    ...eventRows.value.map((e) => `${e.label}:${e.date}`),
    nameservers.value.length ? `DNS:${nameservers.value.join(', ')}` : '',
    statusList.value.length ? `状态:${statusList.value.map((s) => s.text).join('、')}` : '',
  ]
  return lines.filter(Boolean).join('\n')
})

/* ------------------------------ 查询 ------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) recent.value = arr.filter((x): x is string => typeof x === 'string').slice(0, 8)
    }
  } catch { /* ignore */ }
}

function pushRecent(target: string) {
  recent.value = [target, ...recent.value.filter((t) => t !== target)].slice(0, 8)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)) } catch { /* ignore */ }
}

async function lookup(targetRaw?: string) {
  const raw = (targetRaw ?? input.value).trim()
  if (!raw) {
    ElMessage.info('请输入域名或 IP')
    return
  }
  const norm = normalizeTarget(raw)
  if (!norm) {
    error.value = '格式不正确:请输入形如 example.com 的域名,或 IPv4 / IPv6 地址'
    record.value = null
    return
  }
  input.value = norm.target
  queryType.value = norm.type
  usedTarget.value = norm.target
  loading.value = true
  error.value = ''
  record.value = null
  rawText.value = ''
  const started = performance.now()

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`https://rdap.org/${norm.type}/${encodeURIComponent(norm.target)}`, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: ctrl.signal,
    })
    elapsed.value = Math.round(performance.now() - started)
    const text = await res.text()
    rawText.value = text
    let data: RdapJson | null = null
    try { data = JSON.parse(text) as RdapJson } catch { data = null }

    if (!res.ok || (data && typeof data.errorCode === 'number' && data.errorCode >= 400)) {
      if (res.status === 404 || data?.errorCode === 404) {
        error.value = queryType.value === 'ip'
          ? '未找到该 IP 的 RDAP 记录(内网地址或注册局未提供 RDAP)'
          : '未找到该域名的 RDAP 记录:可能尚未注册,或该后缀未提供 RDAP 服务'
      } else if (res.status === 429) {
        error.value = '查询过于频繁(HTTP 429),请稍后再试'
      } else {
        error.value = `查询失败:HTTP ${res.status}${data?.title ? ` · ${data.title}` : ''}`
      }
      record.value = null
      return
    }
    if (!data) {
      error.value = '返回内容不是合法 JSON,可能被网络中间层拦截'
      return
    }
    record.value = data
    pushRecent(norm.target)
  } catch (e) {
    elapsed.value = Math.round(performance.now() - started)
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    error.value = aborted
      ? '查询超时(15 秒),请检查网络后重试'
      : '请求失败:可能是网络不可达,或该注册局未开放跨域(CORS)查询'
  } finally {
    window.clearTimeout(timer)
    loading.value = false
  }
}

async function copy(text: string, tip = '已复制') {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(tip)
  } catch {
    ElMessage.error('复制失败')
  }
}

function reset() {
  input.value = ''
  record.value = null
  error.value = ''
  rawText.value = ''
  usedTarget.value = ''
}

onMounted(loadRecent)
</script>

<template>
  <div class="who">
    <div class="head">
      <div>
        <h3 class="title">Whois 查询</h3>
        <p class="sub">通过 RDAP 查询域名 / IP 的注册商、状态、时间与 DNS,数据直连注册局</p>
      </div>
      <el-button size="small" :icon="RefreshLeft" @click="reset">清空</el-button>
    </div>

    <div class="search-row">
      <el-input
        v-model="input"
        class="ipt"
        placeholder="输入域名或 IP,如 example.com、8.8.8.8"
        clearable
        @keyup.enter="lookup()"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" :loading="loading" :icon="Aim" @click="lookup()">查询</el-button>
    </div>

    <div class="samples">
      <span class="lbl">示例</span>
      <button v-for="s in SAMPLES" :key="s" class="chip" @click="lookup(s)">{{ s }}</button>
      <template v-if="recent.length">
        <span class="lbl ml">最近</span>
        <button v-for="r in recent" :key="'r-' + r" class="chip recent" @click="lookup(r)">{{ r }}</button>
      </template>
    </div>

    <div v-if="loading" class="state">正在向 rdap.org 查询…</div>

    <div v-else-if="error" class="state err">
      <div class="err-text">{{ error }}</div>
      <div class="err-actions">
        <a class="raw-link" :href="rdapUrl" target="_blank" rel="noreferrer">
          <el-icon><Link /></el-icon>在新标签页查看原始 RDAP
        </a>
      </div>
      <p class="hint">提示:RDAP 由各注册局自行提供,.cn 等少数后缀可能不支持;跨域被拦时只能在新标签页查看。</p>
    </div>

    <template v-else-if="record">
      <div class="summary">
        <div class="sum-main">
          <div class="sum-name">{{ displayName }}</div>
          <div class="sum-meta">
            <span v-if="record.handle" class="mono">{{ record.handle }}</span>
            <span v-if="record.objectClassName" class="tag">{{ record.objectClassName === 'domain' ? '域名' : 'IP 网络' }}</span>
            <span class="tag">耗时 {{ elapsed }}ms</span>
          </div>
        </div>
        <div class="sum-actions">
          <el-button size="small" :icon="DocumentCopy" @click="copy(summaryText, '已复制摘要')">复制摘要</el-button>
          <el-button size="small" :icon="DocumentCopy" :disabled="!rawText" @click="copy(rawText, '已复制原始 JSON')">复制 JSON</el-button>
          <a class="raw-link" :href="rdapUrl" target="_blank" rel="noreferrer">原始 RDAP</a>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="k">注册商</div>
          <div class="v">{{ registrar || '未提供(可能被隐私保护)' }}</div>
          <div v-if="abuseEmail" class="sub2">滥用举报:{{ abuseEmail }}</div>
        </div>
        <div class="card">
          <div class="k">到期时间</div>
          <div class="v">
            {{ expiration ? fmtDate(expiration.toISOString()) : '未提供' }}
          </div>
          <div v-if="daysLeft !== null" class="sub2" :class="{ warn: daysLeft < 90, bad: daysLeft < 30 }">
            {{ daysLeft >= 0 ? `剩余 ${daysLeft} 天` : `已过期 ${-daysLeft} 天` }}
          </div>
        </div>
        <div class="card">
          <div class="k">DNS 服务器</div>
          <div v-if="nameservers.length" class="ns">
            <span v-for="n in nameservers" :key="n" class="mono ns-item">{{ n }}</span>
          </div>
          <div v-else class="v">未提供</div>
          <div class="sub2">DNSSEC:{{ dnssecText }}</div>
        </div>
      </div>

      <div v-if="statusList.length" class="block">
        <div class="block-title">域名状态 <span class="n">{{ statusList.length }}</span></div>
        <div class="statuses">
          <span v-for="s in statusList" :key="s.raw" class="status" :title="s.raw">{{ s.text }}</span>
        </div>
      </div>

      <div v-if="eventRows.length" class="block">
        <div class="block-title">关键时间</div>
        <div class="events">
          <div v-for="e in eventRows" :key="e.key" class="event">
            <span class="event-label">{{ e.label }}</span>
            <span class="event-date">{{ e.date }}</span>
          </div>
        </div>
      </div>

      <details class="raw">
        <summary>原始 JSON({{ rawText.length }} 字符)</summary>
        <pre class="raw-pre">{{ rawText }}</pre>
      </details>
    </template>

    <div v-else class="state idle">
      输入域名或 IP 后回车即可查询;注册信息来自各注册局的 RDAP 服务,不查历史 Whois、不含隐私字段。
    </div>

    <p class="foot">
      说明:RDAP 是 Whois 的官方继任协议,本页通过 <span class="mono">rdap.org</span> 自动路由到对应注册局,仅做只读查询,不发送任何本站数据。
    </p>
  </div>
</template>

<style scoped>
.who {
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
.search-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.ipt {
  flex: 1;
}
.samples {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.lbl {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.lbl.ml {
  margin-left: 10px;
}
.chip {
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--el-text-color-regular);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11px;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.chip.recent {
  font-family: ui-monospace, Menlo, monospace;
}
.state {
  padding: 28px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  border: 1px dashed var(--card-border);
  border-radius: 12px;
}
.state.err {
  border-style: solid;
  border-color: color-mix(in srgb, #ef4444 40%, transparent);
  background: color-mix(in srgb, #ef4444 6%, transparent);
  color: var(--el-text-color-regular);
  text-align: left;
}
.err-text {
  font-size: 13px;
  font-weight: 600;
  color: #ef4444;
}
.err-actions {
  margin-top: 8px;
}
.hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}
.state.idle {
  padding: 40px 28px;
  line-height: 1.8;
}
.summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
}
.sum-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.3px;
  word-break: break-all;
}
.sum-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.tag {
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 10px;
}
.sum-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.raw-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
}
.raw-link:hover {
  text-decoration: underline;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
@media (max-width: 760px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.k {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.v {
  font-size: 14px;
  font-weight: 600;
  word-break: break-word;
}
.sub2 {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.sub2.warn {
  color: #f59e0b;
}
.sub2.bad {
  color: #ef4444;
}
.ns {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ns-item {
  font-size: 12px;
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.block {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.block-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.n {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}
.statuses {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.status {
  font-size: 11px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 35%, transparent);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
}
.events {
  display: flex;
  flex-direction: column;
}
.event {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--card-border);
  font-size: 12.5px;
}
.event:last-child {
  border-bottom: none;
}
.event-label {
  color: var(--el-text-color-secondary);
}
.event-date {
  font-family: ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}
.raw {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 6px;
}
.raw summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.raw-pre {
  margin: 10px 0 0;
  max-height: 360px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.6;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px 12px;
}
.foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  line-height: 1.7;
}
</style>
