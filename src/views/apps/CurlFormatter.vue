<script setup lang="ts">
/**
 * CURL 格式化(仿找Tab「CURL 格式化」)
 * 粘贴 curl 命令 → 拆出 URL / 方法 / 请求头 / 请求体 / Cookie 等 →
 * 生成结构化摘要、多行美化版 curl,以及等价的 fetch() 代码。全部本机解析。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const raw = ref(`curl -X POST 'https://api.example.com/v1/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer sk-demo-token' \\
  -d '{"name":"Ada","age":28,"tags":["dev","admin"]}'`)

interface Parsed {
  url: string
  method: string
  headers: [string, string][]
  body: string
  cookie: string
  auth: string
  flags: string[]
  error: string
}

/** 把带续行符的 shell 命令切成 token,兼容单/双引号与反斜杠转义 */
function tokenize(src: string): string[] {
  const s = src.replace(/\\\r?\n/g, ' ').trim()
  const out: string[] = []
  let cur = ''
  let quote = ''
  let esc = false
  let started = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (esc) { cur += ch; esc = false; started = true; continue }
    if (ch === '\\' && quote !== "'") { esc = true; started = true; continue }
    if (quote) {
      if (ch === quote) quote = ''
      else cur += ch
      started = true
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; started = true; continue }
    if (/\s/.test(ch)) {
      if (started) { out.push(cur); cur = ''; started = false }
      continue
    }
    cur += ch
    started = true
  }
  if (started) out.push(cur)
  return out
}

