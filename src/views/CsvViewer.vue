<script setup lang="ts">
/**
 * CSV 查看器
 * 使用 papaparse 在本地解析 CSV(支持自定义分隔符与首行标题),分页表格预览,并可导出 JSON。
 */
import type { UploadFile } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Papa from 'papaparse'
import ToolPage from '@/components/ToolPage.vue'
import { downloadText } from '@/utils/common'

const file = ref<File | null>(null)
const rawText = ref('')
const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const hasHeader = ref(true)
const delimiter = ref<'auto' | ',' | ';' | '\t' | '|'>('auto')
const page = ref(1)
const pageSize = ref(10)

const fileName = computed(() => file.value?.name ?? '')
const totalRows = computed(() => rows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize.value)))

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

function parse(text: string) {
  try {
    const res = Papa.parse<string[]>(text, {
      skipEmptyLines: 'greedy',
      delimiter: delimiter.value === 'auto' ? undefined : delimiter.value,
    })
    const data = res.data as string[][]
    if (!data.length) {
      headers.value = []
      rows.value = []
      return
    }
    if (hasHeader.value) {
      headers.value = data[0]
      rows.value = data.slice(1)
    } else {
      headers.value = data[0].map((_, i) => `列${i + 1}`)
      rows.value = data
    }
    // 用首行宽度统一所有行的列数,多余的列往后合并会丢失,这里截断并提示
    const width = Math.max(...data.map((r) => r.length))
    headers.value = Array.from({ length: width }, (_, i) => headers.value[i] ?? `列${i + 1}`)
    rows.value = rows.value.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
    page.value = 1
  } catch (e) {
    ElMessage.error(`解析失败: ${(e as Error).message}`)
  }
}

function onFile(f: File) {
  file.value = f
  const r = new FileReader()
  r.onload = () => {
    rawText.value = String(r.result)
    parse(rawText.value)
  }
  r.readAsText(f, 'utf-8')
}

function reparse() {
  if (rawText.value) parse(rawText.value)
}

function exportJson() {
  if (!rows.value.length) return
  const arr = rows.value.map((r) => Object.fromEntries(headers.value.map((h, i) => [h, r[i]])))
  downloadText(`${fileName.value || 'data'}.json`.replace(/\.csv\.json$/, '.json'), JSON.stringify(arr, null, 2))
}

function copyCsv() {
  navigator.clipboard.writeText(rawText.value)
  ElMessage.success('原始 CSV 已复制')
}

watch(pageSize, () => (page.value = 1))

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>CSV 查看器</template>
    <template #desc>本地解析 CSV 为表格,支持自动/手动分隔符与首行标题,分页预览并可导出 JSON。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>上传 CSV(file.read 一次解析)</span>
          <span>
            <el-checkbox v-model="hasHeader" size="small" @change="reparse">首行为表头</el-checkbox>
            <el-select v-model="delimiter" size="small" style="width: 110px" @change="reparse">
              <el-option value="auto" label="自动检测" />
              <el-option value="," label="逗号 ," />
              <el-option value=";" label="分号 ;" />
              <el-option value="|" label="竖线 |" />
              <el-option :value="'\t'" label="制表符 \t" />
            </el-select>
          </span>
        </div>
      </template>
      <el-upload drag :auto-upload="false" :show-file-list="false" accept=".csv,.tsv,.txt" :on-change="onUploadChange">
        <div class="drop">拖入 .csv 文件或点击选择</div>
      </el-upload>
    </el-card>

    <el-card v-if="rows.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>{{ fileName }} · {{ totalRows }} 行 × {{ headers.length }} 列</span>
          <span>
            <el-button size="small" @click="copyCsv">复制原始</el-button>
            <el-button size="small" type="primary" @click="exportJson">导出 JSON</el-button>
          </span>
        </div>
      </template>
      <el-table :data="paged" size="small" border>
        <el-table-column v-for="(h, i) in headers" :key="i" :prop="String(i)" :label="h" min-width="140">
          <template #default="{ row }">{{ row[i] }}</template>
        </el-table-column>
      </el-table>
      <div class="pg">
        <el-pagination
          v-model:current-page="page"
          :total="totalRows"
          :page-size="pageSize"
          layout="prev, pager, next, sizes, jumper"
          :page-sizes="[10, 20, 50, 100]"
        />
      </div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.drop { padding: 24px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.pg { margin-top: 12px; display: flex; justify-content: center; }
</style>
