<script setup lang="ts">
/**
 * SQL 格式化工具
 * 基于 sql-formatter 库,支持多方言选择、压缩(平铺)输出与大小写统一。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { format, type SqlLanguage } from 'sql-formatter'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const input = ref('select id,name,age from users where age>18 order by age desc;')
const dialect = ref<SqlLanguage>('postgresql')
const indentWidth = ref(2)
const upperKeywords = ref(true)

/** 方言列表(sql-formatter 原生支持的常用方言;oracle 默认已支持) */
const DIALECTS: { value: SqlLanguage; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'tsql', label: 'TSQL (SQL Server)' },
  { value: 'db2', label: 'DB2' },
  { value: 'plsql', label: 'PL/SQL' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'mariadb', label: 'MariaDB' },
]

/** 美化后结果 */
const formatted = computed(() => {
  if (!input.value.trim()) return ''
  try {
    return format(input.value, {
      language: dialect.value,
      tabWidth: indentWidth.value,
      keywordCase: upperKeywords.value ? 'upper' : 'preserve',
      useTabs: false,
    })
  } catch (e) {
    return `格式化失败: ${(e as Error).message}`
  }
})

/** 压缩:去多余空白 + 分号开头 */
function compress() {
  if (!input.value.trim()) return
  input.value = input.value.replace(/\s+/g, ' ').replace(/\s*;\s*$/, ';').trim()
}

function download() {
  const blob = new Blob([formatted.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'formatted.sql'
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已下载')
}
</script>

<template>
  <ToolPage>
    <template #title>SQL 格式化</template>
    <template #desc>对 SQL 语句做缩进排版与关键字大小写标准化,支持 MySQL/PostgreSQL/SQLite/TSQL 等。</template>

    <template #extra>
      <el-select v-model="dialect" size="small" style="width: 130px">
        <el-option v-for="d in DIALECTS" :key="d.value" :value="d.value" :label="d.label" />
      </el-select>
    </template>

    <el-row :gutter="16">
      <el-col :span="11">
        <el-input
          v-model="input"
          type="textarea"
          :rows="16"
          class="mono"
          placeholder="select * from users where age > 18"
        />
        <div class="btns">
          <el-checkbox v-model="upperKeywords" size="small">关键字大写</el-checkbox>
          <div class="indent-ctl">
            缩进:
            <el-radio-group v-model="indentWidth" size="small">
              <el-radio-button :value="2">2</el-radio-button>
              <el-radio-button :value="4">4</el-radio-button>
              <el-radio-button :value="8">8</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </el-col>

      <el-col :span="13">
        <el-card shadow="never" :body-style="{ padding: 0 }">
          <template #header>
            <div class="head">
              <span>格式化结果</span>
              <div>
                <el-button size="small" type="primary" @click="copyText(formatted)">复制</el-button>
                <el-button size="small" @click="download">下载</el-button>
              </div>
            </div>
          </template>
          <div class="mono" style="padding: 12px 16px; min-height: 320px; max-height: 460px; overflow: auto; white-space: pre">{{ formatted || '输出区...' }}</div>
        </el-card>
        <div class="btns">
          <el-button size="small" @click="compress">压缩为单行</el-button>
        </div>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.btns { margin-top: 8px; display: flex; gap: 16px; align-items: center; }
.indent-ctl { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
</style>
