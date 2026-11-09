<script setup lang="ts">
/**
 * 局域网文件直传
 * 参考找Tab「局域网文件共享」的做法:
 *  - 打开页面自动分配一个不重复的随机动物昵称,并加入在线设备大厅
 *  - 点「连接」向对方发起邀请 → 对方接受/拒绝(拒绝时发起端收到提示)
 *  - 接受后进入双面板:双方都可以发送(点击或拖入)与接收文件,另附文本互传
 *
 * 实现方式:在线名单与配对信令走公共 MQTT(WebSocket)通道;文件与文本本体走
 * WebRTC DataChannel 设备直连,不经过任何服务器中转。MQTT 不可达时可用
 * 「手动配对码」兜底(复制粘贴 SDP + 二维码)。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import QRCode from 'qrcode'
import {
  Cellphone,
  Close,
  CopyDocument,
  Delete,
  Download,
  Monitor,
  Position,
  Promotion,
  Refresh,
  Share,
  UploadFilled,
} from '@element-plus/icons-vue'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, formatSize } from '@/utils/common'

/* ------------------------------ 类型 ------------------------------ */
interface Peer {
  id: string
  name: string
  platform: string
  lastSeen: number
}

interface QueueFile {
  id: string
  name: string
  size: number
  sent: number
  done: boolean
}

interface IncomingFile {
  id: string
  name: string
  size: number
  mime: string
  received: number
  parts: Blob[]
  url: string
}

type Mode = 'lobby' | 'manual'

/* ------------------------------ 身份 ------------------------------ */
const COLORS = ['灰色', '橙色', '蓝色', '绿色', '粉色', '紫色', '白色', '金色', '银色', '红色', '青色', '黑色']
const ANIMALS = ['松鼠', '刺猬', '小鹿', '兔子', '考拉', '海豚', '熊猫', '狐狸', '乌龟', '猫头鹰', '河马', '小猫', '柴犬', '水獭', '小熊']
const myId = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)
const myName = ref('')
const platform = platformLabel()

function platformLabel(): string {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android' : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : '设备'
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '浏览器'
  return `${os} ${br}`
}

function randomName(): string {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)]
  const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return c + a
}

function uniquifyName(base: string): string {
  const taken = new Set([...peers.value.map((p) => p.name)])
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) if (!taken.has(base + i)) return base + i
  return base
}

/* ------------------------------ 状态 ------------------------------ */
const mode = ref<Mode>('lobby')
const lobbyState = ref<'connecting' | 'ok' | 'error'>('connecting')
let lobbyJoined = false
const peers = ref<Peer[]>([])

/** 本页网址二维码:手机扫码直接打开 */
const pageUrl = ref(window.location.origin + window.location.pathname)
const pageQr = ref('')
const connected = ref(false)
const peerName = ref('')
const busy = ref(false)

/** 邀请(发起端发出后等待响应) */
const awaitingPeer = ref<Peer | null>(null)
const incomingInvite = ref<Peer | null>(null)

const pc = ref<RTCPeerConnection | null>(null)
const channel = ref<RTCDataChannel | null>(null)
const statusText = ref('')
const debugNote = ref('')

/** 发送/接收 */
const sendQueue = ref<QueueFile[]>([])
const incomingFiles = ref<IncomingFile[]>([])
const fileInputEl = ref<HTMLInputElement>()
const dragOver = ref(false)

/** 文本互传 */
const myText = ref('')
const receivedTexts = ref<string[]>([])

/** 速度显示 */
const speedText = ref('')
let speedWindow = 0
let speedTimer: number | null = null

const CHUNK_SIZE = 64 * 1024
const BUFFER_HIGH = 4 * 1024 * 1024
const BUFFER_LOW = 2 * 1024 * 1024

const urls = new Set<string>()

/* --------------------------- MQTT(在线名单 + 信令) --------------------------- */
const LOBBY_TOPIC = 'utools/lanx/lobby/v1'
const sigTopicOf = (id: string) => `utools/lanx/sig/v1/${id}`
let mqttClient: { publish: (topic: string, payload: string) => void; subscribe: (topic: string) => void; end: (force?: boolean) => void } | null = null
let presenceTimer: number | null = null
let pruneTimer: number | null = null

