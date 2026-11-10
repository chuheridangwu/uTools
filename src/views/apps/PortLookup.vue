<script setup lang="ts">
/**
 * 端口速查
 * 常用服务端口一览(Web / 数据库 / 缓存 / 邮件 / 文件 / 监控 / 开发工具),
 * 支持搜索与分类筛选,可复制端口号,并给出公网暴露风险提示。
 */
import { computed, ref } from 'vue'
import { DocumentCopy, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface PortItem {
  port: number
  proto: string
  service: string
  desc: string
  cat: string
  risk?: string
}

const CATS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'web', label: 'Web' },
  { key: 'db', label: '数据库' },
  { key: 'cache', label: '缓存 / 队列' },
  { key: 'mail', label: '邮件' },
  { key: 'file', label: '文件 / 远控' },
  { key: 'monitor', label: '监控 / 容器' },
  { key: 'dev', label: '开发 / 代理' },
]

const PORTS: PortItem[] = [
  { port: 80, proto: 'TCP', service: 'HTTP', desc: '明文网页服务', cat: 'web', risk: '明文传输,生产环境建议跳转 443' },
  { port: 443, proto: 'TCP', service: 'HTTPS', desc: '加密网页服务', cat: 'web' },
  { port: 8080, proto: 'TCP', service: 'HTTP Alt', desc: '常见备用 Web / 反向代理端口', cat: 'web' },
  { port: 8443, proto: 'TCP', service: 'HTTPS Alt', desc: 'Tomcat / 管理后台常用加密端口', cat: 'web' },
  { port: 3000, proto: 'TCP', service: 'Dev Server', desc: 'Node / React / 前端开发服务', cat: 'web' },
  { port: 5173, proto: 'TCP', service: 'Vite', desc: 'Vite 默认开发服务器端口', cat: 'web' },
  { port: 8000, proto: 'TCP', service: 'HTTP Alt', desc: 'Python http.server / Django 常用', cat: 'web' },
  { port: 8888, proto: 'TCP', service: 'Jupyter / 后台', desc: 'Jupyter Notebook 与部分后台面板', cat: 'web', risk: '若未设密码即可访问,勿公网暴露' },

  { port: 3306, proto: 'TCP', service: 'MySQL', desc: 'MySQL / MariaDB 数据库', cat: 'db', risk: '禁止对公网开放,使用内网与白名单' },
  { port: 5432, proto: 'TCP', service: 'PostgreSQL', desc: 'PostgreSQL 数据库', cat: 'db', risk: '禁止对公网开放' },
  { port: 1433, proto: 'TCP', service: 'SQL Server', desc: 'Microsoft SQL Server', cat: 'db', risk: '禁止对公网开放' },
  { port: 1521, proto: 'TCP', service: 'Oracle', desc: 'Oracle 数据库监听端口', cat: 'db', risk: '禁止对公网开放' },
  { port: 27017, proto: 'TCP', service: 'MongoDB', desc: 'MongoDB 数据库', cat: 'db', risk: '默认无认证,务必加固' },
  { port: 9200, proto: 'TCP', service: 'Elasticsearch', desc: 'ES HTTP 接口', cat: 'db', risk: '未启用安全模块时可被删除索引' },

  { port: 6379, proto: 'TCP', service: 'Redis', desc: 'Redis 缓存', cat: 'cache', risk: '默认无密码,公网暴露易被入侵' },
  { port: 11211, proto: 'TCP/UDP', service: 'Memcached', desc: 'Memcached 缓存', cat: 'cache', risk: '含 UDP 放大攻击风险' },
  { port: 5672, proto: 'TCP', service: 'RabbitMQ', desc: 'AMQP 消息队列', cat: 'cache' },
  { port: 15672, proto: 'TCP', service: 'RabbitMQ Mgmt', desc: 'RabbitMQ 管理界面', cat: 'cache', risk: '默认口令 guest/guest 仅限本机' },
  { port: 9092, proto: 'TCP', service: 'Kafka', desc: 'Kafka Broker', cat: 'cache' },

  { port: 25, proto: 'TCP', service: 'SMTP', desc: '邮件发送(明文)', cat: 'mail' },
  { port: 465, proto: 'TCP', service: 'SMTPS', desc: 'SMTP over SSL', cat: 'mail' },
  { port: 587, proto: 'TCP', service: 'SMTP Submission', desc: '带 STARTTLS 的提交端口', cat: 'mail' },
  { port: 110, proto: 'TCP', service: 'POP3', desc: '邮件收件协议', cat: 'mail' },
  { port: 995, proto: 'TCP', service: 'POP3S', desc: 'POP3 over SSL', cat: 'mail' },
  { port: 143, proto: 'TCP', service: 'IMAP', desc: '邮件同步协议', cat: 'mail' },
  { port: 993, proto: 'TCP', service: 'IMAPS', desc: 'IMAP over SSL', cat: 'mail' },

  { port: 21, proto: 'TCP', service: 'FTP', desc: '文件传输(明文)', cat: 'file', risk: '明文口令,建议改用 SFTP' },
  { port: 22, proto: 'TCP', service: 'SSH / SFTP', desc: '安全远程登录与文件传输', cat: 'file', risk: '防暴力破解,建议密钥登录' },
  { port: 23, proto: 'TCP', service: 'Telnet', desc: '明文远程登录(已淘汰)', cat: 'file', risk: '明文传输,不要使用' },
  { port: 445, proto: 'TCP', service: 'SMB', desc: 'Windows 文件共享', cat: 'file', risk: '曾导致永恒之蓝,勿公网暴露' },
  { port: 3389, proto: 'TCP', service: 'RDP', desc: 'Windows 远程桌面', cat: 'file', risk: '公网暴露易被暴力破解' },
  { port: 873, proto: 'TCP', service: 'rsync', desc: '文件同步服务', cat: 'file' },

  { port: 2375, proto: 'TCP', service: 'Docker API', desc: 'Docker 未加密管理接口', cat: 'monitor', risk: '暴露即等于交出 root' },
  { port: 2376, proto: 'TCP', service: 'Docker TLS', desc: 'Docker 加密管理接口', cat: 'monitor' },
  { port: 5000, proto: 'TCP', service: 'Docker Registry', desc: '私有镜像仓库常见端口', cat: 'monitor' },
  { port: 6443, proto: 'TCP', service: 'Kubernetes API', desc: 'K8s 控制面', cat: 'monitor', risk: '需严格 RBAC 与鉴权' },
  { port: 9090, proto: 'TCP', service: 'Prometheus', desc: '监控数据与面板', cat: 'monitor' },
  { port: 9100, proto: 'TCP', service: 'node_exporter', desc: '主机指标导出', cat: 'monitor' },
  { port: 3001, proto: 'TCP', service: 'Grafana Alt', desc: 'Grafana 常用备用端口(默认 3000)', cat: 'monitor' },

  { port: 1080, proto: 'TCP', service: 'SOCKS', desc: 'SOCKS5 代理端口', cat: 'dev' },
  { port: 7890, proto: 'TCP', service: 'Clash', desc: 'Clash HTTP / SOCKS 混合代理', cat: 'dev' },
  { port: 7897, proto: 'TCP', service: 'Clash Verge', desc: 'Clash Verge 混合代理端口', cat: 'dev' },
  { port: 10808, proto: 'TCP', service: 'v2rayN', desc: 'v2ray SOCKS 常用端口', cat: 'dev' },
  { port: 2333, proto: 'TCP', service: 'frp', desc: 'frp 服务端控制端口', cat: 'dev' },
  { port: 4000, proto: 'TCP', service: 'Dev Alt', desc: '常见本地调试服务端口', cat: 'dev' },
]

