<script setup lang="ts">
/**
 * 世界时钟
 * 基于 Intl.DateTimeFormat 的 IANA 时区显示多城市当前时间,
 * 可增删城市,展示与本地时差、昼夜状态,数据存本机。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Delete, Moon, Plus, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface City {
  zone: string
  name: string
}

/** 常用城市时区表 */
const PRESETS: City[] = [
  { zone: 'Asia/Shanghai', name: '北京' },
  { zone: 'Asia/Hong_Kong', name: '香港' },
  { zone: 'Asia/Tokyo', name: '东京' },
  { zone: 'Asia/Seoul', name: '首尔' },
  { zone: 'Asia/Singapore', name: '新加坡' },
  { zone: 'Asia/Bangkok', name: '曼谷' },
  { zone: 'Asia/Kolkata', name: '孟买' },
  { zone: 'Asia/Dubai', name: '迪拜' },
  { zone: 'Europe/Moscow', name: '莫斯科' },
  { zone: 'Europe/Berlin', name: '柏林' },
  { zone: 'Europe/Paris', name: '巴黎' },
  { zone: 'Europe/London', name: '伦敦' },
  { zone: 'America/New_York', name: '纽约' },
  { zone: 'America/Chicago', name: '芝加哥' },
  { zone: 'America/Los_Angeles', name: '洛杉矶' },
  { zone: 'America/Sao_Paulo', name: '圣保罗' },
  { zone: 'Australia/Sydney', name: '悉尼' },
  { zone: 'Pacific/Auckland', name: '奥克兰' },
  { zone: 'Africa/Cairo', name: '开罗' },
  { zone: 'UTC', name: 'UTC' },
]

const KEY = 'utools_worldclock'
const DEFAULT = ['Asia/Shanghai', 'Europe/London', 'America/New_York', 'Asia/Tokyo']

const zones = reactive<{ list: string[] }>({ list: [...DEFAULT] })
const now = ref(new Date())
const addZone = ref('')

let timer: number | null = null

function nameOf(zone: string): string {
  return PRESETS.find((p) => p.zone === zone)?.name || zone.split('/').pop()!.replace(/_/g, ' ')
}

function timeIn(zone: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now.value)
  } catch {
    return '--:--:--'
  }
}

function dateIn(zone: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, month: 'numeric', day: 'numeric', weekday: 'short' }).format(now.value)
  } catch {
    return ''
  }
}

/** 与本地时差(小时,带正负) */
function offsetIn(zone: string): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    const part = dtf.formatToParts(now.value).find((p) => p.type === 'timeZoneName')?.value || ''
    const m = /GMT([+-]\d+)?(?::(\d+))?/.exec(part)
    const h = m && m[1] ? Number(m[1]) : 0
    const localOffset = -now.value.getTimezoneOffset() / 60
    const diff = h - localOffset
    if (diff === 0) return '与本地相同'
    return `本地 ${diff > 0 ? '+' : ''}${diff} 小时`
  } catch {
    return ''
  }
}

function isNight(zone: string): boolean {
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hour12: false }).format(now.value))
    return h < 6 || h >= 19
  } catch {
    return false
  }
}

function add() {
  const z = addZone.value
  if (!z) return
  if (zones.list.includes(z)) {
    ElMessage.info('该城市已在列表中')
    return
  }
  zones.list.push(z)
  persist()
  addZone.value = ''
}

function remove(z: string) {
  zones.list = zones.list.filter((x) => x !== z)
  persist()
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(zones.list))
}

const localTime = computed(() => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = now.value
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const localDate = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now.value),
)

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (Array.isArray(saved) && saved.length) zones.list = saved
  } catch {
    /* keep default */
  }
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="wc">
    <div class="head">
      <div>
        <h3 class="title">世界时钟</h3>
        <p class="sub">本地时间 {{ localTime }} · {{ localDate }}</p>
      </div>
      <div class="add-row">
        <el-select v-model="addZone" filterable placeholder="添加城市" size="small" style="width: 170px">
          <el-option v-for="p in PRESETS" :key="p.zone" :value="p.zone" :label="`${p.name} (${p.zone})`" />
        </el-select>
        <el-button size="small" :icon="Plus" @click="add">添加</el-button>
      </div>
    </div>

    <div class="grid">
      <div v-for="z in zones.list" :key="z" class="clock" :class="{ night: isNight(z) }">
        <div class="c-top">
          <el-icon :size="16"><component :is="isNight(z) ? Moon : Sunny" /></el-icon>
          <span class="c-name">{{ nameOf(z) }}</span>
          <el-button class="c-del" text size="small" :icon="Delete" @click="remove(z)" />
        </div>
        <div class="c-time">{{ timeIn(z) }}</div>
        <div class="c-date">{{ dateIn(z) }}</div>
        <div class="c-off">{{ offsetIn(z) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wc {
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
.add-row {
  display: flex;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.clock {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px 16px;
  background: linear-gradient(160deg, #eff6ff, var(--el-bg-color));
}
.clock.night {
  background: linear-gradient(160deg, #1e293b, #0f172a);
  color: #e2e8f0;
  border-color: #334155;
}
.c-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.c-name {
  font-size: 13px;
  font-weight: 600;
}
.c-del {
  margin-left: auto;
  opacity: 0.5;
}
.c-time {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
}
.c-date {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.75;
}
.c-off {
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.6;
}
</style>