async function joinLobby() {
  myName.value = myName.value || uniquifyName(randomName())
  lobbyState.value = 'connecting'
  try {
    const mqttMod = await import('mqtt')
    const client = mqttMod.default.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: 'utools-lanx-' + myId,
      keepalive: 30,
      reconnectPeriod: 4000,
      connectTimeout: 8000,
    })
    mqttClient = client as unknown as typeof mqttClient
    client.on('connect', () => {
      lobbyState.value = 'ok'
      lobbyJoined = true
      client.subscribe([LOBBY_TOPIC, sigTopicOf(myId)])
      void announce(true)
    })
    client.on('message', (_topic, payload) => void handleSignal(JSON.parse(payload.toString())))
    client.on('error', () => {
      if (lobbyState.value !== 'ok') lobbyState.value = 'error'
    })
    await new Promise<void>((resolve) => {
      client.once('connect', () => resolve())
      setTimeout(() => resolve(), 8000)
    })
    if ((lobbyState.value as string) !== 'ok') lobbyState.value = 'error'
    presenceTimer = window.setInterval(() => void announce(false), 2500)
    pruneTimer = window.setInterval(prunePeers, 4000)
  } catch {
    lobbyState.value = 'error'
  }
}

async function announce(restart: boolean) {
  if (!mqttClient || lobbyState.value !== 'ok') return
  mqttClient.publish(LOBBY_TOPIC, JSON.stringify({ t: 'hi', id: myId, name: myName.value, platform, ts: Date.now() }))
  // 重进大厅时清理旧在线(2 秒后本端的心跳会补齐)
  if (restart) peers.value = []
}

function prunePeers() {
  const now = Date.now()
  peers.value = peers.value.filter((p) => now - p.lastSeen < 7000)
}

function leaveLobby() {
  try { mqttClient?.publish(LOBBY_TOPIC, JSON.stringify({ t: 'bye', id: myId })) } catch { /* noop */ }
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null }
  if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null }
}

function sig(to: string | null, msg: Record<string, unknown>) {
  const payload = JSON.stringify({ ...msg, from: myId, fromName: myName.value, platform, to })
  mqttClient?.publish(to ? sigTopicOf(to) : LOBBY_TOPIC, payload)
}

interface SignalMsg { t: string; from: string; fromName: string; platform: string; to?: string; id?: string; name?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }

async function handleSignal(msg: SignalMsg) {
  if (msg.t === 'hi') {
    if (msg.id === myId) return
    const list = [...peers.value]
    const exist = list.find((p) => p.id === msg.id)
    if (exist) exist.lastSeen = Date.now()
    else {
      // 重名不重复:自动加序号
      const key = msg.name || msg.id || '设备'
      const name = uniquifyName(key)
      list.push({ id: msg.id || key, name, platform: msg.platform || '', lastSeen: Date.now() })
    }
    peers.value = list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    return
  }
  if (msg.t === 'bye') {
    peers.value = peers.value.filter((p) => p.id !== msg.id)
    return
  }
  if (msg.to !== myId) return // 只处理点名给本端的信令

  if (msg.t === 'invite') {
    if (connected.value || busy.value || incomingInvite.value) {
      sig(msg.from, { t: 'reject' })
      return
    }
    busy.value = true
    try {
      await ElMessageBox.confirm(
        `${msg.fromName || '对方'}(${msg.platform || '未知设备'})请求与你建立直连传输,是否接受?`,
        '连接请求',
        { confirmButtonText: '接受', cancelButtonText: '拒绝', type: 'info', distinguishCancelAndClose: true },
      )
      const inviterId = msg.from || msg.id || ''
      const inviterName = msg.fromName || '对方'
      incomingInvite.value = { id: inviterId, name: inviterName, platform: msg.platform || '未知设备', lastSeen: Date.now() }
      peerName.value = inviterName
      statusText.value = `正在与 ${inviterName} 建立直连…`
      sig(msg.from, { t: 'accept' })
      preparePeerConnection(false) // 接收方:等待 offer
    } catch (action) {
      if (action === 'cancel') {
        sig(msg.from, { t: 'reject' })
        ElMessage.info('已拒绝连接')
      }
      // close 什么都不做
    } finally {
      busy.value = false
    }
    return
  }

  if (msg.t === 'accept' && awaitingPeer.value) {
    // 对方接受了:发起端创建 offer
    peerName.value = awaitingPeer.value.name
    statusText.value = `正在与 ${peerName.value} 建立直连…`
    preparePeerConnection(true)
    const p = pc.value!
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    sig(awaitingPeer.value.id, { t: 'offer', sdp: p.localDescription })
    return
  }

  if (msg.t === 'reject' && awaitingPeer.value) {
    const name = awaitingPeer.value.name
    ElMessage.warning(`${name} 拒绝了连接`)
    statusText.value = `${name} 拒绝了连接`
    awaitingPeer.value = null
    teardown()
    return
  }

  if (msg.t === 'offer') {
    const p = pc.value
    if (!p) return
    await p.setRemoteDescription(msg.sdp!)
    const answer = await p.createAnswer()
    await p.setLocalDescription(answer)
    sig(msg.from, { t: 'answer', sdp: p.localDescription })
    return
  }

  if (msg.t === 'answer') {
    const p = pc.value
    if (!p) return
    if (p.signalingState !== 'have-local-offer') return
    await p.setRemoteDescription(msg.sdp!)
    return
  }

  if (msg.t === 'ice' && msg.candidate) {
    const p = pc.value
    if (!p) return
    try { await p.addIceCandidate(msg.candidate) } catch { /* 忽略乱序候选 */ }
  }
}

