<script setup lang="ts">
/**
 * 代码生成器
 * 输入 JSON 样例 → 生成 TypeScript 接口 / Vue3 组件 / Python 类 / SQL 建表 / Markdown 表格。
 * 推断规则:typeof 类型递归嵌套,数组取第一个元素的结构。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

type Target = 'ts' | 'vue' | 'python' | 'sql' | 'markdown'

const input = ref('')

/** 填入 JSON 示例数据 */
function fillSample() {
  input.value = '{\n  "name": "tom",\n  "age": 18,\n  "vip": true,\n  "tags": ["a", "b"],\n  "profile": { "city": "上海" }\n}'
}
const target = ref<Target>('ts')
const rootName = ref('Item')
const output = ref('')

/** 驼峰转换:key.fmt → KeyFmt */
function pascal(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('') || 'Field'
}

/** JS 值 → TypeScript 类型字符串(递归) */
function tsType(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    return `${tsType(value[0])}[]`
  }
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'object':
      // 叶子级空对象或字段级对象统一映射,嵌套形态由 genInterfaces 展开
      return 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

/** 辅助:为对象生成 TS interface 文本(含嵌套子类型) */
function genInterfaces(name: string, value: unknown, out: string[]): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return
  const obj = value as Record<string, unknown>
  const props: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    let ats: string
    if (Array.isArray(v)) {
      const el = v[0]
      if (typeof el === 'object' && el && !Array.isArray(el)) {
        genInterfaces(pascal(k), el, out)
        ats = `${pascal(k)}[]`
      } else ats = `${tsType(el)}[]`
    } else if (typeof v === 'object' && v !== null) {
      genInterfaces(pascal(k), v, out)
      ats = pascal(k)
    } else ats = tsType(v)
    props.push(`  /** 字段: ${k} */\n  ${k}: ${ats}`)
  }
  const body = props.join('\n')
  out.splice(0, 0, `export interface ${name} {\n${body}\n}\n`)
}

function genTs(obj: Record<string, unknown>): string {
  const out: string[] = []
  genInterfaces(rootName.value, obj, out)
  return out.join('\n')
}

function genVue(obj: Record<string, unknown>): string {
  const cols = Object.keys(obj)
    .map((k) => `  { prop: '${k}', label: '${pascal(k)}' },`)
    .join('\n')
  return `<!-- 由 uTools 代码生成器输出,基于 el-table 快速展示对象数组 -->
<script setup lang="ts">
import { ref } from 'vue'

interface Row {
  ${Object.keys(obj)
    .map((k) => `${k}: ${typeof obj[k] === 'object' && obj[k] !== null ? (Array.isArray(obj[k]) ? 'unknown[]' : 'Record<string, unknown>') : typeof obj[k]}`)
    .join('\n  ')}
}

/** 表格数据示例 */
const rows = ref<Row[]>([])

/** 列定义 */
const columns = [
${cols}
]
<\/script>

<template>
  <el-table :data="rows" border stripe>
    <el-table-column
      v-for="c in columns"
      :key="c.prop"
      :prop="c.prop"
      :label="c.label"
    />
  </el-table>
</template>
`
}

function genPython(obj: Record<string, unknown>): string {
  const lines: string[] = [`@dataclass`, `class ${rootName.value}:`, `    """自动生成数据模型"""`]
  const map: Record<string, string> = {
    string: 'str',
    number: 'float',
    boolean: 'bool',
  }
  for (const [k, v] of Object.entries(obj)) {
    let t = 'Any'
    if (Array.isArray(v)) t = `list[${genPythonTypeTag(v[0])}]`
    else if (typeof v === 'object' && v !== null) t = 'dict[str, Any]'
    else if (v !== null) t = map[typeof v] ?? 'Any'
    lines.push(`    ${k.replace(/[^A-Za-z0-9_]/g, '_')}: ${t}`)
  }
  return 'from dataclasses import dataclass\nfrom typing import Any\n\n' + lines.join('\n')
}

function genPythonTypeTag(v: unknown): string {
  if (typeof v === 'object' && v !== null) return 'dict[str, Any]'
  const map: Record<string, string> = { string: 'str', number: 'float', boolean: 'bool' }
  return map[typeof v] ?? 'Any'
}

function genSql(obj: Record<string, unknown>): string {
  const cols: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    let t = 'TEXT'
    if (typeof v === 'number') t = Number.isInteger(v) ? 'INTEGER' : 'DOUBLE'
    else if (typeof v === 'boolean') t = 'BOOLEAN'
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) t = 'DATE'
    cols.push(`  \`${k}\` ${t}`)
  }
  return [
    `-- 自动生成的建表语句`,
    `CREATE TABLE ${rootName.value.toLowerCase()}s (`,
    `  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,`,
    cols.join(',\n'),
    `);`,
  ].join('\n')
}

function genMarkdown(obj: Record<string, unknown>): string {
  const rows = Object.entries(obj).map(
    ([k, v]) => `| \`${k}\` | ${typeof v} | ${String(JSON.stringify(v)).slice(0, 40)} |`,
  )
  return [`| 字段 | 类型 | 示例值 |`, `| --- | --- | --- |`, ...rows].join('\n')
}

function generate() {
  try {
    const obj = JSON.parse(input.value)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      ElMessage.warning('需要一个对象样例作为输入')
      return
    }
    switch (target.value) {
      case 'ts':
        output.value = genTs(obj)
        break
      case 'vue':
        output.value = genVue(obj)
        break
      case 'python':
        output.value = genPython(obj)
        break
      case 'sql':
        output.value = genSql(obj)
        break
      case 'markdown':
        output.value = genMarkdown(obj)
        break
    }
    ElMessage.success('生成完成')
  } catch (e) {
    ElMessage.error(`JSON 解析失败: ${(e as Error).message}`)
  }
}
</script>

<template>
  <ToolPage>
    <template #title>代码生成器</template>
    <template #desc>JSON 样例 → TypeScript / Vue3 / Python / SQL / Markdown,基于字段推断一键生成。</template>

    <el-row :gutter="16">
      <el-col :span="11">
        <el-card shadow="never">
          <template #header>输入样例 JSON</template>
          <el-input v-model="rootName" size="small" style="width: 140px" class="mb8" placeholder="根名">
            <template #prepend>类型名</template>
          </el-input>
          <el-input
            v-model="input"
            type="textarea"
            :rows="16"
            class="mono"
            :placeholder='{"name":"tom","age":18,"tags":["a"]}'
          />
          <div class="mt8">
            <el-button size="small" @click="() => (input = '')">清空</el-button>
            <el-button size="small" @click="fillSample">示例</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="13">
        <el-card shadow="never">
          <template #header>
            <div class="head-row">
              <el-radio-group v-model="target" size="small">
                <el-radio-button value="ts">TypeScript</el-radio-button>
                <el-radio-button value="vue">Vue3</el-radio-button>
                <el-radio-button value="python">Python</el-radio-button>
                <el-radio-button value="sql">SQL</el-radio-button>
                <el-radio-button value="markdown">Markdown</el-radio-button>
              </el-radio-group>
              <div>
                <el-button size="small" type="primary" @click="generate">生成</el-button>
                <el-button size="small" @click="copyText(output)">复制</el-button>
              </div>
            </div>
          </template>
          <div class="output-box mono" style="min-height: 320px; max-height: 460px">{{ output || '点击「生成」后这里显示结果' }}</div>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mb8 {
  margin-bottom: 8px;
}
</style>
