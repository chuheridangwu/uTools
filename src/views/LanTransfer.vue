<script setup lang="ts">
/**
 * 局域网文件直传
 * 参考找Tab「局域网文件共享」的做法:
 *  - 打开页面自动分配一个不重复的随机动物昵称,并加入在线设备大厅
 *  - 点「连接」向对方发起邀请 → 对方接受/拒绝(拒绝时发起端收到提示)
 *  - 接受后进入双面板:双方都可以发送(点击或拖入)与接收文件,另附文本互传
 *
 * 实现方式:在线名单与配对信令走公共 MQTT(WebSocket)通道;文件与文本本体走
 * WebRTC DataChannel 设备直连,不经过任何服务器中转。另有「6 位配对码」模式:
 * 双方在公共通道的同一个 6 位数字房间里握手,适合不想出现在大厅时使用。
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
  MagicStick,
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

/** 已接受、正在协商(区分「等待接受」与「建立直连」) */
const negotiating = ref(false)

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
let mqttClient: {
  publish: (topic: string, payload: string, opts?: { qos?: 0 | 1 | 2 }) => void
  subscribe: (topic: string | string[], opts?: { qos?: 0 | 1 | 2 }) => void
  unsubscribe?: (topic: string | string[], cb?: () => void) => void
  end: (force?: boolean) => void
} | null = null
let presenceTimer: number | null = null
let pruneTimer: number | null = null

/** 信令重发:公共 MQTT 是尽力投递,跨网络/重连时消息会丢,靠重发兜底 */
let inviteTimer: number | null = null
let acceptTimer: number | null = null
let offerTimer: number | null = null
let lastOffer: RTCSessionDescriptionInit | null = null
let lastAnswer: RTCSessionDescriptionInit | null = null
const pendingIce: RTCIceCandidateInit[] = []
/** 刚拒绝过的设备,短时间内不再弹窗(避免重发的邀请反复打扰) */
const rejectedAt = new Map<string, number>()

function stopTimer(timer: number | null): null {
  if (timer) window.clearInterval(timer)
  return null
}

function stopSignalTimers() {
  inviteTimer = stopTimer(inviteTimer)
  acceptTimer = stopTimer(acceptTimer)
  offerTimer = stopTimer(offerTimer)
}

/** 协商超时看门狗:卡在 ICE 时给出可操作提示 */
let negotiateTimer: number | null = null

function startNegotiateWatchdog() {
  stopNegotiateWatchdog()
  negotiateTimer = window.setTimeout(() => {
    negotiateTimer = null
    if (!connected.value) {
      if (mode.value === 'manual') resetPairing()
      else teardown()
      awaitingPeer.value = null
      incomingInvite.value = null
      statusText.value = mode.value === 'manual'
        ? '直连超时:当前网络可能无法穿透 NAT,建议同一 WiFi 或换一个网络重试'
        : '直连超时:当前网络可能无法穿透 NAT,建议同一 WiFi 或改用「配对码」'
      ElMessage.warning('直连超时,可能是跨网络 NAT 限制')
    }
  }, 20000)
}