/** 点击列表中的设备发起连接 */
function connectTo(peer: Peer) {
  if (connected.value || awaitingPeer.value) {
    ElMessage.warning('已有连接在进行中,请先断开')
    return
  }
  awaitingPeer.value = peer
  statusText.value = `正在等待 ${peer.name} 接受…`
  sig(peer.id, { t: 'invite' })
  // 30 秒未响应自动取消
  setTimeout(() => {
    if (awaitingPeer.value && !connected.value) {
      ElMessage.warning(`${peer.name} 未响应`)
      awaitingPeer.value = null
      statusText.value = ''
    }
  }, 30000)
}

/* --------------------------- WebRTC --------------------------- */
function newPeer(): RTCPeerConnection {
  const p = new RTCPeerConnection({
    // 局域网直连走主机候选即可;STUN 仅作跨网段兜底,文件数据依然点对点不经服务器
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  })
  const note = () => { debugNote.value = `${p.iceConnectionState}/${p.connectionState}` }
  note()
  p.addEventListener('icegatheringstatechange', note)
  p.addEventListener('iceconnectionstatechange', note)
  p.addEventListener('connectionstatechange', note)
  p.onicecandidate = (e) => {
    const target = awaitingPeer.value ?? incomingInvite.value
    if (e.candidate && target) sig(target.id, { t: 'ice', candidate: e.candidate })
  }
  return p
}

/**
 * @param asOfferer true=发起端(创建 DataChannel + offer);false=接收端(等待 ondatachannel + offer)
 */
function preparePeerConnection(asOfferer: boolean) {
  const p = newPeer()
  pc.value = p
  if (asOfferer) {
    const ch = p.createDataChannel('files', { ordered: true })
    ch.binaryType = 'arraybuffer'
    channel.value = ch
    bindChannel(ch)
  } else {
    p.ondatachannel = (e) => {
      const ch = e.channel
      ch.binaryType = 'arraybuffer'
      channel.value = ch
      bindChannel(ch)
    }
  }
}

function bindChannel(ch: RTCDataChannel) {
  ch.onopen = () => {
    connected.value = true
    incomingInvite.value = null
    awaitingPeer.value = null
    statusText.value = peerName.value ? `已连接 · ${peerName.value}` : '已连接 · 可开始传输'
  }
  ch.onclose = () => {
    if (!connected.value) return
    connected.value = false
    stopSpeedTimer()
    sending = false
    ackResolvers.clear()
    // 手动模式下回到初始选择界面,避免旧配对码干扰下一轮
    if (mode.value === 'manual') resetManual()
    statusText.value = '对方已断开连接'
    ElMessage.warning('对方已断开连接')
  }
  ch.onmessage = (e) => handleData(e.data)
}

/* --------------------------- 断开 / 清理 --------------------------- */
function teardown() {
  try { channel.value?.close() } catch { /* noop */ }
  try { pc.value?.close() } catch { /* noop */ }
  pc.value = null
  channel.value = null
  connected.value = false
  stopSpeedTimer()
  if (urls.size) {
    urls.forEach((u) => URL.revokeObjectURL(u))
    urls.clear()
  }
}

function disconnect() {
  teardown()
  sendQueue.value = []
  incomingFiles.value = []
  receivedTexts.value = []
  myText.value = ''
  sending = false
  activeRecvId = ''
  pendingFiles.clear()
  ackResolvers.clear()
  pullMap.clear()
  incomingInvite.value = null
  awaitingPeer.value = null
  peerName.value = ''
  statusText.value = '未连接'
}

onBeforeUnmount(() => {
  leaveLobby()
  disconnect()
})

/* --------------------------- 传输协议 --------------------------- *
 * 帧序:meta(json) → 若干二进制块(严格串行,一次一个文件)→ done(json)
 * 接收端回执 ack(json) 后发送端传下一个文件。
 * --------------------------------------------------------------- */
interface WireMeta { t: 'meta'; id: string; name: string; size: number; type: string }
interface WireDone { t: 'done'; id: string }
interface WireAck { t: 'ack'; id: string }
interface WireText { t: 'text'; text: string }
type WireCtl = WireMeta | WireDone | WireAck | WireText

const pullMap = new Map<string, IncomingFile>()
let activeRecvId = ''

