<script setup lang="ts">
/**
 * Nginx 配置生成器
 * 勾选所需功能,实时生成带中文注释的 Nginx 配置,可复制或下载 .conf 文件。
 */
import { computed, reactive, ref } from 'vue'
import { CopyDocument, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const form = reactive({
  domain: 'example.com',
  port: 80,
  root: '/var/www/html',
  upstream: 'http://127.0.0.1:3000',
  spa: true,
  static: false,
  proxy: false,
  ws: false,
  https: false,
  gzip: true,
  cache: true,
  cors: false,
  limitReq: false,
  security: true,
})

const opts = [
  { key: 'spa', label: '单页应用(SPA history 路由回退)' },
  { key: 'static', label: '静态网站(root 目录)' },
  { key: 'proxy', label: '反向代理(转发到本地服务)' },
  { key: 'ws', label: 'WebSocket 代理升级' },
  { key: 'https', label: 'HTTPS + HTTP 跳转' },
  { key: 'gzip', label: 'Gzip 压缩' },
  { key: 'cache', label: '静态资源长缓存' },
  { key: 'cors', label: '跨域响应头' },
  { key: 'limitReq', label: '限流(10 req/s 突发 20)' },
  { key: 'security', label: '安全响应头' },
] as const

const conf = computed(() => {
  const f = form
  const lines: string[] = []
  const listen = f.https ? '443 ssl' : String(f.port)
  if (f.https) {
    lines.push(
      '# HTTP 全部 301 跳转到 HTTPS',
      'server {',
      '    listen 80;',
      `    server_name ${f.domain};`,
      '    return 301 https://$host$request_uri;',
      '}',
      '',
    )
  }
  lines.push(`server {`, `    listen ${listen};`, `    server_name ${f.domain};`)
  if (f.https) {
    lines.push(
      '',
      '    # 证书路径按实际位置修改',
      '    ssl_certificate     /etc/nginx/ssl/fullchain.pem;',
      '    ssl_certificate_key /etc/nginx/ssl/privkey.pem;',
      '    ssl_protocols TLSv1.2 TLSv1.3;',
    )
  }
  if (f.root) lines.push('', `    # 网站根目录`, `    root  ${f.root};`, `    index index.html index.htm;`)
  if (f.gzip) {
    lines.push(
      '',
      '    # Gzip 压缩',
      '    gzip on;',
      '    gzip_comp_level 5;',
      '    gzip_min_length 1k;',
      '    gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml image/svg+xml;',
      '    gzip_vary on;',
    )
  }
  if (f.security) {
    lines.push(
      '',
      '    # 安全响应头',
      '    add_header X-Frame-Options SAMEORIGIN;',
      '    add_header X-Content-Type-Options nosniff;',
      '    add_header X-XSS-Protection "1; mode=block";',
      '    add_header Referrer-Policy strict-origin-when-cross-origin;',
    )
  }
  if (f.cors) {
    lines.push(
      '',
      '    # 跨域(按需收紧 origin)',
      '    add_header Access-Control-Allow-Origin *;',
      '    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";',
      '    add_header Access-Control-Allow-Headers "Content-Type, Authorization";',
      '    if ($request_method = OPTIONS) { return 204; }',
    )
  }
  if (f.limitReq) {
    lines.push(
      '',
      '    # 限流:每 IP 10 req/s,突发 20(需在 http 块加:limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;)',
      '    limit_req zone=api burst=20 nodelay;',
    )
  }
  if (f.cache) {
    lines.push(
      '',
      '    # 静态资源长缓存(指纹文件名)',
      '    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {',
      '        expires 30d;',
      '        add_header Cache-Control "public, immutable";',
      '    }',
    )
  }
  if (f.proxy) {
    lines.push(
      '',
      '    # 反向代理到本地服务',
      '    location /api/ {',
      `        proxy_pass ${f.upstream};`,
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
    )
    if (f.ws) {
      lines.push(
        '        # WebSocket 升级',
        '        proxy_http_version 1.1;',
        '        proxy_set_header Upgrade $http_upgrade;',
        '        proxy_set_header Connection "upgrade";',
        '        proxy_read_timeout 3600s;',
      )
    }
    lines.push('    }')
  } else if (f.ws) {
    lines.push(
      '',
      '    # WebSocket 代理(需配合反向代理使用)',
      '    location /ws/ {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Upgrade $http_upgrade;',
      '        proxy_set_header Connection "upgrade";',
      '    }',
    )
  }
  if (f.spa) {
    lines.push(
      '',
      '    # 单页应用:前端路由回退到 index.html',
      '    location / {',
      '        try_files $uri $uri/ /index.html;',
      '    }',
    )
  }
  lines.push('}')
  return lines.join('\n')
})

const copied = ref(false)

async function doCopy() {
  await copyText(conf.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
  ElMessage.success('已复制')
}

function download() {
  const blob = new Blob([conf.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'nginx.conf'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="ngx">
    <div class="cols">
      <div class="left">
        <div class="fields">
          <el-form label-width="86px" size="small" label-position="left">
            <el-form-item label="域名">
              <el-input v-model="form.domain" />
            </el-form-item>
            <el-form-item label="监听端口">
              <el-input-number v-model="form.port" :min="1" :max="65535" :disabled="form.https" />
            </el-form-item>
            <el-form-item label="网站根目录">
              <el-input v-model="form.root" :disabled="!form.static" />
            </el-form-item>
            <el-form-item label="上游地址">
              <el-input v-model="form.upstream" :disabled="!form.proxy" />
            </el-form-item>
          </el-form>
        </div>
        <div class="checks">
          <el-checkbox v-for="o in opts" :key="o.key" v-model="form[o.key]">{{ o.label }}</el-checkbox>
        </div>
      </div>
      <div class="right">
        <div class="bar">
          <el-button size="small" type="primary" :icon="copied ? CopyDocument : CopyDocument" @click="doCopy">
            {{ copied ? '已复制' : '复制配置' }}
          </el-button>
          <el-button size="small" :icon="Download" @click="download">下载 .conf</el-button>
        </div>
        <pre class="code">{{ conf }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
}
@media (max-width: 800px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--card-border);
  padding-top: 12px;
}
.bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.code {
  margin: 0;
  padding: 14px;
  border-radius: 10px;
  background: #0b1020;
  color: #d1e3ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  max-height: 60vh;
  white-space: pre;
}
</style>
