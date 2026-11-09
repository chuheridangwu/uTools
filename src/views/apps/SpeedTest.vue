<script setup lang="ts">
/**
 * 网络测速
 * 基于 Cloudflare 公共测速端点(支持 CORS):
 *  - 延迟:多次小请求取 RTT 与抖动
 *  - 下载:拉取递增大小的二进制数据统计吞吐
 *  - 上传:POST 随机数据统计写入吞吐
 * 结果以 Mbps 展示,并给出简单评级。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { Download, Odometer, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const DOWN = 'https://speed.cloudflare.com/__down?bytes='
const UP = 'https://speed.cloudflare.com/__up'

const running = ref(false)
const phase = ref<'idle' | 'ping' | 'down' | 'up' | 'done'>('idle')
const result = reactive({
  latency: 0,
  jitter: 0,
  down: 0, // Mbps
  up: 0,
  downPeak: 0,
  upPeak: 0,
})
const samples = reactive<{ down: number[]; up: number[]; ping: number[] }>({ down: [], up: [], ping: [] })

const progress = computed(() => {
  if (phase.value === 'idle') return 0
  if (phase.value === 'ping') return 10
  if (phase.value === 'down') return 45
  if (phase.value === 'up') return 80
  return 100
})

const grade = computed(() => {
  const d = result.down
  if (!d) return '—'
  if (d >= 200) return '极速'
  if (d >= 80) return '优秀'
  if (d >= 30) return '良好'
  if (d >= 10) return '一般'
  return '较慢'
})

function fmt(v: number, digits = 2): string {
  return v ? v.toFixed(digits) : '0.00'
}

async function ping(count = 6): Promise<void> {
  samples.ping.length = 0
  for (let i = 0; i < count; i++) {
    const t0 = performance.now()
    try {
      await fetch(DOWN + '0', { cache: 'no-store' })
      const rtt = performance.now() - t0
      samples.ping.push(rtt)
      result.latency = Math.min(...samples.ping)
    } catch {
      /* ignore */
    }
  }
  if (samples.ping.length > 1) {
    const avg = samples.ping.reduce((a, b) => a + b, 0) / samples.ping.length
    const variance = samples.ping.reduce((a, b) => a + (b - avg) ** 2, 0) / samples.ping.length
    result.jitter = Math.sqrt(variance)
  }
}

async function download(): Promise<void> {
  samples.down.length = 0
  // 第一轮 5MB 热身,随后 25MB 正式测
  const sizes = [5_000_000, 25_000_000]
  for (const size of sizes) {
    const t0 = performance.now()
    try {
      const res = await fetch(DOWN + size, { cache: 'no-store' })
      const reader = res.body?.getReader()
      let received = 0
      let peak = 0
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          received += value?.length || 0
          const secs = (performance.now() - t0) / 1000
          if (secs > 0.3) {
            const mbps = (received * 8) / secs / 1e6
            peak = Math.max(peak, mbps)
            result.downPeak = Math.max(result.downPeak, mbps)
          }
        }
      } else {
        received = (await res.arrayBuffer()).byteLength
      }
      const secs = (performance.now() - t0) / 1000
      if (secs > 0) samples.down.push((received * 8) / secs / 1e6)
      void peak
    } catch {
      ElMessage.warning('下载测速中断,可能是网络或跨域限制')
      break
    }
  }
  if (samples.down.length) result.down = Math.max(...samples.down)
}

async function upload(): Promise<void> {
  samples.up.length = 0
  const size = 10_000_000
  const blob = new Blob([new Uint8Array(size)])
  const t0 = performance.now()
  try {
    await fetch(UP, { method: 'POST', body: blob, cache: 'no-store' })
    const secs = (performance.now() - t0) / 1000
    if (secs > 0) {
      const mbps = (size * 8) / secs / 1e6
      samples.up.push(mbps)
      result.up = mbps
      result.upPeak = mbps
    }
  } catch {
    ElMessage.warning('上传测速失败,可能是网络或跨域限制')
  }
}

async function start() {
  if (running.value) return
  running.value = true
  Object.assign(result, { latency: 0, jitter: 0, down: 0, up: 0, downPeak: 0, upPeak: 0 })

  phase.value = 'ping'
  await ping()
  phase.value = 'down'
  await download()
  phase.value = 'up'
  await upload()
  phase.value = 'done'
  running.value = false
  ElMessage.success('测速完成')
}

/* 实时速率条(取最近样本最大值做归一) */
const downRatio = computed(() => Math.min(100, (result.downPeak / 200) * 100))
const upRatio = computed(() => Math.min(100, (result.upPeak / 100) * 100))

onBeforeUnmount(() => {
  running.value = false
})
</script>

<template>
  <div class="st">
    <div class="head">
      <div>
        <h3 class="title">网络测速</h3>
        <p class="sub">通过 Cloudflare 公共端点测延迟 / 下载 / 上传,结果仅供参考</p>
      </div>
      <el-button type="primary" :icon="Odometer" :loading="running" @click="start">
        {{ running ? '测速中…' : '开始测速' }}
      </el-button>
    </div>

    <el-progress :percentage="progress" :show-text="false" :stroke-width="6" class="bar" />

    <div class="cards">
      <div class="metric">
        <div class="m-label">延迟</div>
        <div class="m-value">{{ result.latency ? fmt(result.latency, 0) : '—' }}<span class="unit">ms</span></div>
        <div class="m-sub">抖动 {{ fmt(result.jitter, 1) }} ms</div>
      </div>
      <div class="metric">
        <div class="m-label"><el-icon><Download /></el-icon> 下载</div>
        <div class="m-value">{{ result.down ? fmt(result.down) : '—' }}<span class="unit">Mbps</span></div>
        <div class="m-sub">峰值 {{ fmt(result.downPeak) }} Mbps</div>
      </div>
      <div class="metric">
        <div class="m-label"><el-icon><Upload /></el-icon> 上传</div>
        <div class="m-value">{{ result.up ? fmt(result.up) : '—' }}<span class="unit">Mbps</span></div>
        <div class="m-sub">峰值 {{ fmt(result.upPeak) }} Mbps</div>
      </div>
      <div class="metric">
        <div class="m-label">评级</div>
        <div class="m-value grade">{{ phase === 'done' ? grade : '—' }}</div>
        <div class="m-sub">按下载带宽评估</div>
      </div>
    </div>

    <div class="gauges">
      <div class="gauge">
        <div class="g-head">下载实时速率</div>
        <div class="g-track"><div class="g-fill down" :style="{ width: downRatio + '%' }" /></div>
      </div>
      <div class="gauge">
        <div class="g-head">上传实时速率</div>
        <div class="g-track"><div class="g-fill up" :style="{ width: upRatio + '%' }" /></div>
      </div>
    </div>

    <p class="foot">提示:测速会消耗约 40MB 流量;若公司网络限制外部请求,可能只有延迟可用。</p>
  </div>
</template>

<style scoped>
.st {
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
.bar {
  margin-bottom: 18px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.metric {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 16px;
}
.m-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.m-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.m-value.grade {
  color: #14b8a6;
}
.unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}
.m-sub {
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.gauges {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.g-head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.g-track {
  height: 10px;
  border-radius: 6px;
  background: var(--el-fill-color);
  overflow: hidden;
}
.g-fill {
  height: 100%;
  width: 0;
  transition: width 0.3s;
}
.g-fill.down {
  background: linear-gradient(90deg, #22d3ee, #3b82f6);
}
.g-fill.up {
  background: linear-gradient(90deg, #34d399, #10b981);
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