function handleData(data: string | ArrayBuffer | Blob) {
  if (typeof data === 'string') {
    const msg = JSON.parse(data) as WireCtl
    if (msg.t === 'meta') {
      pullMap.set(msg.id, {
        id: msg.id,
        name: msg.name,
        size: msg.size,
        mime: msg.type || 'application/octet-stream',
        received: 0,
        parts: [],
        url: '',
      })
      activeRecvId = msg.id
      incomingFiles.value = [...pullMap.values()]
    } else if (msg.t === 'done') {
      const item = pullMap.get(msg.id)
      if (item) {
        const blob = new Blob(item.parts, { type: item.mime })
        const url = URL.createObjectURL(blob)
        urls.add(url)
        item.url = url
        incomingFiles.value = [...pullMap.values()]
        void channel.value?.send(JSON.stringify({ t: 'ack', id: msg.id }))
      }
      activeRecvId = ''
    } else if (msg.t === 'ack') {
      const resolve = ackResolvers.get(msg.id)
      resolve?.()
      ackResolvers.delete(msg.id)
    } else if (msg.t === 'text') {
      receivedTexts.value = [msg.text, ...receivedTexts.value].slice(0, 50)
    }
    return
  }
  if (data instanceof ArrayBuffer && activeRecvId) {
    const item = pullMap.get(activeRecvId)
    if (item) {
      item.parts.push(new Blob([data]))
      item.received += data.byteLength
      speedWindow += data.byteLength
      incomingFiles.value = [...pullMap.values()]
    }
  }
}

/* --------------------------- 发送端 --------------------------- */
function pickFiles() { fileInputEl.value?.click() }

function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  enqueueFiles(Array.from(input.files ?? []))
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  enqueueFiles(Array.from(e.dataTransfer?.files ?? []))
}

function enqueueFiles(picked: File[]) {
  if (!picked.length) return
  for (const file of picked) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    pendingFiles.set(id, file)
    sendQueue.value = [...sendQueue.value, { id, name: file.name, size: file.size, sent: 0, done: false }]
  }
  void drainQueue()
}

const pendingFiles = new Map<string, File>()
const ackResolvers = new Map<string, () => void>()
let sending = false

async function drainQueue() {
  const ch = channel.value
  if (sending || !ch || ch.readyState !== 'open') return
  sending = true
  startSpeedTimer()
  try {
    for (const q of sendQueue.value) {
      const file = pendingFiles.get(q.id)
      if (q.done || !file) continue
      ch.send(JSON.stringify({ t: 'meta', id: q.id, name: q.name, size: file.size, type: file.type }))
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        const slice = file.slice(offset, offset + CHUNK_SIZE)
        const buf = await slice.arrayBuffer()
        ch.send(buf)
        q.sent += buf.byteLength
        speedWindow += buf.byteLength
        await waitDrain(ch)
      }
      ch.send(JSON.stringify({ t: 'done', id: q.id }))
      await waitAck(q.id)
      q.done = true
      sendQueue.value = [...sendQueue.value]
    }
  } catch (err) {
    statusText.value = `传输中断:${(err as Error).message}`
    sending = false
    return
  }
  sending = false
}

/** 背压控制:发送缓冲超过阈值时等缓冲放低再继续,避免内存暴涨 */
function waitDrain(ch: RTCDataChannel): Promise<void> {
  if (ch.bufferedAmount < BUFFER_HIGH) return Promise.resolve()
  return new Promise((resolve) => {
    ch.bufferedAmountLowThreshold = BUFFER_LOW
    const h = () => {
      ch.removeEventListener('bufferedamountlow', h)
      resolve()
    }
    ch.addEventListener('bufferedamountlow', h)
  })
}

async function waitAck(id: string): Promise<void> {
  await new Promise<void>((resolve) => {
    ackResolvers.set(id, resolve)
    // 兜底:15 秒收不到回执则继续,避免整队卡死
    setTimeout(() => {
      if (ackResolvers.has(id)) {
        ackResolvers.delete(id)
        resolve()
      }
    }, 15000)
  })
  const ch = channel.value
  if (ch) await waitDrain(ch)
}

function startSpeedTimer() {
  stopSpeedTimer()
  speedWindow = 0
  speedTimer = window.setInterval(() => {
    const bytes = speedWindow
    speedWindow = 0
    speedText.value = bytes === 0 ? '' : `${formatSize(bytes)}/s`
  }, 1000)
}

function stopSpeedTimer() {
  if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
  speedText.value = ''
}

async function sendText() {
  const ch = channel.value
  const text = myText.value.trim()
  if (!ch || ch.readyState !== 'open' || !text) return
  ch.send(JSON.stringify({ t: 'text', text }))
  myText.value = ''
}

