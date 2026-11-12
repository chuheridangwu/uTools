<script setup lang="ts">
/**
 * 两步验证码(2FA / TOTP)
 * 纯前端实现 RFC 6238:base32 密钥 → HMAC → 动态截断 → 6/7/8 位验证码。
 * 支持 otpauth:// 链接导入、多账户、倒计时进度环;密钥仅存本机 localStorage。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Delete, Plus, Refresh, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

interface Account {
  id: string
  label: string
  issuer: string
  secret: string
  digits: number
  period: number
  algo: 'SHA-1' | 'SHA-256' | 'SHA-512'
}

const KEY = 'utools_totp'
/**
 * 用常量而不是内联字符串:vue-tsc 3.3.14 处理模板里含 "://" 的静态属性值时
 * 会把它当类型解析,导致同一节点上的 v-model 目标被误判(报 Property 'value' does not exist)。
 */
const URI_PLACEHOLDER = 'otpauth://totp/...?secret=...'
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const accounts = reactive<{ list: Account[] }>({ list: [] })
const codes = reactive<Record<string, string>>({})
const now = ref(Math.floor(Date.now() / 1000))

function base32Decode(input: string): Uint8Array {
  const s = input.replace(/=+$/, '').replace(/[\s-]+/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of s) {
    const idx = B32.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

async function totp(acc: Account): Promise<string> {
  const key = base32Decode(acc.secret)
  if (!key.length) return '------'
  const counter = Math.floor(now.value / acc.period)
  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  dv.setUint32(0, Math.floor(counter / 2 ** 32))
  dv.setUint32(4, counter >>> 0)
  const ck = await crypto.subtle.importKey('raw', key as unknown as BufferSource, { name: 'HMAC', hash: acc.algo }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf))
  const offset = sig[sig.length - 1] & 0x0f
  const num = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3]
  return String(num % 10 ** acc.digits).padStart(acc.digits, '0')
}

async function refreshCodes() {
  for (const acc of accounts.list) {
    try {
      codes[acc.id] = await totp(acc)
    } catch {
      codes[acc.id] = '------'
    }
  }
}

let timer: number | null = null

function progress(acc: Account): number {
  return Math.round(((acc.period - (now.value % acc.period)) / acc.period) * 100)
}

function fmtCode(id: string): string {
  const c = codes[id] || '------'
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c
}

function fmtCodeForCopy(id: string): string {
  return codes[id] || ''
}

/* ------------------------------ 新增 / 导入 ------------------------------ */
const dialog = reactive({
  visible: false,
  label: '',
  issuer: '',
  secret: '',
  digits: 6,
  period: 30,
  algo: 'SHA-1' as Account['algo'],
  uri: '',
})

function openAdd() {
  dialog.visible = true
  dialog.label = ''
  dialog.issuer = ''
  dialog.secret = ''
  dialog.digits = 6
  dialog.period = 30
  dialog.algo = 'SHA-1'
  dialog.uri = ''
}

function importUri() {
  const raw = dialog.uri.trim()
  if (!raw) return
  try {
    const u = new URL(raw)
    const params = u.searchParams
    const secret = params.get('secret') || ''
    if (!secret) {
      ElMessage.warning('链接里没有 secret')
      return
    }
    dialog.secret = secret
    dialog.issuer = params.get('issuer') || ''
    const label = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    dialog.label = label || dialog.issuer
    dialog.digits = Number(params.get('digits') || 6)
    dialog.period = Number(params.get('period') || 30)
    const alg = (params.get('algorithm') || 'SHA1').toUpperCase().replace(/[^A-Z0-9-]/g, '')
    dialog.algo = (alg === 'SHA256' ? 'SHA-256' : alg === 'SHA512' ? 'SHA-512' : 'SHA-1')
    ElMessage.success('已解析,请确认后保存')
  } catch {
    ElMessage.error('不是有效的 otpauth 链接')
  }
}

async function save() {
  if (!dialog.secret.trim()) {
    ElMessage.warning('请填写 base32 密钥或导入链接')
    return
  }
  const acc: Account = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: dialog.label.trim() || '未命名账户',
    issuer: dialog.issuer.trim(),
    secret: dialog.secret.replace(/\s+/g, '').toUpperCase(),
    digits: dialog.digits,
    period: dialog.period,
    algo: dialog.algo,
  }
  accounts.list.push(acc)
  persist()
  dialog.visible = false
  await refreshCodes()
  ElMessage.success('已添加')
}

