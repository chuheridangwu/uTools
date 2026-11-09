<script setup lang="ts">
/**
 * IP 归属地查询
 * 查询本机公网 IP 与归属地,也可输入任意 IP / 域名查询;
 * 数据来自公开接口 ipwho.is(支持 HTTPS 与跨域),结果仅供参考。
 */
import { onMounted, reactive, ref } from 'vue'
import { Search, Position } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface IpInfo {
  ip?: string
  success?: boolean
  message?: string
  type?: string
  continent?: string
  country?: string
  country_code?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  connection?: { asn?: number; org?: string; isp?: string; domain?: string }
  timezone?: { id?: string; utc?: string }
}

const ip = ref('')
const loading = ref(false)
const info = reactive<IpInfo>({})
const queried = ref(false)

async function query(target?: string) {
  loading.value = true
  queried.value = true
  try {
    const url = target && target.trim() ? `https://ipwho.is/${encodeURIComponent(target.trim())}` : 'https://ipwho.is/'
    const res = await fetch(url)
    const data: IpInfo = await res.json()
    Object.keys(info).forEach((k) => delete (info as Record<string, unknown>)[k])
    Object.assign(info, data)
    if (data.success === false) ElMessage.warning(data.message || '查询失败')
  } catch {
    ElMessage.error('查询失败,请检查网络或稍后重试')
  } finally {
    loading.value = false
  }
}

function flag(code?: string): string {
  if (!code) return ''
  const cc = code.toUpperCase()
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

onMounted(() => query())
</script>

<template>
  <div class="ip">
    <div class="head">
      <div>
        <h3 class="title">IP 归属地查询</h3>
        <p class="sub">查询本机公网 IP 与归属地,也可输入 IP 或域名</p>
      </div>
    </div>

    <div class="search">
      <el-input v-model="ip" placeholder="输入 IP 或域名,留空查询本机" clearable @keydown.enter="query(ip)">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" :loading="loading" @click="query(ip)">查询</el-button>
      <el-button :icon="Position" :loading="loading" @click="ip = ''; query()">本机</el-button>
    </div>

    <div v-if="loading" class="loading">查询中…</div>

    <div v-else-if="queried && info.success === false" class="fail">
      {{ info.message || '没有查询到结果' }}
    </div>

    <div v-else-if="info.ip" class="result">
      <div class="ip-big">
        <span class="flag">{{ flag(info.country_code) }}</span>
        <span class="ip-text">{{ info.ip }}</span>
        <span v-if="info.type" class="ip-type">{{ info.type === 'IPv4' ? 'IPv4' : 'IPv6' }}</span>
      </div>

      <div class="cards">
        <div class="card"><div class="c-l">国家 / 地区</div><div class="c-v">{{ info.country || '—' }}</div></div>
        <div class="card"><div class="c-l">省 / 州</div><div class="c-v">{{ info.region || '—' }}</div></div>
        <div class="card"><div class="c-l">城市</div><div class="c-v">{{ info.city || '—' }}</div></div>
        <div class="card"><div class="c-l">运营商 / ISP</div><div class="c-v">{{ info.connection?.isp || '—' }}</div></div>
        <div class="card"><div class="c-l">组织</div><div class="c-v">{{ info.connection?.org || '—' }}</div></div>
        <div class="card"><div class="c-l">ASN</div><div class="c-v">{{ info.connection?.asn ? 'AS' + info.connection.asn : '—' }}</div></div>
        <div class="card"><div class="c-l">经纬度</div><div class="c-v">{{ info.latitude !== undefined ? `${info.latitude}, ${info.longitude}` : '—' }}</div></div>
        <div class="card"><div class="c-l">时区</div><div class="c-v">{{ info.timezone?.id || '—' }}</div></div>
      </div>
    </div>

    <div v-else class="empty">输入 IP 或点击「本机」开始查询</div>

    <p class="foot">数据来源 ipwho.is。IP 定位为大致范围,可能因运营商与 NAT 存在偏差。</p>
  </div>
</template>

<style scoped>
.ip {
  padding: 4px 2px;
}
.head {
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
.search {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}
.search :deep(.el-input) {
  flex: 1;
}
.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.fail {
  text-align: center;
  padding: 40px 0;
  color: #ef4444;
  font-size: 13px;
}
.ip-big {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--el-fill-color-light);
  margin-bottom: 16px;
}
.flag {
  font-size: 26px;
}
.ip-text {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, Menlo, monospace;
}
.ip-type {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 1px 8px;
  margin-left: 4px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
}
.c-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.c-v {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 600;
  word-break: break-all;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