const overallProgress = computed(() => {
  const total = sendQueue.value.reduce((s, q) => s + q.size, 0)
  const sent = sendQueue.value.reduce((s, q) => s + q.sent, 0)
  return total === 0 ? 0 : Math.round((sent / total) * 100)
})

/* --------------------------- 手动配对兜底 --------------------------- */
/* 逻辑与大厅版一致,只是信令改为复制粘贴码;用于公共 MQTT 不可达的环境 */
async function packCode(desc: RTCSessionDescriptionInit): Promise<string> {
  const json = JSON.stringify(desc)
  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))
      const buf = await new Response(stream).arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return 'LT1:' + btoa(bin)
    }
  } catch { /* 退化 base64 */ }
  return 'LT0:' + btoa(unescape(encodeURIComponent(json)))
}

async function unpackCode(code: string): Promise<RTCSessionDescriptionInit> {
  const trimmed = code.trim()
  if (trimmed.startsWith('LT1:')) {
    const bin = atob(trimmed.slice(4))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return JSON.parse(await new Response(stream).text())
  }
  if (trimmed.startsWith('LT0:')) {
    return JSON.parse(decodeURIComponent(escape(atob(trimmed.slice(4)))))
  }
  return JSON.parse(trimmed)
}

async function renderQr(text: string, opts?: { width?: number; ec?: 'L' | 'M' }): Promise<string> {
  try {
    // 长内容(配对码 ~500 字符)必须高分辨率生成 + 低纠错,否则模块过密扫不出来
    return await QRCode.toDataURL(text, {
      width: opts?.width ?? 600,
      margin: 2,
      errorCorrectionLevel: opts?.ec ?? 'L',
    })
  } catch {
    return ''
  }
}

const manualMyCode = ref('')
const manualMyQr = ref('')
const manualPeerCode = ref('')
/** manual 面板阶段:true=已生成我的码(发送方等待粘应答码);false=还没生成 */
const manualIsSender = ref(false)
const manualCodePlaceholder = '粘贴对方回传的配对码(LT1:…)'

function switchMode(m: Mode) {
  resetManual()
  disconnect()
  mode.value = m
  if (m === 'lobby' && !lobbyJoined && lobbyState.value !== 'connecting') void joinLobby()
}

function receiverHint() {
  ElMessage.info('把对方生成的邀请码粘贴到下方输入框,再点「粘贴邀请码,生成应答码」')
}
void receiverHint

async function startManualSender() {
  resetManual()
  manualIsSender.value = true
  peerName.value = '对方'
  connectingUI.value = true
  statusText.value = '正在生成邀请码…'
  try {
    if (!pc.value) prepareManualPeer(true)
    const p = pc.value!
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    await waitIceGather(p)
    const code = await packCode(p.localDescription!)
    manualMyCode.value = code
    manualMyQr.value = await renderQr(code)
    statusText.value = '等待对方应答码…'
  } catch (err) {
    statusText.value = `生成邀请码失败:${(err as Error).message}`
    teardown()
    teardownStatus()
  } finally {
    connectingUI.value = false
  }
}

/** teardown 之后恢复状态栏默认文本 */
function teardownStatus() {
  statusText.value = '未连接'
}

function prepareManualPeer(asOfferer: boolean) {
  const p = newPeer()
  pc.value = p
  if (asOfferer) {
    const ch = p.createDataChannel('files', { ordered: true })
    ch.binaryType = 'arraybuffer'
    channel.value = ch
    bindChannel(ch)
  } else {
    p.ondatachannel = (e) => {
      const ch = e.channel
      ch.binaryType = 'arraybuffer'
      channel.value = ch
      bindChannel(ch)
    }
  }
}

async function waitIceGather(p: RTCPeerConnection): Promise<void> {
  if (p.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    p.addEventListener('icegatheringstatechange', () => { if (p.iceGatheringState === 'complete') done() })
    setTimeout(done, 4000)
  })
}

const connectingUI = ref(false)

async function startManualReceiver() {
  const pasted = manualPeerCode.value.trim()
  if (!pasted) {
    ElMessage.warning('请先把对方的邀请码粘贴到输入框')
    return
  }
  if (manualMyCode.value) return // 已生成应答码,等连接即可
  resetManual()
  manualPeerCode.value = pasted // 重置会清空输入框,回填保留
  manualIsSender.value = false
  peerName.value = '对方'
  connectingUI.value = true
  statusText.value = '正在解析邀请码…'
  try {
    const offer = await unpackCode(pasted)
    if (offer.type !== 'offer') throw new Error('这不是邀请码(应为 offer 类型)')
    prepareManualPeer(false)
    const p = pc.value!
    await p.setRemoteDescription(offer)
    const answer = await p.createAnswer()
    await p.setLocalDescription(answer)
    await waitIceGather(p)
    const code = await packCode(p.localDescription!)
    manualMyCode.value = code
    manualMyQr.value = await renderQr(code)
    statusText.value = '把应答码回传给对方,等待连接建立…'
  } catch (err) {
    statusText.value = `邀请码无效:${(err as Error).message}`
    ElMessage.error(statusText.value)
    teardown()
    teardownStatus()
  } finally {
    connectingUI.value = false
  }
}

