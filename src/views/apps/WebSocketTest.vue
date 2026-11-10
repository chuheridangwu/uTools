<script setup lang="ts">
/**
 * WebSocket 在线测试
 * 连接任意 ws/wss 地址,发送文本消息并观察回包、状态与延迟,
 * 记录打开 / 关闭 / 错误事件日志;默认使用公开回显服务。
 */
import { computed, ref } from 'vue'
import { Position, Promotion, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type Status = 'closed' | 'connecting' | 'open'

interface LogItem {
  id: number
  dir: 'out' | 'in' | 'sys'
  text: string
  ms?: number   // 请求到回包的延迟
  hasMs: boolean
}

const wsRef = ref<WebSocket | null>(null)
const status = ref<Status>('closed')
const url = ref('wss://ws.postman-echo.com/raw')
const draft = ref('{"hello": "uTools"}')
const logs = ref<LogItem[]>([])
let uid = 0

const statusText = computed(() => ({ closed: '未连接', connecting: '连接中…', open: '已连接' })[status.value])

/** 出站消息与回包配对:记录发起时间,回包到达时把 ms 写进对应条目 */
const outTimes = [] as { text: string; t: number }[]

function pushOut(text: string) {
  outTimes.push({ text, t: Date.now() })
  if (outTimes.length > 50) outTimes.shift()
  logs.value.push({ id: ++uid, dir: 'out', text, hasMs: false })
}

function pushIn(text: string) {
  const sys = String(text || '')
  const idx = outTimes.findIndex((o) => o.text === sys)
  const ms = idx >= 0 ? Date.now() - outTimes[idx].t : undefined
  if (idx >= 0) outTimes.splice(idx, 1)
  logs.value.push({ id: ++uid, dir: 'in', text: sys, ms, hasMs: ms !== undefined })
}

function pushSys(text: string) {
  logs.value.push({ id: ++uid, dir: 'sys', text, hasMs: false })
}

function setUrlDefault() {
  url.value = 'wss://ws.postman-echo.com/raw'
}

function connect() {
  const addr = url.value.trim()
  if (!addr) {
    ElMessage.warning('请输入 WebSocket 地址')
    return
  }
  if (status.value === 'connecting') return
  disconnect(false)
  status.value = 'connecting'
  pushSys(`连接 ${addr} …`)
  let ws: WebSocket
  try {
    ws = new WebSocket(addr)
  } catch (e) {
    status.value = 'closed'
    pushSys('地址无效:' + (e instanceof Error ? e.message : String(e)))
    return
  }
  wsRef.value = ws
  ws.onopen = () => {
    status.value = 'open'
    pushSys('连接已建立 ✓')
  }
  ws.onmessage = (ev) => pushIn(typeof ev.data === 'string' ? ev.data : '[二进制 ' + (ev.data as Blob)?.size + ' 字节]')
  ws.onerror = () => pushSys('发生错误(地址不可达 / 协议不符 / 证书问题)')
  ws.onclose = (ev) => {
    status.value = 'closed'
    pushSys(`连接关闭(code=${ev.code}${ev.reason ? ' · ' + ev.reason : ''})`)
  }
}

function disconnect(notify = true) {
  const ws = wsRef.value
  if (ws) {
    status.value = 'closed'
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
    try { ws.close() } catch { /* ignore */ }
    wsRef.value = null
    if (notify) pushSys('已主动断开')
  } else if (notify) {
    ElMessage.info('当前没有连接')
  }
}

function send() {
  const text = draft.value
  if (!text) {
    ElMessage.warning('请输入要发送的内容')
    return
  }
  const ws = wsRef.value
  if (!ws || status.value !== 'open') {
    ElMessage.warning('请先连接 WebSocket 服务')
    return
  }
  try {
    ws.send(text)
    pushOut(text)
  } catch (e) {
    pushSys('发送失败:' + (e instanceof Error ? e.message : String(e)))
  }
}

function clearLogs() {
  logs.value = []
  outTimes.length = 0
}

const lastMs = computed(() => {
  for (let i = logs.value.length - 1; i >= 0; i--) {
    const l = logs.value[i]
    if (l.hasMs && l.ms !== undefined) return l.ms
  }
  return null
})
</script>

<template>
  <div class="wst">
    <div class="head">
      <div>
        <h3 class="title">WebSocket 在线测试</h3>
        <p class="sub">连接 ws / wss 地址,发送消息查看回显与状态事件</p>
      </div>
      <div class="acts">
        <el-tag :type="status === 'open' ? 'success' : status === 'connecting' ? 'warning' : 'info'" size="small">
          {{ statusText }}
        </el-tag>
        <span v-if="lastMs !== null" class="latency">上次往返 {{ lastMs }} ms</span>
      </div>
    </div>

    <div class="row">
      <el-input v-model="url" class="addr" placeholder="wss://… 或 ws://…">
        <template #prepend>地址</template>
        <template #append>
          <el-button text size="small" @click="setUrlDefault">恢复默认</el-button>
        </template>
      </el-input>
      <el-button
        v-if="status !== 'open'"
        type="primary"
        :icon="Position"
        :loading="status === 'connecting'"
        @click="connect"
      >连接</el-button>
      <el-button v-else type="danger" :icon="SwitchButton" @click="disconnect()">断开</el-button>
    </div>

    <div class="row">
      <el-input
        v-model="draft"
        class="msg"
        placeholder="要发送的文本消息"
        @keydown.enter.exact.prevent="send"
      />
      <el-button type="primary" :icon="Promotion" :disabled="status !== 'open'" @click="send">发送</el-button>
    </div>

    <div class="log-box">
      <div class="log-head">
        <span>消息日志</span>
        <el-button size="small" text @click="clearLogs">清空</el-button>
      </div>
      <div v-if="!logs.length" class="log-empty">尚未产生消息。连接服务后发送一条文本,回显服务会原样返回。</div>
      <div v-for="l in logs" :key="l.id" class="log" :class="l.dir">
        <span class="badge">{{ l.dir === 'out' ? '↑ 发送' : l.dir === 'in' ? '↓ 接收' : '· 系统' }}</span>
        <span class="txt">{{ l.text }}</span>
        <span v-if="l.hasMs" class="ms">{{ l.ms }} ms</span>
      </div>
    </div>

    <p class="foot">说明:默认地址为公开回显服务,会原样返回你发送的文本;也可填任意受控的 ws/wss 地址。发送与接收会按文本配对计算往返延迟。</p>
  </div>
</template>

<style scoped>
.wst {
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
  align-items: center;
  gap: 10px;
}
.latency {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.addr {
  flex: 1;
  min-width: 0;
}
.msg {
  flex: 1;
  min-width: 0;
}
.log-box {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
}
.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
}
.log-empty {
  padding: 24px 14px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
.log {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 14px;
  border-bottom: 1px dashed var(--card-border);
  font-size: 12px;
}
.log:last-child {
  border-bottom: none;
}
.badge {
  flex: none;
  width: 48px;
  color: var(--el-text-color-secondary);
}
.log.out .badge {
  color: #f59e0b;
}
.log.in .badge {
  color: #16a34a;
}
.log.sys {
  color: var(--el-text-color-placeholder);
}
.txt {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  word-break: break-all;
  line-height: 1.5;
}
.ms {
  flex: none;
  font-size: 11px;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