function stopNegotiateWatchdog() {
  if (negotiateTimer) {
    window.clearTimeout(negotiateTimer)
    negotiateTimer = null
  }
}

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
      client.subscribe([LOBBY_TOPIC, sigTopicOf(myId)], { qos: 1 })
      // 断线重连后补订阅当前配对角色的房间
      if (roomJoinedCode.value) client.subscribe(roomTopicOf(roomJoinedCode.value), { qos: 1 })
      void announce(true)
    })
    client.on('message', (topic, payload) => {
      let msg: SignalMsg
      try { msg = JSON.parse(payload.toString()) as SignalMsg } catch { return }
      if (topic.startsWith(ROOM_PREFIX)) { void handleRoomSignal(msg); return }
      void handleSignal(msg)
    })
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
  // 信令用 QoS 1,至少送达一次;重复消息由各分支自行去重
  mqttClient?.publish(to ? sigTopicOf(to) : LOBBY_TOPIC, payload, { qos: 1 })
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

  // 正在用 6 位配对码时,忽略大厅里的邀请,避免弹窗打断
  if (msg.t === 'invite' && mode.value === 'manual') {
    sig(msg.from, { t: 'reject' })
    return
  }

  if (msg.t === 'invite') {
    const fromId = msg.from || msg.id || ''
    // 刚拒绝过的设备:直接回 reject,避免重发的邀请反复弹窗
    const rejectedTs = rejectedAt.get(fromId)
    if (rejectedTs && Date.now() - rejectedTs < 15000) {
      sig(fromId, { t: 'reject' })
      return
    }
    // 重发的邀请:同一台设备已在配对 / 已接受,重发 accept 即可,不能误判为新邀请并拒绝
    if (fromId && (incomingInvite.value?.id === fromId || (awaitingPeer.value?.id === fromId && !!pc.value))) {
      sig(fromId, { t: 'accept' })
      return
    }
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
      negotiating.value = true
      statusText.value = `正在与 ${inviterName} 建立直连…`
      sig(msg.from, { t: 'accept' })
      preparePeerConnection(false) // 接收方:等待 offer
      startNegotiateWatchdog()
      // 重复发送 accept,直到收到 offer / 连接建立,避免 accept 丢包导致双方互等
      acceptTimer = window.setInterval(() => {
        if (!incomingInvite.value || connected.value || pc.value?.currentRemoteDescription) {
          acceptTimer = stopTimer(acceptTimer)
          return
        }
        sig(inviterId, { t: 'accept' })
      }, 3000)
    } catch (action) {
      if (action === 'cancel') {
        rejectedAt.set(fromId, Date.now())
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
    // 对方接受了:发起端创建 offer(重复 accept 直接忽略,避免重建连接)
    inviteTimer = stopTimer(inviteTimer)
    if (pc.value) return
    const target = awaitingPeer.value.id
    peerName.value = awaitingPeer.value.name
    negotiating.value = true
    statusText.value = `正在与 ${peerName.value} 建立直连…`
    preparePeerConnection(true)
    const p = pc.value!
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    // 等候选收集完成再发,让 SDP 自带 candidate,不依赖单独的 ICE 信令是否送达
    await waitIceGather(p, 2500)
    lastOffer = p.localDescription
    sig(target, { t: 'offer', sdp: lastOffer })
    startNegotiateWatchdog()
    // offer 也重发:answer 丢失时还有机会恢复
    offerTimer = window.setInterval(() => {
      if (!lastOffer || connected.value) {
        offerTimer = stopTimer(offerTimer)
        return
      }
      sig(target, { t: 'offer', sdp: lastOffer })
    }, 4000)
    return
  }

  if (msg.t === 'reject' && awaitingPeer.value) {
    const name = awaitingPeer.value.name
    ElMessage.warning(`${name} 拒绝了连接`)
    statusText.value = `${name} 拒绝了连接`
    awaitingPeer.value = null
    stopSignalTimers()
    teardown()
    return
  }

  if (msg.t === 'offer') {
    const p = pc.value
    if (!p) return
    acceptTimer = stopTimer(acceptTimer)
    // 重发的 offer:已有 answer 就直接重发 answer,避免重复 setRemoteDescription 报错
    if (p.currentRemoteDescription && lastAnswer) {
      sig(msg.from, { t: 'answer', sdp: lastAnswer })
      return
    }
    await p.setRemoteDescription(msg.sdp!)
    await flushPendingIce(p)
    const answer = await p.createAnswer()
    await p.setLocalDescription(answer)
    // 同样等候选收集完成,answer 自带 candidate
    await waitIceGather(p, 2500)
    lastAnswer = p.localDescription
    sig(msg.from, { t: 'answer', sdp: lastAnswer })
    return
  }

  if (msg.t === 'answer') {
    const p = pc.value
    if (!p) return
    if (p.signalingState !== 'have-local-offer') return
    await p.setRemoteDescription(msg.sdp!)
    await flushPendingIce(p)
    offerTimer = stopTimer(offerTimer)
    return
  }

  if (msg.t === 'ice' && msg.candidate) {
    const p = pc.value
    // 远端描述还没设好时先缓存,设好后再补加,避免候选被丢掉导致连不上
    if (!p || !p.remoteDescription) {
      pendingIce.push(msg.candidate)
      return
    }
    try { await p.addIceCandidate(msg.candidate) } catch { /* 忽略乱序候选 */ }
  }
}