async function acceptManualAnswer() {
  const p = pc.value
  if (!p || !manualPeerCode.value.trim()) {
    ElMessage.warning('请先粘贴对方回传的应答码')
    return
  }
  connectingUI.value = true
  try {
    const answer = await unpackCode(manualPeerCode.value)
    if (answer.type !== 'answer') throw new Error('这不是应答码(应为 answer 类型)')
    await p.setRemoteDescription(answer)
    statusText.value = '正在建立连接…'
  } catch (err) {
    statusText.value = `应答码无效:${(err as Error).message}`
    ElMessage.error(statusText.value)
  } finally {
    connectingUI.value = false
  }
}

function resetManual() {
  if (pc.value || channel.value) disconnect()
  manualMyCode.value = ''
  manualMyQr.value = ''
  manualPeerCode.value = ''
  statusText.value = '未连接'
}

onMounted(() => {
  if (mode.value === 'lobby') void joinLobby()
  void renderQr(pageUrl.value, { width: 400, ec: 'M' }).then((qr) => { pageQr.value = qr })
})

</script>

<template>
  <ToolPage>
    <template #title>局域网文件直传</template>
    <template #desc>
      同一 WiFi 下两台设备打开本页,一键互传文件(手机 ↔ 电脑),文件与文本通过 WebRTC 设备直连,不经任何服务器中转。
      在线名单经公共 MQTT 通道可见;公共通道不可达时可切换「手动配对」用复制粘贴码连接。
    </template>

    <!-- 手动模式切换入口 -->
    <div class="mode-row">
      <el-radio-group v-model="mode" size="small" @update:model-value="(m: unknown) => switchMode(m as Mode)">
        <el-radio-button value="lobby">在线设备(推荐)</el-radio-button>
        <el-radio-button value="manual">手动配对码(备用)</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ────────────── 在线设备大厅 ────────────── -->
    <template v-if="mode === 'lobby'">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">附近设备</span>
          <span class="head-hint">
            <template v-if="lobbyState === 'connecting'">正在连接设备大厅…</template>
            <template v-else-if="lobbyState === 'error'">公共大厅不可达,可切到「手动配对码」</template>
            <template v-else>当前在线设备 {{ peers.length + 1 }} 台(等一会儿别人的名字就会出现)</template>
          </span>
        </div>

        <!-- 本页网址二维码:手机扫码直接打开 -->
        <div class="qr-row">
          <img v-if="pageQr" :src="pageQr" class="qr-img" alt="本页网址二维码" />
          <div class="qr-main">
            <div class="qr-title">手机扫码打开本页</div>
            <div class="qr-url" :title="pageUrl">{{ pageUrl }}</div>
            <div class="qr-actions">
              <el-button size="small" :icon="CopyDocument" @click="copyText(pageUrl)">复制网址</el-button>
              <span class="hint">同一 WiFi 下扫码即可加入;本地开发时二维码指向 localhost</span>
            </div>
          </div>
        </div>

        <!-- 本机 -->
        <div class="device self">
          <el-icon :size="22"><Monitor /></el-icon>
          <div class="d-meta">
            <div class="d-name">{{ myName || '正在分配昵称…' }}</div>
            <div class="d-sub">本机 · {{ platform }}</div>
          </div>
          <span class="d-online">在线</span>
        </div>

        <!-- 其他设备 -->
        <div v-for="p in peers" :key="p.id" class="device">
          <el-icon :size="22"><Cellphone /></el-icon>
          <div class="d-meta">
            <div class="d-name">{{ p.name }}</div>
            <div class="d-sub">{{ p.platform }}</div>
          </div>
          <el-button
            type="primary"
            size="small"
            :icon="Position"
            :disabled="connected || !!incomingInvite || (!!awaitingPeer && awaitingPeer.id !== p.id)"
            @click="connectTo(p)"
          >
            连接
          </el-button>
        </div>
        <div v-if="lobbyState === 'ok' && !peers.length" class="empty-hint">
          其他设备还没有出现,在同一 WiFi(或任意可上网网络)下用其他设备打开本页即可看到。
        </div>
      </div>

      <!-- 发起端等待中提示 -->
      <div v-if="awaitingPeer && !connected" class="panel pending">
        <el-icon class="spin"><Refresh /></el-icon>
        <span>正在等待 {{ awaitingPeer.name }} 接受{{ debugNote ? ` (${debugNote})` : '' }}…</span>
        <el-button size="small" text @click="() => { awaitingPeer = null; disconnect() }">取消</el-button>
      </div>
    </template>

    <!-- ────────────── 手动配对(兜底) ────────────── -->
    <template v-if="mode === 'manual' && !connected">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">手动配对</span>
          <span class="head-hint">三步复制粘贴;电脑与手机之间可直接扫二维码</span>
        </div>

        <template v-if="!manualMyCode">
          <div class="choose">
            <el-button type="primary" :icon="UploadFilled" @click="startManualSender">我是发送方(生成邀请码)</el-button>
            <span class="hint">—— 或 ——</span>
            <el-button :icon="Download" @click="receiverHint">我是接收方</el-button>
          </div>
          <el-input
            v-model="manualPeerCode"
            type="textarea"
            :rows="3"
            class="top-gap"
            placeholder="我是接收方:先把对方生成的邀请码粘贴到此处,再点下方按钮"
          />
          <div class="btn-row top-gap">
            <el-button type="primary" :icon="Share" :loading="connectingUI" @click="startManualReceiver">粘贴邀请码,生成应答码</el-button>
          </div>
          <div class="status-row">
            <span class="status-text">{{ statusText }}{{ debugNote ? ' | ' + debugNote : '' }}</span>
            <el-button size="small" text :icon="Refresh" @click="resetManual">重置</el-button>
          </div>
        </template>

        <template v-else>
          <div class="panel-title top-gap">把{{ peerName === '对方' ? '码' : '' }}发给对方:</div>
          <div class="code-row">
            <img v-if="manualMyQr" :src="manualMyQr" class="code-qr" alt="配对码二维码" />
            <div class="code-main">
              <el-input type="textarea" :rows="3" :model-value="manualMyCode" readonly />
              <div class="code-actions top-gap">
                <el-button type="primary" :icon="CopyDocument" @click="copyText(manualMyCode)">复制</el-button>
              </div>
            </div>
          </div>
          <template v-if="manualIsSender">
            <el-input
              v-model="manualPeerCode"
              type="textarea"
              :rows="3"
              class="top-gap"
              :placeholder="manualCodePlaceholder"
            />
            <div class="btn-row top-gap">
              <el-button type="primary" :loading="connectingUI" @click="acceptManualAnswer">提交并建立连接</el-button>
              <el-button :icon="Refresh" @click="resetManual">重来</el-button>
            </div>
          </template>
          <div v-else class="top-gap status-text">
            把应答码回传给对方,连接将自动建立(对方提交后本端自动进入传输界面)…
          </div>
          <div class="status-row">
            <span class="status-text">{{ statusText }}{{ debugNote ? ' | ' + debugNote : '' }}</span>
          </div>
        </template>
      </div>
    </template>

    <!-- ────────────── 已连接:双面板 ────────────── -->
    <template v-if="connected">
      <div class="connected-bar">
        <span class="ok-dot" />
        <span class="tag-ok">已连接 {{ peerName }}</span>
        <span v-if="speedText" class="speed">{{ speedText }}</span>
        <el-button size="small" text :icon="Delete" @click="disconnect">断开</el-button>
      </div>

      <div class="transfer-grid">
        <!-- 发送面板 -->
        <div
          class="panel drop"
          :class="{ over: dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
          @click="pickFiles"
        >
          <div class="panel-head">
            <el-icon><Share /></el-icon>
            <span class="panel-title">发送</span>
          </div>
          <input ref="fileInputEl" type="file" multiple hidden @change="onFilesPicked" />
          <div class="drop-area">
            <el-icon :size="30"><UploadFilled /></el-icon>
            <div class="drop-main">点击选择或拖入文件</div>
            <div class="drop-sub">可多选,不限类型和大小</div>
          </div>
          <el-progress
            v-if="sendQueue.length && overallProgress < 100"
            class="top-gap"
            :percentage="overallProgress"
            :stroke-width="10"
          />
          <div v-if="sendQueue.length" class="queue">
            <div v-for="q in sendQueue" :key="q.id" class="row-item">
              <div class="q-meta">
                <span class="q-name" :title="q.name">{{ q.name }}</span>
                <span class="q-sub">{{ formatSize(q.size) }} · {{ q.done ? '已完成' : Math.round((q.sent / Math.max(1, q.size)) * 100) + '%' }}</span>
              </div>
              <el-progress
                :percentage="q.done ? 100 : Math.round((q.sent / Math.max(1, q.size)) * 100)"
                :stroke-width="6"
                :show-text="false"
                :status="q.done ? 'success' : undefined"
              />
            </div>
          </div>
        </div>

        <!-- 接收面板 -->
        <div class="panel">
          <div class="panel-head">
            <el-icon><Download /></el-icon>
            <span class="panel-title">接收</span>
          </div>
          <div v-if="!incomingFiles.length" class="drop-area quiet">
            <el-icon :size="30"><Download /></el-icon>
            <div class="drop-sub">{{ '对方发来的文件会出现在这里' }}</div>
          </div>
          <div v-else class="queue">
            <div v-for="f in incomingFiles" :key="f.id" class="row-item">
              <div class="q-meta">
                <span class="q-name" :title="f.name">{{ f.name }}</span>
                <span class="q-sub">{{ formatSize(f.size) }}</span>
              </div>
              <a v-if="f.url" :href="f.url" :download="f.name" @click.stop>
                <el-button size="small" type="success" :icon="Download">保存</el-button>
              </a>
              <el-progress
                v-else
                :percentage="Math.round((f.received / Math.max(1, f.size)) * 100)"
                :stroke-width="6"
                :show-text="false"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 文本互传 -->
      <div class="panel">
        <div class="panel-head">
          <el-icon><Promotion /></el-icon>
          <span class="panel-title">文本互传</span>
        </div>
        <div class="text-row">
          <el-input v-model="myText" placeholder="输入要发送的文本或链接" clearable @keydown.enter="sendText" />
          <el-button type="primary" :icon="Position" @click="sendText">发送</el-button>
        </div>
        <div v-if="receivedTexts.length" class="queue">
          <div v-for="(t, i) in receivedTexts" :key="i" class="text-item">
            <span class="t-body">{{ t }}</span>
            <el-button size="small" text :icon="CopyDocument" @click="copyText(t)">复制</el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 连接失败提示条 -->
    <div v-if="statusText && !connected && statusText.includes('拒绝')" class="error-bar">
      <el-icon><Close /></el-icon>
      <span>{{ statusText }}</span>
      <el-button size="small" text @click="statusText = ''">知道了</el-button>
    </div>
  </ToolPage>
