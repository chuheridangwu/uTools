<script setup lang="ts">
/**
 * JSON / CSV 转换(仿找Tab「JSON / CSV 转换」)
 * 双向转换,全部在本机完成:JSON 数组(含嵌套对象)→ CSV / CSV → JSON 或 JSON Lines。
 * CSV 解析支持引号包裹、字段内逗号与换行、双引号转义。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const tab = ref<'j2c' | 'c2j'>('j2c')
const j2c = reactive({
  input: `[\n  { "name": "Ada", "age": 28, "address": { "city": "London" }, "tags": ["dev", "admin"] },\n  { "name": "Bob", "age": 32, "address": { "city": "Paris" }, "tags": ["ops"] }\n]`,
  delimiter: ',',
  quote: 'minimal' as 'minimal' | 'all',
  header: true,
  flatten: true,
})
const c2j = reactive({
  input: 'name,age,city\nAda,28,London\n"Bob, Jr.",32,"Paris\nFrance"',
  delimiter: ',',
  header: true,
  jsonl: false,
})

const DELIMS = [
  { label: '逗号 ,', value: ',' },
  { label: '分号 ;', value: ';' },
  { label: '制表符 Tab', value: '\t' },
  { label: '竖线 |', value: '|' },
]

function flattenObject(obj: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (j2c.flatten && v && typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v as Record<string, unknown>, key, out)
    } else {
      out[key] = Array.isArray(v) ? JSON.stringify(v) : v
    }
  }
  return out
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

function csvEscape(v: string, delim: string): string {
  const need = j2c.quote === 'all' || v.includes(delim) || /["\r\n]/.test(v)
  const body = v.replace(/"/g, '""')
  return need ? `"${body}"` : body
}

const csvOut = computed(() => {
  try {
    const data = JSON.parse(j2c.input)
    const arr: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
    if (!arr.length || arr.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) return ''
    const rows = arr.map((x) => flattenObject(x))
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
    const d = j2c.delimiter
    const lines: string[] = []
    if (j2c.header) lines.push(keys.map((k) => csvEscape(k, d)).join(d))
    rows.forEach((r) => lines.push(keys.map((k) => csvEscape(cell(r[k]), d)).join(d)))
    return lines.join('\n')
  } catch {
    return ''
  }
})

const jsonError = computed(() => {
  if (!j2c.input.trim()) return ''
  try {
    const data = JSON.parse(j2c.input)
    const arr = Array.isArray(data) ? data : [data]
    if (!arr.length) return 'JSON 数组为空'
    if (arr.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) return '需要「对象数组」或单个对象,数组元素不能是原始值'
    return ''
  } catch (e) {
    return 'JSON 解析失败:' + (e instanceof Error ? e.message : String(e))
  }
})

/** 标准 CSV 解析器:支持引号内的逗号、换行与 "" 转义 */
function parseCsv(src: string, delim: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') { quoted = true; continue }
    if (ch === delim) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

function autoNumber(v: string): unknown {
  if (v === '') return ''
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (v === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(v) && String(Number(v)) === v) return Number(v)
  return v
}

const jsonOut = computed(() => {
  const rows = parseCsv(c2j.input, c2j.delimiter)
  if (!rows.length) return ''
  let keys: string[]
  let body: string[][]
  if (c2j.header) { keys = rows[0].map((k, i) => k || `col_${i + 1}`); body = rows.slice(1) }
  else { const n = Math.max(...rows.map((r) => r.length)); keys = Array.from({ length: n }, (_, i) => `col_${i + 1}`); body = rows }
  const objs = body.map((r) => {
    const o: Record<string, unknown> = {}
    keys.forEach((k, i) => { o[k] = autoNumber(r[i] ?? '') })
    return o
  })
  if (c2j.jsonl) return objs.map((o) => JSON.stringify(o)).join('\n')
  return JSON.stringify(objs, null, 2)
})

async function copy(v: string) {
  if (!v) return
  await copyText(v)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="jc">
    <div class="head">
      <div>
        <h3 class="title">JSON / CSV 转换</h3>
        <p class="sub">对象数组与 CSV 双向转换,支持嵌套字段、引号内换行与转义</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="j2c">JSON → CSV</el-radio-button>
        <el-radio-button value="c2j">CSV → JSON</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="tab === 'j2c'">
      <div class="opts">
        <span class="lbl">分隔符</span>
        <el-select v-model="j2c.delimiter" class="sel">
          <el-option v-for="d in DELIMS" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <el-checkbox v-model="j2c.header">含表头</el-checkbox>
        <el-checkbox v-model="j2c.flatten">展开嵌套对象</el-checkbox>
        <el-radio-group v-model="j2c.quote" size="small">
          <el-radio-button value="minimal">按需加引号</el-radio-button>
          <el-radio-button value="all">全部加引号</el-radio-button>
        </el-radio-group>
      </div>
      <div class="two">
        <div>
          <div class="block-head"><span>JSON 输入</span><span class="hint">对象数组或单个对象</span></div>
          <el-input v-model="j2c.input" type="textarea" :rows="12" spellcheck="false" class="mono" />
          <div v-if="jsonError" class="err">{{ jsonError }}</div>
        </div>
        <div>
          <div class="block-head">
            <span>CSV 结果</span>
            <div class="acts">
              <el-button size="small" text :disabled="!csvOut" @click="copy(csvOut)">复制</el-button>
              <el-button size="small" text :disabled="!csvOut" @click="downloadText(csvOut, 'data.csv', 'text/csv;charset=utf-8')">下载 .csv</el-button>
            </div>
          </div>
          <el-input :model-value="csvOut" type="textarea" :rows="12" readonly class="mono" />
        </div>
      </div>
      <p class="foot">嵌套对象按点号展开(如 <code>address.city</code>),数组会序列化成 JSON 字符串;字段里的逗号、引号与换行会自动转义。</p>
    </template>

    <template v-else>
      <div class="opts">
        <span class="lbl">分隔符</span>
        <el-select v-model="c2j.delimiter" class="sel">
          <el-option v-for="d in DELIMS" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <el-checkbox v-model="c2j.header">首行为表头</el-checkbox>
        <el-checkbox v-model="c2j.jsonl">输出 JSON Lines</el-checkbox>
      </div>
      <div class="two">
        <div>
          <div class="block-head"><span>CSV 输入</span><span class="hint">支持引号内换行</span></div>
          <el-input v-model="c2j.input" type="textarea" :rows="12" spellcheck="false" class="mono" />
        </div>
        <div>
          <div class="block-head">
            <span>JSON 结果</span>
            <div class="acts">
              <el-button size="small" text :disabled="!jsonOut" @click="copy(jsonOut)">复制</el-button>
              <el-button size="small" text :disabled="!jsonOut" @click="downloadText(jsonOut, c2j.jsonl ? 'data.jsonl' : 'data.json', 'application/json;charset=utf-8')">下载</el-button>
            </div>
          </div>
          <el-input :model-value="jsonOut" type="textarea" :rows="12" readonly class="mono" />
        </div>
      </div>
      <p class="foot">数字、true/false、null 会自动识别;其余保持字符串。所有转换在本机完成,不会上传数据。</p>
    </template>
  </div>
</template>

<style scoped>
.jc { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.opts { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.lbl, .hint { font-size: 11px; color: var(--el-text-color-secondary); }
.sel { width: 130px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.acts { display: flex; gap: 4px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.err { margin-top: 8px; color: #ef4444; font-size: 12px; }
.foot { font-size: 11px; color: var(--el-text-color-secondary); margin: 12px 0 0; }
@media (max-width: 720px) { .two { grid-template-columns: 1fr; } }
</style>
