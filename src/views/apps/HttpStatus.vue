<script setup lang="ts">
/**
 * HTTP 状态码查询(仿找Tab「HTTP 状态码查询」)
 * 1xx~5xx 常用状态码速查:按类别筛选、关键词搜索、点击看含义与常见处理建议。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

interface Status { code: number; en: string; zh: string; desc: string; hint: string }

const LIST: Status[] = [
  { code: 100, en: 'Continue', zh: '继续', desc: '服务端已收到请求头,客户端应继续发送请求体。', hint: '常见于带 Expect: 100-continue 的大文件上传。' },
  { code: 101, en: 'Switching Protocols', zh: '切换协议', desc: '服务端同意按 Upgrade 头切换协议。', hint: 'WebSocket 握手成功的响应码。' },
  { code: 102, en: 'Processing', zh: '处理中', desc: 'WebDAV:请求已收到但尚未完成。', hint: '防止客户端超时断开。' },
  { code: 103, en: 'Early Hints', zh: '早期提示', desc: '在最终响应前先返回部分 Link 头。', hint: '用于提前预加载资源。' },
  { code: 200, en: 'OK', zh: '成功', desc: '请求成功,响应体中包含结果。', hint: '最常见的成功响应。' },
  { code: 201, en: 'Created', zh: '已创建', desc: '请求成功且服务端新建了资源。', hint: 'RESTful 创建接口常用,响应应带 Location。' },
  { code: 202, en: 'Accepted', zh: '已接受', desc: '已接受请求但尚未处理完成。', hint: '异步任务场景,后续需轮询结果。' },
  { code: 204, en: 'No Content', zh: '无内容', desc: '请求成功但没有响应体。', hint: 'DELETE 或纯提交接口常用。' },
  { code: 205, en: 'Reset Content', zh: '重置内容', desc: '请求成功,要求客户端重置视图。', hint: '表单提交后清空输入框。' },
  { code: 206, en: 'Partial Content', zh: '部分内容', desc: '范围请求成功,返回部分数据。', hint: '断点续传 / 视频拖动,配合 Range 与 Content-Range。' },
  { code: 301, en: 'Moved Permanently', zh: '永久重定向', desc: '资源已永久迁移到 Location 指定的地址。', hint: '浏览器与搜索引擎会缓存,改错很难撤回,谨慎使用。' },
  { code: 302, en: 'Found', zh: '临时重定向', desc: '资源临时位于 Location 指定地址。', hint: '默认会把 POST 改成 GET,需保留方法请用 307。' },
  { code: 303, en: 'See Other', zh: '查看其他位置', desc: '用 GET 到另一个地址获取结果。', hint: 'POST 提交后跳转到结果页(PRG 模式)。' },
  { code: 304, en: 'Not Modified', zh: '未修改', desc: '资源未变化,客户端可直接使用缓存。', hint: '配合 If-None-Match / If-Modified-Since。' },
  { code: 307, en: 'Temporary Redirect', zh: '临时重定向(保留方法)', desc: '临时重定向且不改变请求方法与请求体。', hint: '比 302 更严格。' },
  { code: 308, en: 'Permanent Redirect', zh: '永久重定向(保留方法)', desc: '永久重定向且不改变请求方法与请求体。', hint: '301 的严格版本。' },
  { code: 400, en: 'Bad Request', zh: '错误请求', desc: '请求语法或参数有误,服务端无法理解。', hint: '检查 JSON 格式、必填参数与类型。' },
  { code: 401, en: 'Unauthorized', zh: '未认证', desc: '需要身份验证,或凭证无效/过期。', hint: '检查 Token、Cookie;注意名字虽是 Unauthorized 但语义是未认证。' },
  { code: 402, en: 'Payment Required', zh: '需要付款', desc: '保留状态码,部分支付系统用于表示需付费。', hint: '标准中尚未正式定义具体语义。' },
  { code: 403, en: 'Forbidden', zh: '禁止访问', desc: '已识别身份但没有权限访问该资源。', hint: '与 401 区别:重新登录也解决不了,需改权限。' },
  { code: 404, en: 'Not Found', zh: '未找到', desc: '请求的资源不存在。', hint: '检查路径、路由与大小写;也可能是服务端刻意隐藏存在性。' },
  { code: 405, en: 'Method Not Allowed', zh: '方法不允许', desc: '资源存在但不支持该 HTTP 方法。', hint: '看 Allow 响应头得知支持哪些方法。' },
  { code: 406, en: 'Not Acceptable', zh: '不可接受', desc: '无法按 Accept 头协商出可接受的格式。', hint: '检查 Accept / Accept-Language。' },
  { code: 408, en: 'Request Timeout', zh: '请求超时', desc: '服务端等待请求超时。', hint: '网络慢或请求体过大,可重试。' },
  { code: 409, en: 'Conflict', zh: '冲突', desc: '请求与当前资源状态冲突。', hint: '并发更新、重复创建、版本号不匹配。' },
  { code: 410, en: 'Gone', zh: '已删除', desc: '资源曾存在但已被永久删除。', hint: '比 404 更明确,搜索引擎可删除索引。' },
  { code: 413, en: 'Payload Too Large', zh: '请求体过大', desc: '请求体超过服务端限制。', hint: '调 nginx client_max_body_size 或分片上传。' },
  { code: 414, en: 'URI Too Long', zh: 'URI 过长', desc: 'URL 超过服务端可处理长度。', hint: '把参数从 GET 改成 POST body。' },
  { code: 415, en: 'Unsupported Media Type', zh: '不支持的媒体类型', desc: 'Content-Type 与服务端要求不符。', hint: '如接口要 application/json 却发了 form-data。' },
  { code: 418, en: "I'm a teapot", zh: '我是茶壶', desc: 'RFC 2324 愚人节彩蛋:茶壶拒绝泡咖啡。', hint: '仅作趣味用途,部分框架用它做反爬占位。' },
  { code: 422, en: 'Unprocessable Entity', zh: '无法处理的实体', desc: '格式正确但语义校验失败。', hint: '字段校验不通过,响应体通常带具体字段错误。' },
  { code: 429, en: 'Too Many Requests', zh: '请求过多', desc: '触发限流。', hint: '按 Retry-After 退避重试,客户端做限流。' },
  { code: 431, en: 'Request Header Fields Too Large', zh: '请求头过大', desc: '请求头总体积超过限制。', hint: '清理过大的 Cookie 或自定义头。' },
  { code: 451, en: 'Unavailable For Legal Reasons', zh: '因法律原因不可用', desc: '因法律/合规要求拒绝提供内容。', hint: '常见于地域合规屏蔽。' },
  { code: 500, en: 'Internal Server Error', zh: '服务器内部错误', desc: '服务端未捕获的异常。', hint: '查服务端日志;客户端重试通常无效。' },
  { code: 501, en: 'Not Implemented', zh: '未实现', desc: '服务端不支持完成请求所需的功能。', hint: '常见于未实现的方法。' },
  { code: 502, en: 'Bad Gateway', zh: '错误网关', desc: '网关/代理从上游收到了无效响应。', hint: '检查上游服务是否挂了或超时。' },
  { code: 503, en: 'Service Unavailable', zh: '服务不可用', desc: '服务临时过载或在维护。', hint: '通常带 Retry-After,可稍后重试。' },
  { code: 504, en: 'Gateway Timeout', zh: '网关超时', desc: '网关等待上游响应超时。', hint: '检查上游耗时与代理 timeout 配置。' },
  { code: 505, en: 'HTTP Version Not Supported', zh: 'HTTP 版本不支持', desc: '服务端不支持请求所用的 HTTP 版本。', hint: '极少见。' },
  { code: 507, en: 'Insufficient Storage', zh: '存储空间不足', desc: 'WebDAV:服务端存储不足。', hint: '清理磁盘。' },
  { code: 511, en: 'Network Authentication Required', zh: '需要网络认证', desc: '需先完成门户认证(如公共 Wi-Fi 登录)。', hint: ' captive portal 场景。' },
]

const CATS = [
  { key: 'all', label: '全部' },
  { key: '1', label: '1xx 信息' },
  { key: '2', label: '2xx 成功' },
  { key: '3', label: '3xx 重定向' },
  { key: '4', label: '4xx 客户端错误' },
  { key: '5', label: '5xx 服务端错误' },
] as const

const cat = ref<string>('all')
const query = ref('')
const selected = ref<number | null>(null)

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return LIST.filter((s) => {
    if (cat.value !== 'all' && String(s.code)[0] !== cat.value) return false
    if (!q) return true
    return `${s.code} ${s.en} ${s.zh} ${s.desc} ${s.hint}`.toLowerCase().includes(q)
  })
})

const current = computed(() => LIST.find((s) => s.code === selected.value) ?? null)

function colorOf(code: number): string {
  const n = Math.floor(code / 100)
  return ['#64748b', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'][n - 1] ?? '#64748b'
}

async function copyCurrent() {
  const s = current.value
  if (!s) return
  await copyText(`${s.code} ${s.en} — ${s.zh}\n${s.desc}\n${s.hint}`)
  ElMessage.success(`已复制 ${s.code}`)
}

function exportAll() {
  const lines = ['状态码\t英文名\t中文名\t说明\t建议']
  rows.value.forEach((s) => lines.push([s.code, s.en, s.zh, s.desc, s.hint].join('\t')))
  downloadText(lines.join('\n'), 'http-status.tsv', 'text/tab-separated-values;charset=utf-8')
  ElMessage.success('已导出 TSV')
}
</script>

<template>
  <div class="hs">
    <div class="head">
      <div>
        <h3 class="title">HTTP 状态码查询</h3>
        <p class="sub">1xx~5xx 常用状态码速查,含含义区分与排查建议</p>
      </div>
      <div class="acts">
        <el-input v-model="query" class="q" clearable placeholder="搜索 404 / Forbidden / 限流" />
        <el-button size="small" @click="exportAll">导出 TSV</el-button>
      </div>
    </div>

    <div class="chips">
      <button v-for="c in CATS" :key="c.key" class="chip" :class="{ on: cat === c.key }" @click="cat = c.key">{{ c.label }}</button>
      <span class="count">共 {{ rows.length }} 条</span>
    </div>

    <div class="grid">
      <button
        v-for="s in rows" :key="s.code" class="card"
        :class="{ on: selected === s.code }" :style="'--c: ' + colorOf(s.code)"
        @click="selected = s.code"
      >
        <span class="code">{{ s.code }}</span>
        <span class="names"><b>{{ s.zh }}</b><em>{{ s.en }}</em></span>
      </button>
      <div v-if="!rows.length" class="empty">没有匹配的状态码</div>
    </div>

    <div v-if="current" class="detail" :style="{ borderColor: colorOf(current.code) }">
      <div class="d-head">
        <span class="d-code" :style="{ background: colorOf(current.code) }">{{ current.code }}</span>
        <div>
          <div class="d-title">{{ current.zh }} · {{ current.en }}</div>
          <div class="d-desc">{{ current.desc }}</div>
        </div>
        <el-button size="small" @click="copyCurrent">复制</el-button>
      </div>
      <div class="d-hint"><b>排查建议:</b>{{ current.hint }}</div>
    </div>
    <p class="foot">点击卡片查看释义。401 是「未认证」、403 是「无权限」;302 可能把 POST 改成 GET,需要保留方法用 307/308。</p>
  </div>
</template>

<style scoped>
.hs { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.acts { display: flex; gap: 8px; align-items: center; }
.q { width: 230px; }
.chips { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.chip { border: 1px solid var(--el-border-color); background: var(--el-fill-color-blank); color: var(--el-text-color-regular); border-radius: 15px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.chip.on { background: var(--el-color-primary); border-color: var(--el-color-primary); color: #fff; }
.count { font-size: 11px; color: var(--el-text-color-secondary); margin-left: auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 9px; max-height: 340px; overflow-y: auto; }
.card { display: flex; align-items: center; gap: 10px; text-align: left; padding: 9px 12px; border: 1px solid var(--el-border-color); border-left: 3px solid var(--c); border-radius: 9px; background: var(--el-fill-color-blank); cursor: pointer; }
.card:hover, .card.on { background: var(--el-fill-color-light); border-color: var(--c); }
.code { font-size: 16px; font-weight: 800; color: var(--c); font-variant-numeric: tabular-nums; }
.names { display: flex; flex-direction: column; min-width: 0; }
.names b { font-size: 12px; }
.names em { font-size: 10px; font-style: normal; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { padding: 28px; text-align: center; color: var(--el-text-color-secondary); font-size: 12px; }
.detail { margin-top: 14px; padding: 14px; border: 1px solid; border-radius: 12px; background: var(--el-fill-color-light); }
.d-head { display: flex; align-items: center; gap: 12px; }
.d-code { flex: none; padding: 5px 10px; border-radius: 9px; color: #fff; font-weight: 800; font-size: 15px; }
.d-title { font-size: 14px; font-weight: 700; }
.d-desc { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 3px; }
.d-head .el-button { margin-left: auto; }
.d-hint { font-size: 12px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--el-border-color); }
.d-hint b { margin-right: 6px; }
.foot { font-size: 11px; color: var(--el-text-color-secondary); margin: 10px 0 0; }
</style>
