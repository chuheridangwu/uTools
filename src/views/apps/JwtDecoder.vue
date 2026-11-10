<script setup lang="ts">
/**
 * JWT 解析
 * 仅做 Base64URL 解码与 JSON 展示,不校验签名、不联网、不保存 Token。
 */
import { computed, ref, watch } from 'vue'
import { CopyDocument, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const raw = ref('')
const header = ref('')
const payload = ref('')
const signature = ref('')
const error = ref('')

function b64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function pretty(s: string): string {
  return JSON.stringify(JSON.parse(b64UrlDecode(s)), null, 2)
}

function decode(v: string) {
  header.value = ''
  payload.value = ''
  signature.value = ''
  error.value = ''
  const s = v.trim().replace(/\s/g, '')
  if (!s) return
  const parts = s.split('.')
  if (parts.length !== 2 && parts.length !== 3) {
    error.value = 'JWT 应由 header.payload.signature 三段组成(第三段可为空)'
    return
  }
  try {
    header.value = pretty(parts[0])
    payload.value = pretty(parts[1])
    signature.value = parts[2] || ''
  } catch {
    error.value = '解码失败:请检查 Token 是否完整,或两段内容是否为合法的 Base64URL JSON'
  }
}

watch(raw, (v) => decode(v))

const info = computed(() => {
  if (!header.value || !payload.value) return null
  try {
    const h = JSON.parse(header.value) as Record<string, unknown>
    const p = JSON.parse(payload.value) as Record<string, unknown>
    const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
    const exp = num(p.exp)
    const iat = num(p.iat)
    const nbf = num(p.nbf)
    const fmt = (sec: number) => new Date(sec * 1000).toLocaleString('zh-CN', { hour12: false })
    let status = '未设置过期时间'
    let statusType = 'plain'
    if (exp !== null) {
      const left = exp * 1000 - Date.now()
      if (left <= 0) {
        status = '已过期'
        statusType = 'danger'
      } else {
        const d = Math.floor(left / 86400000)
        const hr = Math.floor((left % 86400000) / 3600000)
        status = '有效 · 剩余 ' + (d > 0 ? d + ' 天 ' : '') + hr + ' 小时'
        statusType = 'ok'
      }
    }
    return {
      alg: typeof h.alg === 'string' ? h.alg : '未知',
      typ: typeof h.typ === 'string' ? h.typ : '—',
      iatText: iat === null ? '—' : fmt(iat),
      nbfText: nbf === null ? '—' : fmt(nbf),
      expText: exp === null ? '—' : fmt(exp),
      status,
      statusType,
    }
  } catch {
    return null
  }
})

function sample() {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const now = Math.floor(Date.now() / 1000)
  const token =
    enc({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    enc({ sub: '1234567890', name: 'uTools Demo', iat: now, exp: now + 3600, role: 'admin' }) +
    '.demo-signature-not-verified'
  raw.value = token
  decode(token)
}

function clearAll() {
  raw.value = ''
  decode('')
}

async function copy(v: string, tip = '已复制') {
  if (!v) return
  await copyText(v)
  ElMessage.success(tip)
}
</script>

<template>
  <div class="jd">
    <div class="head">
      <div>
        <h3 class="title">JWT 解析</h3>
        <p class="sub">本地解码 Header / Payload,查看过期时间与声明内容</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="Document" @click="sample">填入示例</el-button>
        <el-button size="small" @click="clearAll">清空</el-button>
      </div>
    </div>

    <el-input
      v-model="raw"
      type="textarea"
      :rows="4"
      spellcheck="false"
      placeholder="粘贴 JWT Token(eyJhbGciOi...)"
    />

    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div v-if="info" class="cards">
        <div class="card">
          <span class="c-lbl">算法 alg</span><span class="c-val">{{ info.alg }}</span>
        </div>
        <div class="card">
          <span class="c-lbl">类型 typ</span><span class="c-val">{{ info.typ }}</span>
        </div>
        <div class="card">
          <span class="c-lbl">签发 iat</span><span class="c-val">{{ info.iatText }}</span>
        </div>
        <div class="card">
          <span class="c-lbl">生效 nbf</span><span class="c-val">{{ info.nbfText }}</span>
        </div>
        <div class="card">
          <span class="c-lbl">过期 exp</span><span class="c-val">{{ info.expText }}</span>
        </div>
        <div class="card">
          <span class="c-lbl">状态</span>
          <span class="c-val" :class="info.statusType">{{ info.status }}</span>
        </div>
      </div>

      <div v-if="header || payload" class="panes">
        <div class="pane">
          <div class="p-head">
            <span>Header</span>
            <el-button size="small" text :icon="CopyDocument" @click="copy(header, '已复制 Header')">复制</el-button>
          </div>
          <pre class="code">{{ header }}</pre>
        </div>
        <div class="pane">
          <div class="p-head">
            <span>Payload</span>
            <el-button size="small" text :icon="CopyDocument" @click="copy(payload, '已复制 Payload')">复制</el-button>
          </div>
          <pre class="code">{{ payload }}</pre>
        </div>
      </div>

      <div v-if="signature" class="sig">
        <span class="s-lbl">Signature(原始串,未校验)</span>
        <code>{{ signature }}</code>
      </div>
    </template>

    <div class="warn">
      安全提示:本工具只做解码展示,<strong>不会验证签名</strong>,因此内容可被伪造;请勿在公共设备上粘贴真实生产环境 Token,所有解析均在本机完成、不会上传。
    </div>
  </div>
</template>

<style scoped>
.jd {
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
.err {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 10%, transparent);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 16px;
  margin-bottom: 16px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-fill-color-light);
  min-width: 0;
}
.c-lbl {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.c-val {
  font-size: 13px;
  word-break: break-all;
}
.c-val.ok {
  color: #16a34a;
}
.c-val.danger {
  color: #ef4444;
}
.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 720px) {
  .panes {
    grid-template-columns: 1fr;
  }
}
.pane {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: hidden;
}
.p-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--card-border);
}
.code {
  margin: 0;
  padding: 12px;
  min-height: 170px;
  max-height: 260px;
  overflow: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--el-bg-color);
}
.sig {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.s-lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sig code {
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  word-break: break-all;
}
.warn {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, #f59e0b 10%, transparent);
  color: var(--el-text-color-regular);
  font-size: 11px;
  line-height: 1.7;
}
</style>
