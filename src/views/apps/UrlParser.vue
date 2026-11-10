<script setup lang="ts">
/**
 * URL 参数解析 / 构建
 * 解析:拆解 URL 的 origin / path / hash 与全部查询参数(自动解码、支持同名多值);
 * 构建:以键值对编辑方式生成完整 URL,可切换空格编码形式。全部在本机处理。
 */
import { computed, reactive, ref } from 'vue'
import { CopyDocument, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const tab = ref<'parse' | 'build'>('parse')
const parseState = reactive({
  raw: 'https://example.com/search?q=vue%20tools&tag=web&tag=frontend&page=1#top',
})

interface ParamGroup {
  key: string
  values: string[]
}
interface ParseResult {
  origin: string
  pathname: string
  hash: string
  params: ParamGroup[]
  error: string
  hasOrigin: boolean
}

const parsed = computed<ParseResult>(() => {
  const empty: ParseResult = { origin: '', pathname: '', hash: '', params: [], error: '', hasOrigin: false }
  const raw = parseState.raw.trim()
  if (!raw) return empty
  try {
    let u: URL
    let hasOrigin = false
    try {
      u = new URL(raw)
      hasOrigin = true
    } catch {
      // 允许只粘贴 query 串、相对路径或 hash
      const suffix = raw.startsWith('/') || raw.startsWith('?') || raw.startsWith('#') ? raw : '/?' + raw
      u = new URL('https://example.invalid' + suffix)
    }
    const map = new Map<string, string[]>()
    u.searchParams.forEach((v, k) => {
      const arr = map.get(k) || []
      arr.push(v)
      map.set(k, arr)
    })
    return {
      origin: hasOrigin ? u.origin : '',
      pathname: hasOrigin ? u.pathname : suffixPath(u.pathname),
      hash: u.hash,
      params: [...map.entries()].map(([key, values]) => ({ key, values })),
      error: '',
      hasOrigin,
    }
  } catch {
    return { ...empty, error: '无法解析该内容,请检查是否为合法的 URL 或查询串' }
  }
})

function suffixPath(p: string): string {
  return p === '/__local__' || p === '/' ? '' : p.replace(/^\//, '')
}

const paramsJson = computed(() => {
  const obj: Record<string, string | string[]> = {}
  parsed.value.params.forEach((p) => {
    obj[p.key] = p.values.length > 1 ? p.values : p.values[0]
  })
  return JSON.stringify(obj, null, 2)
})

const paramsQuery = computed(() => {
  const usp = new URLSearchParams()
  parsed.value.params.forEach((p) => p.values.forEach((v) => usp.append(p.key, v)))
  return usp.toString()
})

interface Row {
  id: number
  key: string
  value: string
}
let seq = 0
const rows = ref<Row[]>([
  { id: ++seq, key: 'q', value: 'vue tools' },
  { id: ++seq, key: 'page', value: '1' },
])
const buildState = reactive({
  base: 'https://example.com/search',
  spaceAsPlus: true,
  hash: '',
})

const builtUrl = computed(() => {
  const base = buildState.base.trim()
  if (!base) return ''
  const valid = rows.value.filter((r) => r.key.trim() !== '' || r.value.trim() !== '')
  let query = ''
  if (valid.length) {
    if (buildState.spaceAsPlus) {
      const usp = new URLSearchParams()
      valid.forEach((r) => usp.append(r.key, r.value))
      query = usp.toString()
    } else {
      query = valid.map((r) => encodeURIComponent(r.key) + '=' + encodeURIComponent(r.value)).join('&')
    }
  }
  const sep = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?'
  const hash = buildState.hash.trim() ? '#' + buildState.hash.trim().replace(/^#/, '') : ''
  return base + (query ? sep + query : '') + hash
})

function addRow() {
  rows.value.push({ id: ++seq, key: '', value: '' })
}
function removeRow(id: number) {
  rows.value = rows.value.filter((r) => r.id !== id)
}

/** 把解析结果载入构建器,便于修改后重新生成 */
function editParsed() {
  const list: Row[] = []
  parsed.value.params.forEach((p) => p.values.forEach((v) => list.push({ id: ++seq, key: p.key, value: v })))
  if (!list.length) list.push({ id: ++seq, key: '', value: '' })
  rows.value = list
  buildState.base = parsed.value.hasOrigin
    ? parsed.value.origin + parsed.value.pathname
    : parsed.value.pathname || 'https://example.com/'
  tab.value = 'build'
  ElMessage.success('已载入构建器')
}

async function copy(v: string, tip = '已复制') {
  if (!v) return
  await copyText(v)
  ElMessage.success(tip)
}
</script>

<template>
  <div class="up">
    <div class="head">
      <div>
        <h3 class="title">URL 参数解析</h3>
        <p class="sub">拆解查询参数、支持同名多值;也可按键值对反向构建 URL</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="parse">解析 URL</el-radio-button>
        <el-radio-button value="build">构建 URL</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="tab === 'parse'">
      <el-input
        v-model="parseState.raw"
        type="textarea"
        :rows="3"
        spellcheck="false"
        placeholder="粘贴完整 URL,或直接粘贴 a=1&b=2 这样的查询串"
      />
      <div v-if="parsed.error" class="err">{{ parsed.error }}</div>
      <template v-else>
        <div class="parts">
          <div v-if="parsed.hasOrigin" class="part">
            <span class="p-lbl">源</span><span class="p-val">{{ parsed.origin }}</span>
          </div>
          <div class="part">
            <span class="p-lbl">路径</span><span class="p-val">{{ parsed.pathname || '/' }}</span>
          </div>
          <div class="part">
            <span class="p-lbl">锚点</span><span class="p-val">{{ parsed.hash || '—' }}</span>
          </div>
          <div class="part">
            <span class="p-lbl">参数</span><span class="p-val">{{ parsed.params.length }} 个键</span>
          </div>
        </div>

        <div class="block-head">
          <span>查询参数(已解码)</span>
          <div class="acts">
            <el-button size="small" text :icon="CopyDocument" @click="copy(paramsQuery, '已复制查询串')">复制查询串</el-button>
            <el-button size="small" text :icon="CopyDocument" @click="copy(paramsJson, '已复制 JSON')">复制 JSON</el-button>
            <el-button size="small" text @click="editParsed">载入构建器</el-button>
          </div>
        </div>
        <div v-if="!parsed.params.length" class="empty">没有查询参数</div>
        <div v-else class="table">
          <div class="tr th">
            <span>参数名</span><span>值</span>
          </div>
          <div v-for="p in parsed.params" :key="p.key" class="tr">
            <span class="k">{{ p.key }}</span>
            <span class="v">
              <em v-for="(v, i) in p.values" :key="i">{{ v }}</em>
            </span>
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="base-row">
        <span class="lbl">基础地址</span>
        <el-input v-model="buildState.base" placeholder="https://example.com/search" />
      </div>
      <div class="rows">
        <div v-for="(r, i) in rows" :key="r.id" class="row">
          <span class="idx">{{ i + 1 }}</span>
          <el-input v-model="r.key" placeholder="参数名" />
          <span class="eq">=</span>
          <el-input v-model="r.value" placeholder="参数值" />
          <el-button :icon="Delete" circle size="small" @click="removeRow(r.id)" />
        </div>
      </div>
      <div class="row-acts">
        <el-button size="small" :icon="Plus" @click="addRow">添加参数</el-button>
        <el-checkbox v-model="buildState.spaceAsPlus">空格编码为 +(取消则编码为 %20)</el-checkbox>
      </div>
      <div class="base-row">
        <span class="lbl">锚点</span>
        <el-input v-model="buildState.hash" placeholder="可选,如 section-2" />
      </div>

      <div class="block-head">
        <span>生成结果</span>
        <el-button size="small" text :icon="CopyDocument" @click="copy(builtUrl, '已复制 URL')">复制 URL</el-button>
      </div>
      <div class="result">{{ builtUrl || '—' }}</div>
    </template>

    <p class="foot">提示:解析与构建均在本机完成,不会把地址发送到任何服务器;同名参数会保留全部取值。</p>
  </div>
</template>

<style scoped>
.up {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
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
.err {
  margin-top: 10px;
  color: #ef4444;
  font-size: 13px;
}
.parts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 14px;
  margin-bottom: 18px;
}
.part {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-fill-color-light);
  min-width: 0;
}
.p-lbl {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.p-val {
  font-size: 13px;
  word-break: break-all;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.acts {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
.table {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: hidden;
}
.tr {
  display: grid;
  grid-template-columns: 180px 1fr;
  border-bottom: 1px solid var(--card-border);
  font-size: 13px;
}
.tr:last-child {
  border-bottom: none;
}
.tr.th {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.tr > span {
  padding: 9px 12px;
  word-break: break-all;
}
.tr .k {
  font-family: ui-monospace, Menlo, monospace;
  border-right: 1px solid var(--card-border);
}
.tr .v {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tr .v em {
  font-style: normal;
}
.empty {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  border: 1px dashed var(--card-border);
  border-radius: 10px;
  font-size: 13px;
}
.base-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  width: 64px;
  flex: none;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.idx {
  width: 22px;
  flex: none;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.eq {
  color: var(--el-text-color-secondary);
}
.row-acts {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.result {
  padding: 12px 14px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
@media (max-width: 640px) {
  .tr {
    grid-template-columns: 110px 1fr;
  }
}
</style>