/** 补加缓存中的 ICE 候选 */
async function flushPendingIce(p: RTCPeerConnection) {
  while (pendingIce.length) {
    const candidate = pendingIce.shift()
    if (!candidate) continue
    try { await p.addIceCandidate(candidate) } catch { /* 过期候选 */ }
  }
}

/** 点击列表中的设备发起连接 */
function connectTo(peer: Peer) {
  if (connected.value || awaitingPeer.value) {
    ElMessage.warning('已有连接在进行中,请先断开')
    return
  }
  // 清掉上一次失败尝试残留的 PeerConnection / 定时器
  teardown()
  pendingIce.length = 0
  lastOffer = null
  lastAnswer = null
  awaitingPeer.value = peer
  statusText.value = `正在等待 ${peer.name} 接受…`
  sig(peer.id, { t: 'invite' })
  // 公共 MQTT 会丢消息:每 4 秒重发邀请,直到收到 accept / reject
  inviteTimer = window.setInterval(() => {
    if (!awaitingPeer.value || awaitingPeer.value.id !== peer.id || connected.value) {
      inviteTimer = stopTimer(inviteTimer)
      return
    }
    sig(peer.id, { t: 'invite' })
  }, 4000)
  // 30 秒未响应自动取消
  setTimeout(() => {
    if (awaitingPeer.value && !connected.value && !negotiating.value) {
      ElMessage.warning(`${peer.name} 未响应`)
      awaitingPeer.value = null
      stopSignalTimers()
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
  p.addEventListener('iceconnectionstatechange', () => {
    note()
    // 跨网络时若双方都在对称 NAT / 公司网络下,没有 TURN 中继就会 failed
    if (p.iceConnectionState === 'failed' && !connected.value) {
      // 立即结束协商,让提示可见并允许重新发起
      stopNegotiateWatchdog()
      negotiating.value = false
      awaitingPeer.value = null
      incomingInvite.value = null
      if (mode.value === 'manual') resetPairing()
      statusText.value = mode.value === 'manual'
        ? '直连失败:当前网络可能无法穿透 NAT,建议同一 WiFi 或换一个网络重试'
        : '直连失败:当前网络可能需要 TURN 中继,建议同一 WiFi 或改用「配对码」'
      ElMessage.warning('WebRTC 直连失败,当前网络可能无法穿透 NAT')
    }
  })
  p.addEventListener('connectionstatechange', note)
  p.onicecandidate = (e) => {
    if (!e.candidate) return
    if (mode.value === 'manual') {
      publishRoom({ t: 'ice', candidate: e.candidate })
      return
    }
    const target = awaitingPeer.value ?? incomingInvite.value
    if (target) sig(target.id, { t: 'ice', candidate: e.candidate })
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
    negotiating.value = false
    stopNegotiateWatchdog()
    stopSignalTimers()
    stopRoomTimer()
    incomingInvite.value = null
    awaitingPeer.value = null
    statusText.value = peerName.value ? `已连接 · ${peerName.value}` : '已连接 · 可开始传输'
  }
  ch.onclose = () => {
    if (!connected.value) return
    connected.value = false
    negotiating.value = false
    stopNegotiateWatchdog()
    stopSignalTimers()
    stopSpeedTimer()
    sending = false
    ackResolvers.clear()
    // 手动模式下回到初始选择界面,避免旧配对码干扰下一轮
    if (mode.value === 'manual') resetPairing()
    statusText.value = '对方已断开连接'
    ElMessage.warning('对方已断开连接')
  }
  ch.onmessage = (e) => handleData(e.data)
}

/* --------------------------- 断开 / 清理 --------------------------- */
function teardown() {
  stopSignalTimers()
  stopNegotiateWatchdog()
  negotiating.value = false
  pendingIce.length = 0
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
  leaveRoom()
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

/* --------------------------- 6 位配对码房间 --------------------------- */
/* 双方在公共 MQTT 的同一个 6 位数字房间里握手;文件仍然走 WebRTC 点对点。
 * 角色由 myId 字典序决定(ID 小的一方发 offer),避免双方同时 offer 的 glare。 */
const ROOM_PREFIX = 'utools/lanx/room/v1/'
const roomTopicOf = (code: string) => ROOM_PREFIX + code

const roomCode = ref('')
const roomJoinedCode = ref('')
const roomPeerId = ref('')
let roomTimer: number | null = null
let roomOfferer = false
let roomOffering = false
let roomAnswering = false
let lastRoomOffer: RTCSessionDescriptionInit | null = null
let lastRoomAnswer: RTCSessionDescriptionInit | null = null

function randomRoomCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

function onRoomCodeInput(v: string) {
  roomCode.value = v.replace(/\D/g, '').slice(0, 6)
}

function stopRoomTimer() {
  if (roomTimer) {
    window.clearInterval(roomTimer)
    roomTimer = null
  }
}

function publishRoom(msg: Record<string, unknown>) {
  if (!mqttClient || !roomJoinedCode.value) return
  mqttClient.publish(
    roomTopicOf(roomJoinedCode.value),
    JSON.stringify({ ...msg, from: myId, fromName: myName.value, platform }),
    { qos: 1 },
  )
}

/** 生成并加入一个新房间 */
function joinRandomRoom() {
  roomCode.value = randomRoomCode()
  void joinRoom(roomCode.value)
}

async function joinRoom(code?: string) {
  const target = (code ?? roomCode.value).trim()
  if (!/^\d{6}$/.test(target)) {
    ElMessage.warning('请输入 6 位数字配对码')
    return
  }
  if (!mqttClient || lobbyState.value !== 'ok') {
    ElMessage.warning('公共信令通道未连接,配对码暂时不可用,请检查网络后重试')
    return
  }
  resetPairing()
  myName.value = myName.value || uniquifyName(randomName())
  roomCode.value = target
  roomJoinedCode.value = target
  roomPeerId.value = ''
  roomOfferer = false
  lastRoomOffer = null
  lastRoomAnswer = null
  peerName.value = '对方'
  negotiating.value = true
  statusText.value = `已加入房间 ${target},等待对方输入同一号码…`
  try { mqttClient.subscribe(roomTopicOf(target), { qos: 1 }) } catch { /* noop */ }
  publishRoom({ t: 'join', id: myId, name: myName.value, platform })
  startNegotiateWatchdog()
  stopRoomTimer()
  // 公共 MQTT 会丢消息:重复宣告 + 重发 offer/answer,直到数据通道打开
  roomTimer = window.setInterval(() => {
    if (connected.value) {
      stopRoomTimer()
      return
    }
    publishRoom({ t: 'join', id: myId, name: myName.value, platform })
    if (roomOfferer && lastRoomOffer && !lastRoomAnswer) publishRoom({ t: 'offer', sdp: lastRoomOffer })
    if (!roomOfferer && lastRoomAnswer) publishRoom({ t: 'answer', sdp: lastRoomAnswer })
  }, 2500)
}

async function sendRoomOffer() {
  const p = pc.value
  if (!p) return
  if (p.currentLocalDescription) {
    if (lastRoomOffer && !lastRoomAnswer) publishRoom({ t: 'offer', sdp: lastRoomOffer })
    return
  }
  if (roomOffering) return
  roomOffering = true
  try {
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    await waitIceGather(p, 2500)
    lastRoomOffer = p.localDescription
    publishRoom({ t: 'offer', sdp: lastRoomOffer })
  } catch { /* 等下一轮重发 */ } finally {
    roomOffering = false
  }
}

async function handleRoomSignal(msg: SignalMsg) {
  if (msg.from === myId || !roomJoinedCode.value) return

  if (msg.t === 'join') {
    // 房间只容纳一对设备;已有对手时忽略后来者
    if (roomPeerId.value && roomPeerId.value !== msg.from) return
    if (!roomPeerId.value) {
      roomPeerId.value = msg.from
      if (msg.fromName) peerName.value = msg.fromName
    }
    if (myId < msg.from) {
      // 本端负责 offer
      if (!pc.value) {
        roomOfferer = true
        prepareRoomPeer(true)
        void sendRoomOffer()
      }
    } else if (!pc.value) {
      roomOfferer = false
      prepareRoomPeer(false)
    }
    if (!connected.value) statusText.value = `房间 ${roomJoinedCode.value} · 正在与 ${peerName.value} 建立直连…`
    return
  }

  if (msg.t === 'offer' && msg.sdp) {
    if (!pc.value) {
      roomOfferer = false
      prepareRoomPeer(false)
    }
    const p = pc.value
    if (!p) return
    // 重发的 offer:answer 已生成就直接回发,不再重复设置远端描述
    if (p.currentRemoteDescription && lastRoomAnswer) {
      publishRoom({ t: 'answer', sdp: lastRoomAnswer })
      return
    }
    if (roomAnswering) return
    roomAnswering = true
    try {
      await p.setRemoteDescription(msg.sdp)
      await flushPendingIce(p)
      const answer = await p.createAnswer()
      await p.setLocalDescription(answer)
      await waitIceGather(p, 2500)
      lastRoomAnswer = p.localDescription
      publishRoom({ t: 'answer', sdp: lastRoomAnswer })
      statusText.value = `房间 ${roomJoinedCode.value} · 正在与 ${peerName.value} 建立直连…`
    } catch { /* offer 不完整时等重发 */ } finally {
      roomAnswering = false
    }
    return
  }

  if (msg.t === 'answer' && msg.sdp) {
    const p = pc.value
    if (!p || p.currentRemoteDescription) return
    try {
      await p.setRemoteDescription(msg.sdp)
      await flushPendingIce(p)
    } catch { /* 等重发 */ }
    return
  }

  if (msg.t === 'ice' && msg.candidate) {
    const p = pc.value
    if (!p || !p.remoteDescription) {
      pendingIce.push(msg.candidate)
      return
    }
    try { await p.addIceCandidate(msg.candidate) } catch { /* 乱序候选 */ }
  }
}

function prepareRoomPeer(asOfferer: boolean) {
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

async function waitIceGather(p: RTCPeerConnection, timeout = 4000): Promise<void> {
  if (p.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    p.addEventListener('icegatheringstatechange', () => { if (p.iceGatheringState === 'complete') done() })
    setTimeout(done, timeout)
  })
}

/** 离开房间(不关闭已有的 PeerConnection) */
function leaveRoom() {
  stopRoomTimer()
  roomOffering = false
  roomAnswering = false
  if (roomJoinedCode.value && mqttClient) {
    try { mqttClient.unsubscribe?.(roomTopicOf(roomJoinedCode.value)) } catch { /* noop */ }
  }
  roomJoinedCode.value = ''
  roomPeerId.value = ''
  roomOfferer = false
  lastRoomOffer = null
  lastRoomAnswer = null
}

function resetPairing() {
  leaveRoom()
  pendingIce.length = 0
  if (pc.value || channel.value) disconnect()
  else {
    negotiating.value = false
    statusText.value = '未连接'
  }
}

function switchMode(m: Mode) {
  resetPairing()
  disconnect()
  mode.value = m
  if (m === 'lobby' && !lobbyJoined && lobbyState.value !== 'connecting') void joinLobby()
}

/** 本页网址二维码 */
async function renderQr(text: string, opts?: { width?: number; ec?: 'L' | 'M' }): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: opts?.width ?? 400,
      margin: 2,
      errorCorrectionLevel: opts?.ec ?? 'M',
    })
  } catch {
    return ''
  }
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
      两台设备打开本页即可互传文件(手机 ↔ 电脑),文件与文本通过 WebRTC 直连,不经服务器中转。
      在线名单来自公共 MQTT 大厅(全球可见);跨网络能否直连取决于双方 NAT,没有 TURN 中继时部分网络会失败,同一 WiFi 最稳。
    </template>

    <!-- 手动模式切换入口 -->
    <div class="mode-row">
      <el-radio-group v-model="mode" size="small" @update:model-value="(m: unknown) => switchMode(m as Mode)">
        <el-radio-button value="lobby">在线设备(推荐)</el-radio-button>
        <el-radio-button value="manual">6 位配对码</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ────────────── 在线设备大厅 ────────────── -->
    <template v-if="mode === 'lobby'">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">附近设备</span>
          <span class="head-hint">
            <template v-if="lobbyState === 'connecting'">正在连接设备大厅…</template>
            <template v-else-if="lobbyState === 'error'">公共大厅不可达;6 位配对码也依赖同一信令通道,请检查网络</template>
            <template v-else>当前在线设备 {{ peers.length + 1 }} 台(等一会儿别人的名字就会出现)</template>
          </span>
        </div>

        <div class="net-note">
          <b>关于「局域网」:</b>在线名单走公共 MQTT 通道(全球可见),不是真正的局域网发现;文件走 WebRTC 点对点。
          跨网络时若双方处于对称 NAT / 公司网络,没有 TURN 中继可能连不上,同一 WiFi 最稳定。
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

      <!-- 发起端:等待对方接受 -->
      <div v-if="awaitingPeer && !connected && !negotiating" class="panel pending">
        <el-icon class="spin"><Refresh /></el-icon>
        <span>正在等待 {{ awaitingPeer.name }} 接受…</span>
        <el-button size="small" text @click="() => { awaitingPeer = null; disconnect() }">取消</el-button>
      </div>

      <!-- 对方已接受:正在建立直连(双方都会显示) -->
      <div v-if="!connected && negotiating" class="panel pending">
        <el-icon class="spin"><Refresh /></el-icon>
        <span>{{ statusText || '正在建立直连…' }}{{ debugNote ? ` (${debugNote})` : '' }}</span>
        <span class="hint">若长时间停留在此状态,说明当前网络无法穿透 NAT,可改用「6 位配对码」或换到同一 WiFi</span>
      </div>
    </template>

    <!-- ────────────── 6 位配对码(双方输入同一号码) ────────────── -->
    <template v-if="mode === 'manual' && !connected">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">6 位配对码</span>
          <span class="head-hint">双方输入同一个数字即可配对,不用加好友</span>
        </div>

        <div class="room-row">
          <el-input
            :model-value="roomCode"
            class="room-code-input"
            maxlength="6"
            inputmode="numeric"
            placeholder="000000"
            @input="onRoomCodeInput"
            @keyup.enter="joinRoom()"
          />
          <el-button type="primary" :icon="MagicStick" @click="joinRandomRoom">随机生成并加入</el-button>
          <el-button :icon="Position" @click="joinRoom()">加入房间</el-button>
        </div>

        <div class="hint top-gap">
          发起方点「随机生成并加入」,把 6 位数字告诉对方;对方输入同一个数字点「加入房间」,连接自动建立。
          号码相当于房间名,请确认对方身份后再传文件;配对依赖公共信令通道,完全断网时不可用。
        </div>

        <div v-if="roomJoinedCode && !connected" class="panel pending top-gap">
          <el-icon class="spin"><Refresh /></el-icon>
          <span>{{ statusText }}{{ debugNote ? ` (${debugNote})` : '' }}</span>
          <el-button size="small" text :icon="CopyDocument" @click="copyText(roomJoinedCode)">复制号码</el-button>
          <el-button size="small" text @click="resetPairing">取消</el-button>
        </div>

        <div v-else class="status-row">
          <span class="status-text">{{ statusText }}{{ debugNote ? ' | ' + debugNote : '' }}</span>
          <el-button size="small" text :icon="Refresh" @click="resetPairing">重置</el-button>
        </div>
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

    <!-- 连接失败 / 超时提示条(仅大厅模式:手动模式的状态文案在面板内展示) -->
    <div v-if="mode === 'lobby' && statusText && !connected && !negotiating && !awaitingPeer" class="error-bar">
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
.net-note {
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-color-warning);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.net-note b { color: var(--el-text-color-primary); }
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

.room-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.room-code-input {
  width: 170px;
}
.room-code-input :deep(input) {
  font-size: 22px;
  letter-spacing: 8px;
  text-align: center;
  font-variant-numeric: tabular-nums;
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
