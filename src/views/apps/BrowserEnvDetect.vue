<script setup lang="ts">
/**
 * 浏览器环境检测
 * 检测并展示当前浏览器的 UA / 平台 / 语言 / 时区 / 屏幕与视口 /
 * 硬件并发 / 内存 / 网络 / WebGL / Canvas 指纹 / 存储配额 / 电量等,
 * 并可一键复制为 JSON,全部在本机检测,无任何上报。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { DocumentCopy, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Item {
  label: string
  value: string
  warn?: boolean
}

const online = ref(navigator.onLine)
const secs = ref(0)
const refreshTick = () => { secs.value++ }

const batteryText = ref('不支持')
const storageText = ref('不支持')

function safe<T>(fn: () => T, fallback = '不可用'): T | string {
  try {
    const v = fn()
    return v === undefined || v === null || v === '' ? fallback : v
  } catch {
    return fallback
  }
}

function webglInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return { vendor: '不支持', renderer: '不支持' }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR))
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    return { vendor, renderer }
  } catch {
    return { vendor: '不可用', renderer: '不可用' }
  }
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px Arial'
    ctx.fillText('uTools 指纹 2026', 8, 34)
    ctx.strokeStyle = 'rgba(99,102,241,0.9)'
    ctx.arc(30, 30, 22, 0, Math.PI * 2)
    ctx.stroke()
    const data = canvas.toDataURL()
    let h = 5381
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0
    return (h >>> 0).toString(16)
  } catch {
    return '不可用'
  }
}

const groups = computed(() => {
  void secs.value // 定时刷新视口类数据
  const gl = webglInfo()
  const conn = (navigator as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean } }
  const basic: Item[] = [
    { label: 'User Agent', value: safe(() => navigator.userAgent) },
    { label: '平台', value: safe(() => nav.userAgentData?.platform || navigator.platform) },
    { label: '语言', value: safe(() => navigator.language + ' / ' + (navigator.languages || []).join(', ')) },
    { label: '时区', value: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone + ' (UTC' + tzOffset() + ')') },
    { label: 'Cookie', value: safe(() => (navigator.cookieEnabled ? '已启用' : '已禁用')) },
    { label: '在线状态', value: online.value ? '在线' : '离线', warn: !online.value },
  ]
  const screenG: Item[] = [
    { label: '屏幕分辨率', value: safe(() => window.screen.width + ' × ' + window.screen.height + ' @' + (window.devicePixelRatio || 1) + 'x') },
    { label: '可用区域', value: safe(() => window.screen.availWidth + ' × ' + window.screen.availHeight) },
    { label: '浏览器窗口', value: safe(() => window.innerWidth + ' × ' + window.innerHeight) },
    { label: '色彩深度 / 触点', value: safe(() => window.screen.colorDepth + ' bit / ' + navigator.maxTouchPoints + ' 点') },
  ]
  const hw: Item[] = [
    { label: 'CPU 线程数', value: safe(() => navigator.hardwareConcurrency + ' 核') },
    { label: '设备内存', value: nav.deviceMemory ? '≥ ' + nav.deviceMemory + ' GB' : '不支持' },
    { label: '网络类型', value: conn ? (conn.effectiveType || '未知') + (conn.downlink ? ' · 下行 ~' + conn.downlink + 'Mb/s' : '') + (conn.rtt ? ' · RTT ' + conn.rtt + 'ms' : '') : '不支持' },
    { label: '省流量模式', value: conn ? (conn.saveData ? '开启' : '未开启') : '不支持' },
    { label: '电量', value: batteryText.value },
  ]
  const gfx: Item[] = [
    { label: 'WebGL 厂商', value: gl.vendor },
    { label: 'WebGL 渲染器', value: gl.renderer },
    { label: 'Canvas 指纹', value: canvasFingerprint() },
  ]
  const storage: Item[] = [
    { label: '存储配额', value: storageText.value },
    { label: 'Do Not Track', value: safe(() => navigator.doNotTrack === '1' ? '开启' : '未开启') },
    { label: 'Session / Local', value: safe(() => `${sessionStorage.length} 条 / ${localStorage.length} 条`) },
  ]
  return [
    { key: 'basic', title: '基本信息', items: basic },
    { key: 'screen', title: '屏幕与视口', items: screenG },
    { key: 'hw', title: '硬件与网络', items: hw },
    { key: 'gfx', title: '图形与指纹', items: gfx },
    { key: 'storage', title: '存储与隐私', items: storage },
  ]
})

function tzOffset(): string {
  const off = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const m = String(Math.abs(off) % 60).padStart(2, '0')
  return sign + h + ':' + m
}

function asJson(): string {
  const flat: Record<string, Record<string, string>> = {}
  for (const g of groups.value) flat[g.title] = Object.fromEntries(g.items.map((i) => [i.label, i.value]))
  return JSON.stringify(flat, null, 2)
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(asJson())
    ElMessage.success('已复制 JSON')
  } catch {
    ElMessage.error('复制失败,请手动选择文本')
  }
}

async function copyItem(it: Item) {
  try {
    await navigator.clipboard.writeText(it.value)
    ElMessage.success(`已复制「${it.label}」`)
  } catch {
    ElMessage.error('复制失败')
  }
}

async function probeBattery() {
  type Battery = { level: number; charging: boolean } | null
  const getB = (navigator as { getBattery?: () => Promise<Battery> }).getBattery
  if (!getB) return
  try {
    const b = await getB()
    if (b) batteryText.value = Math.round(b.level * 100) + '% · ' + (b.charging ? '充电中' : '未充电')
  } catch { /* ignore */ }
}

