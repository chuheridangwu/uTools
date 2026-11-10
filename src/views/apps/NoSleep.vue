<script setup lang="ts">
/**
 * 防休眠
 * 用 Screen Wake Lock API 持有屏幕唤醒锁,防止系统自动息屏;
 * 不支持时回退为「静音循环播放」方案(部分系统仍可能忽略)。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Moon, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const supported = 'wakeLock' in navigator
const holding = ref(false)
const fallbackOn = ref(false)
const secs = ref(0)
let timer = 0
let wakeLock: { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void } | null = null
let audioCtx: AudioContext | null = null
let oscStop = false

const st = reactive({
  releases: 0, // 手动释放后的自动续持次数
})

const elapsed = computed(() => {
  const s = secs.value
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + ss
})

async function acquire() {
  if (!supported) {
    startFallback()
    return
  }
  try {
    const wl = await navigator.wakeLock.request('screen')
    wakeLock = wl as typeof wakeLock
    wl.addEventListener('release', () => {
      wakeLock = null
    })
    holding.value = true
  } catch (e) {
    ElMessage.error('获取唤醒锁失败:' + (e instanceof Error ? e.message : String(e)) + ',可改用下方的音频回退方案')
  }
}

async function releaseAll(notice = false) {
  if (wakeLock) {
    try { await wakeLock.release() } catch { /* ignore */ }
    wakeLock = null
  }
  stopFallback()
  holding.value = false
  secs.value = 0
  st.releases = 0
  if (notice) ElMessage.info('已解除屏幕保持')
}

async function toggle() {
  if (holding.value || fallbackOn.value) await releaseAll(true)
  else await acquire()
}

/* ----------------------- 回退方案:静音振荡持续播放 ----------------------- */
function startFallback() {
  if (!('AudioContext' in window)) {
    ElMessage.error('当前浏览器不支持 Screen Wake Lock,也无法使用音频回退')
    return
  }
  try {
    audioCtx = new AudioContext()
    oscStop = false
    toneLoop()
    fallbackOn.value = true
    holding.value = true
    ElMessage.warning('已回退为静音音频方案,部分系统可能仍会息屏')
  } catch (e) {
    ElMessage.error('启动失败:' + (e instanceof Error ? e.message : String(e)))
  }
}

async function toneLoop() {
  // 每 30 秒重播一段近乎无声的波(gain≈0,人耳不可闻),让系统认为有音频活跃
  while (!oscStop) {
    const ctx = audioCtx
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    osc.frequency.value = 200
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    await new Promise<void>((r) => window.setTimeout(r, 30000))
    try { osc.stop() } catch { /* ignore */ }
    if (oscStop) return
  }
}

function stopFallback() {
  oscStop = true
  try { void audioCtx?.close() } catch { /* ignore */ }
  audioCtx = null
  fallbackOn.value = false
}

/* 离开页面自动释放,回来时手动重新开启 */
async function onVisibility() {
  if (document.visibilityState !== 'visible') return
  if (st.releases >= 0 && holding.value && !wakeLock && supported) {
    // 系统切走时唤醒锁常被自动释放;回来后白名单内恢复
    await reacquire()
  }
}

async function reacquire() {
  try {
    const wl = await navigator.wakeLock.request('screen')
    wakeLock = wl as typeof wakeLock
    wl.addEventListener('release', () => { wakeLock = null })
    st.releases++
  } catch { /* ignore */ }
}

const onTick = () => { if (holding.value) secs.value++ }

onMounted(() => {
  timer = window.setInterval(onTick, 1000)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
  const wl = wakeLock
  wakeLock = null
  try { void wl?.release() } catch { /* ignore */ }
  stopFallback()
})
</script>

<template>
  <div class="ns">
    <div class="head">
      <div>
        <h3 class="title">防休眠</h3>
        <p class="sub">保持屏幕常亮,阅读 / 展示 / 下载不中断</p>
      </div>
      <el-tag :type="holding ? 'success' : 'info'" size="small">
        {{ fallbackOn ? '音频回退中' : holding ? '屏幕保持中' : '未开启' }}
      </el-tag>
    </div>

    <div class="stage">
      <button class="big-btn" :class="{ on: holding }" @click="toggle">
        <el-icon :size="42">
          <Sunny v-if="!holding" />
          <Moon v-else />
        </el-icon>
        <span class="big-label">{{ holding ? '点击解除保持' : '点击开启屏幕保持' }}</span>
      </button>
      <div class="meter">
        <span class="m-text">已保持 {{ elapsed }}</span>
        <span v-if="supported && st.releases" class="m-sub">页面往返自动续持 {{ st.releases }} 次</span>
      </div>
      <el-button v-if="!holding" size="small" type="warning" plain @click="startFallback">改用音频回退方案</el-button>
    </div>

    <div class="info">
      <p v-if="supported">当前环境支持 <b>Screen Wake Lock</b>:开启后屏幕不会自动熄灭;切走标签页时锁会被系统释放,回到页面会自动重新获取。</p>
      <p v-else>当前环境<b>不支持</b> Screen Wake Lock,点击开启会回退为「静音音频活跃」方案(对部分系统有效,锁屏策略仍由系统决定)。</p>
    </div>

    <p class="foot">提醒:离开当前页面会失去效果;请插电使用,注意夜间用眼。接口为浏览器原生,不依赖第三方服务。</p>
  </div>
</template>

<style scoped>
.ns {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
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
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 26px 0 6px;
}
.big-btn {
  width: 190px;
  height: 190px;
  border-radius: 50%;
  border: 2px solid var(--card-border);
  background: var(--el-fill-color-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--el-text-color-secondary);
}
.big-btn.on {
  border-color: #f59e0b;
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: #f59e0b;
  box-shadow: 0 8px 30px rgb(245 158 11 / 25%);
}
.big-btn:active {
  transform: scale(0.97);
}
.big-label {
  font-size: 13px;
  font-weight: 600;
}
.meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.m-text {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}
.m-sub {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.info {
  margin-top: 18px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