function remove(id: string) {
  accounts.list = accounts.list.filter((a) => a.id !== id)
  delete codes[id]
  persist()
}

async function copy(id: string) {
  const c = fmtCodeForCopy(id)
  if (!c) return
  await copyText(c)
  ElMessage.success('验证码已复制')
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(accounts.list))
}

function load() {
  try {
    accounts.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    accounts.list = []
  }
}

onMounted(async () => {
  load()
  await refreshCodes()
  timer = window.setInterval(async () => {
    now.value = Math.floor(Date.now() / 1000)
    if (now.value % 5 === 0) await refreshCodes()
  }, 1000)
  // 立即补算一次
  await refreshCodes()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="totp">
    <div class="head">
      <div>
        <h3 class="title">两步验证码</h3>
        <p class="sub">基于 RFC 6238 的 TOTP,全部本地计算,密钥不出浏览器</p>
      </div>
      <div class="head-acts">
        <el-button size="small" :icon="Refresh" @click="refreshCodes">刷新</el-button>
        <el-button size="small" type="primary" :icon="Plus" @click="openAdd">添加账户</el-button>
      </div>
    </div>

    <div v-if="!accounts.list.length" class="empty">
      <el-icon :size="30"><Upload /></el-icon>
      <p>还没有账户,点击「添加账户」粘贴 base32 密钥或 otpauth:// 链接</p>
    </div>

    <div class="list">
      <div v-for="a in accounts.list" :key="a.id" class="card">
        <el-progress
          type="circle"
          :width="58"
          :stroke-width="5"
          :percentage="progress(a)"
          :color="progress(a) < 20 ? '#f56c6c' : '#14b8a6'"
        >
          <span class="left">{{ a.period - (now % a.period) }}s</span>
        </el-progress>
        <div class="meta">
          <div class="label">{{ a.label }}</div>
          <div class="issuer">{{ a.issuer }} · {{ a.digits }} 位 · {{ a.algo }}</div>
          <div class="code" @click="copy(a.id)">{{ fmtCode(a.id) }}</div>
        </div>
        <div class="acts">
          <el-button text size="small" :icon="Refresh" @click="refreshCodes" />
          <el-button text size="small" type="danger" :icon="Delete" @click="remove(a.id)" />
        </div>
      </div>
    </div>

    <el-dialog v-model="dialog.visible" title="添加 2FA 账户" width="440px">
      <el-form label-width="72px" size="small">
        <el-form-item label="导入链接">
          <div class="uri-row">
            <el-input v-model="dialog.uri" :placeholder="URI_PLACEHOLDER" />
            <el-button size="small" @click="importUri">解析</el-button>
          </div>
        </el-form-item>
        <el-form-item label="密钥">
          <el-input v-model="dialog.secret" placeholder="base32 密钥,例如 JBSWY3DPEHPK3PXP" />
        </el-form-item>
        <el-form-item label="账户名">
          <el-input v-model="dialog.label" placeholder="如 alice@example.com" />
        </el-form-item>
        <el-form-item label="签发方">
          <el-input v-model="dialog.issuer" placeholder="如 GitHub" />
        </el-form-item>
        <el-form-item label="位数">
          <el-radio-group v-model="dialog.digits">
            <el-radio-button :value="6">6</el-radio-button>
            <el-radio-button :value="7">7</el-radio-button>
            <el-radio-button :value="8">8</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="周期">
          <el-input-number v-model="dialog.period" :min="10" :max="120" />
        </el-form-item>
        <el-form-item label="算法">
          <el-select v-model="dialog.algo" style="width: 140px">
            <el-option value="SHA-1" label="SHA-1" />
            <el-option value="SHA-256" label="SHA-256" />
            <el-option value="SHA-512" label="SHA-512" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.totp {
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
.head-acts {
  display: flex;
  gap: 8px;
}
.empty {
  text-align: center;
  padding: 50px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.card {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px;
}
.left {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
}
.meta {
  flex: 1;
  min-width: 0;
}
.label {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.issuer {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.code {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
  color: #14b8a6;
  cursor: pointer;
  user-select: all;
}
.acts {
  display: flex;
  flex-direction: column;
  flex: none;
}
.uri-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