const cat = ref('all')
const kw = ref('')

const shown = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return PORTS.filter((p) => {
    if (cat.value !== 'all' && p.cat !== cat.value) return false
    if (!k) return true
    return (
      String(p.port).includes(k) ||
      p.service.toLowerCase().includes(k) ||
      p.desc.toLowerCase().includes(k) ||
      p.proto.toLowerCase().includes(k)
    )
  })
})

async function copyPort(p: PortItem) {
  try {
    await navigator.clipboard.writeText(String(p.port))
    ElMessage.success(`已复制端口 ${p.port}`)
  } catch {
    ElMessage.error('复制失败')
  }
}

const countOf = (key: string) => (key === 'all' ? PORTS.length : PORTS.filter((p) => p.cat === key).length)
</script>

<template>
  <div class="pl">
    <div class="head">
      <div>
        <h3 class="title">端口速查</h3>
        <p class="sub">常用服务端口与风险提示,点击行即可复制端口号</p>
      </div>
      <el-input v-model="kw" class="search" :prefix-icon="Search" placeholder="搜索端口 / 服务 / 说明" clearable />
    </div>

    <div class="tabs">
      <button
        v-for="c in CATS"
        :key="c.key"
        class="tab"
        :class="{ on: cat === c.key }"
        @click="cat = c.key"
      >{{ c.label }} <span class="n">{{ countOf(c.key) }}</span></button>
    </div>

    <div class="table">
      <div class="tr th">
        <span class="c-port">端口</span>
        <span class="c-proto">协议</span>
        <span class="c-svc">服务</span>
        <span class="c-desc">说明与风险</span>
      </div>
      <div v-for="p in shown" :key="p.port + p.service" class="tr" @click="copyPort(p)">
        <span class="c-port">{{ p.port }}</span>
        <span class="c-proto">{{ p.proto }}</span>
        <span class="c-svc">{{ p.service }}</span>
        <span class="c-desc">
          {{ p.desc }}
          <span v-if="p.risk" class="risk">⚠ {{ p.risk }}</span>
        </span>
        <el-icon class="cp"><DocumentCopy /></el-icon>
      </div>
      <div v-if="!shown.length" class="none">没有匹配的端口</div>
    </div>

    <p class="foot">说明:列表为常见默认端口,仅供排查参考;真正对外暴露的服务请务必改默认端口并加密、鉴权、加白名单。</p>
  </div>
</template>

<style scoped>
.pl {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
  width: 220px;
}
.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tab {
  border: 1px solid var(--card-border);
  background: transparent;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}
.tab.on {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.n {
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  margin-left: 2px;
}
.table {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
}
.tr {
  display: grid;
  grid-template-columns: 70px 76px 150px 1fr 22px;
  gap: 10px;
  align-items: center;
  padding: 7px 14px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--card-border);
  cursor: pointer;
}
.tr:last-child {
  border-bottom: none;
}
.tr:not(.th):hover {
  background: var(--el-fill-color-light);
}
.th {
  background: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: default;
  font-weight: 600;
}
.c-port {
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 600;
  color: var(--el-color-primary);
}
.c-proto {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.c-svc {
  font-weight: 600;
}
.c-desc {
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
.risk {
  display: inline-block;
  margin-left: 6px;
  color: #ef4444;
  font-size: 11px;
}
.cp {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.none {
  padding: 30px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