</template>

<style scoped>
.mode-row {
  margin-bottom: 12px;
}
.panel {
  margin-top: 0;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  padding: 16px;
  margin-bottom: 14px;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
}
.head-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}
.qr-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 10px 14px;
  border: 1px dashed color-mix(in srgb, var(--el-color-primary) 40%, var(--card-border));
  border-radius: 10px;
  margin-bottom: 12px;
  background: color-mix(in srgb, var(--el-color-primary) 4%, var(--el-bg-color));
}
.qr-img {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  flex: none;
  background: #fff;
  padding: 4px;
}
.qr-main {
  flex: 1;
  min-width: 0;
}
.qr-title {
  font-size: 14px;
  font-weight: 600;
}
.qr-url {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qr-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.device.self {
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color));
  border-color: color-mix(in srgb, var(--el-color-primary) 25%, var(--card-border));
}
.d-meta {
  flex: 1;
  min-width: 0;
}
.d-name {
  font-size: 14px;
  font-weight: 600;
}
.d-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.d-online {
  font-size: 12px;
  color: #22c55e;
}
.d-online::before {
  content: '● ';
}
.empty-hint {
  padding: 10px 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pending {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.spin {
  animation: rotating 1.2s linear infinite;
}
@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.connected-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;
}
.ok-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  display: inline-block;
  flex: none;
}
.tag-ok {
  padding: 2px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, #22c55e 12%, transparent);
  color: #16a34a;
  font-size: 12px;
}
.speed {
  color: var(--el-color-primary);
  font-size: 12px;
}

.transfer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}
.panel.drop {
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.panel.drop.over {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
}
.drop-area {
  min-height: 220px;
  border: 1px dashed var(--el-color-primary);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--el-color-primary);
  padding: 20px;
}
.drop-area.quiet {
  border-style: dashed;
  color: var(--el-text-color-placeholder);
}
.drop-main {
  font-size: 14px;
  font-weight: 600;
}
.drop-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.queue {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.q-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.q-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.q-sub {
  flex: none;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.text-row {
  display: flex;
  gap: 8px;
}
.text-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 13px;
}
.t-body {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.code-qr {
  width: 240px;
  max-width: 60vw;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  flex: none;
  background: #fff;
  padding: 6px;
}
.code-main {
  flex: 1;
  min-width: 0;
}
.code-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.choose {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.btn-row {
  display: flex;
  gap: 10px;
}
.top-gap {
  margin-top: 12px;
}
.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.status-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.debug-note {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-danger-light-7, #fde2e2);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-color-danger);
}
</style>