async function probeStorage() {
  try {
    const est = await navigator.storage?.estimate?.()
    if (est) storageText.value = `已用 ${fmtMb(est.usage || 0)} / 配额 ${fmtMb(est.quota || 0)}`
  } catch { /* ignore */ }
}

function fmtMb(n: number): string {
  return n >= 1024 * 1024 * 1024 ? (n / 1024 / 1024 / 1024).toFixed(2) + ' GB' : (n / 1024 / 1024).toFixed(1) + ' MB'
}

const onOnline = () => (online.value = true)
const onOffline = () => (online.value = false)

onMounted(() => {
  void probeBattery()
  void probeStorage()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('resize', refreshTick)
  timer = window.setInterval(refreshTick, 2000)
})

let timer = 0

onUnmounted(() => {
  window.clearInterval(timer)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('resize', refreshTick)
})
</script>

<template>
  <div class="env">
    <div class="head">
      <div>
        <h3 class="title">浏览器环境检测</h3>
        <p class="sub">检测本机浏览器与系统能力,全部本地完成,不上传任何数据</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="DocumentCopy" @click="copyJson">复制 JSON</el-button>
        <el-button size="small" :icon="Refresh" @click="secs++; void probeBattery(); void probeStorage()">刷新</el-button>
      </div>
    </div>

    <div class="grid">
      <div v-for="g in groups" :key="g.key" class="card">
        <div class="card-title">{{ g.title }}</div>
        <div
          v-for="it in g.items"
          :key="it.label"
          class="item"
          title="点击复制"
          @click="copyItem(it)"
        >
          <span class="lbl">{{ it.label }}</span>
          <span class="val" :class="{ warn: it.warn }">{{ it.value }}</span>
        </div>
      </div>
    </div>

    <p class="foot">提示:点击任意条目即可复制对应值;指纹类信息只用于说明浏览器如何被识别,不会离开本页面。</p>
  </div>
</template>

<style scoped>
.env {
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
.acts {
  display: flex;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-color-primary);
}
.item {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  cursor: pointer;
  align-items: baseline;
}
.item:hover .val {
  color: var(--el-color-primary);
}
.lbl {
  flex: none;
  width: 110px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.val {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  word-break: break-all;
  line-height: 1.5;
}
.val.warn {
  color: #ef4444;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