const parsed = computed<Parsed>(() => {
  const res: Parsed = { url: '', method: '', headers: [], body: '', cookie: '', auth: '', flags: [], error: '' }
  const t = tokenize(raw.value)
  if (!t.length) return res
  if (t[0] === 'curl') t.shift()
  const next = (i: number): string => t[++i] ?? ''
  for (let i = 0; i < t.length; i++) {
    const a = t[i]
    if (a === '-X' || a === '--request') res.method = next(i++).toUpperCase()
    else if (a === '-H' || a === '--header') {
      const h = next(i++)
      const p = h.indexOf(':')
      if (p > 0) res.headers.push([h.slice(0, p).trim(), h.slice(p + 1).trim()])
      else if (h) res.headers.push([h, ''])
    }
    else if (/^(-d|--data|--data-raw|--data-binary|--data-urlencode)$/.test(a)) {
      const v = next(i++)
      res.body = res.body ? `${res.body}&${v}` : v
      if (a === '--data-urlencode') res.flags.push('data-urlencode')
    }
    else if (a === '-b' || a === '--cookie') res.cookie = next(i++)
    else if (a === '-A' || a === '--user-agent') res.headers.push(['User-Agent', next(i++)])
    else if (a === '-u' || a === '--user') res.auth = next(i++)
    else if (a === '-e' || a === '--referer') res.headers.push(['Referer', next(i++)])
    else if (a === '--url') res.url = next(i++)
    else if (a === '-I' || a === '--head') { res.method = 'HEAD'; res.flags.push('head') }
    else if (a === '-L' || a === '--location') res.flags.push('跟随重定向')
    else if (a === '-k' || a === '--insecure') res.flags.push('忽略证书校验')
    else if (a === '--compressed') res.flags.push('请求压缩')
    else if (a === '-s' || a === '--silent') res.flags.push('静默')
    else if (a === '-v' || a === '--verbose') res.flags.push('详细日志')
    else if (a.startsWith('-')) res.flags.push(a)
    else if (!res.url) res.url = a
  }
  if (!res.method) res.method = res.body ? 'POST' : 'GET'
  if (!res.url) res.error = '没有找到 URL,请检查粘贴的命令'
  else if (!/^https?:\/\//i.test(res.url)) res.url = 'https://' + res.url
  if (res.auth) res.headers.push(['Authorization', 'Basic ' + btoaSafe(res.auth)])
  return res
})

function btoaSafe(s: string): string {
  try { return btoa(s) } catch { return '<base64(' + s + ')>' }
}

/** 请求体看起来是 JSON 时格式化,否则原样输出 */
function prettyBody(): string {
  const b = parsed.value.body
  if (!b) return ''
  try { return JSON.stringify(JSON.parse(b), null, 2) } catch { return b }
}
/** 生成 shell 命令时 JSON 必须压成单行,否则单引号内换行会破坏命令 */
function compactBody(): string {
  const b = parsed.value.body
  if (!b) return ''
  try { return JSON.stringify(JSON.parse(b)) } catch { return b }
}
/** fetch 的 body:JSON 走 JSON.stringify(对象),普通文本直接用字符串字面量 */
function bodyLine(): string {
  const b = parsed.value.body
  if (!b) return ''
  try {
    return `  body: JSON.stringify(${JSON.stringify(JSON.parse(b))})`
  } catch {
    return `  body: ${JSON.stringify(b)}`
  }
}

const fetchCode = computed(() => {
  const p = parsed.value
  if (p.error || !p.url) return ''
  const opts: string[] = [`  method: '${p.method}'`]
  if (p.headers.length) {
    const hs = p.headers.map(([k, v]) => `    '${k.replace(/'/g, "\\'")}': '${v.replace(/'/g, "\\'")}'`).join(',\n')
    opts.push(`  headers: {\n${hs}\n  }`)
  }
  const bl = bodyLine()
  if (bl) opts.push(bl)
  if (p.cookie) opts.push(`  credentials: 'include'`)
  return `const res = await fetch('${p.url}', {\n${opts.join(',\n')}\n})\nconst data = await res.json()\nconsole.log(data)`
})

const prettyCurl = computed(() => {
  const p = parsed.value
  if (p.error || !p.url) return ''
  const lines = [`curl -X ${p.method} '${p.url}'`]
  p.headers.forEach(([k, v]) => lines.push(`  -H '${k}: ${v}'`))
  if (p.cookie) lines.push(`  -b '${p.cookie}'`)
  if (p.body) lines.push(`  -d '${compactBody()}'`)
  return lines.map((l, i) => l + (i < lines.length - 1 ? ' \\' : '')).join('\n')
})

async function copy(v: string) {
  if (!v) return
  await copyText(v)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="cf">
    <div class="head">
      <div>
        <h3 class="title">CURL 格式化</h3>
        <p class="sub">粘贴 curl 命令,拆解成 URL / 方法 / 请求头 / 请求体,并生成 fetch 代码</p>
      </div>
      <el-button size="small" @click="raw = ''">清空</el-button>
    </div>

    <el-input v-model="raw" type="textarea" :rows="7" spellcheck="false" class="mono" placeholder="粘贴 curl 命令,支持多行 \\ 续行" />
    <div v-if="parsed.error" class="err">{{ parsed.error }}</div>

    <template v-else>
      <div class="summary">
        <div class="s-item"><span>方法</span><b class="method">{{ parsed.method }}</b></div>
        <div class="s-item wide"><span>URL</span><b class="url">{{ parsed.url }}</b></div>
        <div class="s-item"><span>请求头</span><b>{{ parsed.headers.length }} 个</b></div>
        <div class="s-item"><span>请求体</span><b>{{ parsed.body ? prettyBody().length + ' 字符' : '无' }}</b></div>
      </div>

      <div v-if="parsed.headers.length" class="block-head"><span>请求头</span></div>
      <div v-if="parsed.headers.length" class="kv">
        <div v-for="([k, v], i) in parsed.headers" :key="i" class="kv-row"><span class="k">{{ k }}</span><span class="v">{{ v || '—' }}</span></div>
      </div>
      <div v-if="parsed.flags.length" class="flags">参数:{{ parsed.flags.join(' · ') }}</div>

      <div v-if="parsed.body" class="block-head"><span>请求体</span><el-button size="small" text @click="copy(prettyBody())">复制</el-button></div>
      <pre v-if="parsed.body" class="code">{{ prettyBody() }}</pre>

      <div class="block-head"><span>美化后的 curl</span><div class="acts"><el-button size="small" text @click="copy(prettyCurl)">复制</el-button><el-button size="small" text @click="downloadText(prettyCurl, 'request.sh')">下载 .sh</el-button></div></div>
      <pre class="code">{{ prettyCurl }}</pre>

      <div class="block-head"><span>等价 fetch() 代码</span><div class="acts"><el-button size="small" text @click="copy(fetchCode)">复制</el-button><el-button size="small" text @click="downloadText(fetchCode, 'request.js')">下载 .js</el-button></div></div>
      <pre class="code">{{ fetchCode }}</pre>
    </template>

    <p class="foot">解析完全在本机完成,不会发出任何请求。Basic 认证会换算成 Authorization 头,请自行保管好 Token。</p>
  </div>
</template>

<style scoped>
.cf { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.err { margin-top: 10px; color: #ef4444; font-size: 12px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 14px 0; }
.s-item { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--el-border-color); border-radius: 10px; min-width: 0; }
.s-item.wide { grid-column: span 2; }
.s-item span { font-size: 11px; color: var(--el-text-color-secondary); }
.s-item b { font-size: 13px; word-break: break-all; }
.method { color: var(--el-color-primary); }
.url { font-size: 12px; font-weight: 500; }
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
.acts { display: flex; gap: 4px; }
.kv { border: 1px solid var(--el-border-color-lighter); border-radius: 9px; overflow: hidden; }
.kv-row { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 8px; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid var(--el-border-color-lighter); }
.kv-row:last-child { border-bottom: none; }
.k { font-weight: 600; }
.v { word-break: break-all; color: var(--el-text-color-secondary); }
.flags { font-size: 11px; color: var(--el-text-color-secondary); margin-top: 8px; }
.code { margin: 0; padding: 12px; border-radius: 9px; background: var(--el-fill-color-light); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; max-height: 260px; overflow: auto; }
.foot { font-size: 11px; color: var(--el-text-color-secondary); margin: 12px 0 0; }
@media (max-width: 640px) { .s-item.wide { grid-column: span 1; } .kv-row { grid-template-columns: 1fr; } }
</style>
