<script setup lang="ts">
/**
 * JSON 查看器
 * 功能:格式化(2/4 空格)、压缩、校验(错误行列定位)、树形浏览、统计、复制/下载。
 * 实时解析输入,树视图递归由 JsonTreeNode 组件完成。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import JsonTreeNode from '@/components/JsonTreeNode.vue'
import { copyText, downloadText } from '@/utils/common'

const input = ref('')
const indent = ref(2)
const viewMode = ref<'tree' | 'text'>('tree')
const parsed = ref<unknown>(null)
const parseError = ref<{ msg: string; line?: number; col?: number } | null>(null)

/** 解析 JSON 字符串;出错时尝试从 message 中提取行列 */
function doParse(): void {
  const s = input.value.trim()
  if (!s) {
    parsed.value = null
    parseError.value = null
    return
  }
  try {
    parsed.value = JSON.parse(s)
    parseError.value = null
  } catch (e) {
    parsed.value = null
    const msg = (e as { message?: string })?.message ?? String(e)
    // V8 错误形如 "Unexpected token } in JSON at position 123",可换算行列
    const m = msg.match(/position (\d+)/)
    let line: number | undefined
    let col: number | undefined
    if (m) {
      const pos = Number(m[1])
      const before = s.slice(0, pos)
      line = before.split('\n').length
      const nlPos = before.lastIndexOf('\n')
      col = pos - nlPos
    }
    parseError.value = { msg, line, col }
  }
}

/** 输入变动即重新解析 */
function onInput(): void {
  doParse()
}

/** 格式化输出(按所选缩进) */
const pretty = computed(() =>
  parsed.value !== null ? JSON.stringify(parsed.value, null, indent.value) : '',
)

/** 压缩输出 */
const compact = computed(() => (parsed.value !== null ? JSON.stringify(parsed.value) : ''))

/** 统计信息 */
const stats = computed(() => {
  if (parsed.value === null) return null
  let objects = 0
  let arrays = 0
  let keys = 0
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      arrays++
      v.forEach(walk)
    } else if (typeof v === 'object' && v !== null) {
      objects++
      for (const k of Object.keys(v as Record<string, unknown>)) {
        keys++
        walk((v as Record<string, unknown>)[k])
      }
    }
  }
  walk(parsed.value)
  return { objects, arrays, keys }
})

async function copy(text: string) {
  if (await copyText(text)) ElMessage.success('已复制')
  else ElMessage.error('复制失败')
}

function downloadPretty() {
  if (parsed.value === null) return ElMessage.warning('先输入合法 JSON')
  downloadText(pretty.value, 'formatted.json', 'application/json')
}

function useSample() {
  input.value = JSON.stringify(
    {
      app: 'uTools',
      version: '1.0.0',
      features: ['json', 'image', 'text'],
      config: { theme: 'auto', locale: 'zh-CN', debug: false },
      userCount: 1024,
    },
    null,
    2,
  )
  onInput()
}
</script>

<template>
  <ToolPage>
    <template #title>JSON 查看器</template>
    <template #desc>格式化 / 压缩 / 校验错误定位 / 树形浏览 / 结构统计,支持 2 或 4 空格缩进</template>

    <el-row :gutter="16">
      <!-- 输入区 -->
      <el-col :span="12">
        <el-card shadow="never" class="pane">
          <template #header>
            <div class="pane-head">
              <span>输入 JSON</span>
              <div class="ops">
                <el-button size="small" text type="primary" @click="useSample">示例</el-button>
                <el-button size="small" text @click="input = ''">清空</el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="input"
            class="editor-area"
            type="textarea"
            :rows="18"
            placeholder='在此粘贴 JSON,例如 {"a":1} ...'
            @input="doParse"
          />
          <el-alert
            v-if="parseError"
            type="error"
            :closable="false"
            class="mt8"
            show-icon
            title="JSON 解析失败"
          >
            <span class="mono">{{ parseError.msg }}</span>
            <span v-if="parseError.line"> (第 {{ parseError.line }} 行,第 {{ parseError.col }} 列附近)</span>
          </el-alert>
        </el-card>
      </el-col>

      <!-- 输出区 -->
      <el-col :span="12">
        <el-card shadow="never" class="pane">
          <template #header>
            <div class="pane-head">
              <el-radio-group v-model="viewMode" size="small">
                <el-radio-button value="tree">树形</el-radio-button>
                <el-radio-button value="text">文本</el-radio-button>
              </el-radio-group>
              <div class="ops">
                <el-select v-model="indent" size="small" style="width: 90px">
                  <el-option :value="2" label="2 空格" />
                  <el-option :value="4" label="4 空格" />
                </el-select>
                <el-button size="small" type="primary" @click="copy(pretty)">复制格式化</el-button>
                <el-button size="small" @click="downloadPretty">下载 .json</el-button>
              </div>
            </div>
          </template>

          <!-- 树形视图 -->
          <div v-if="viewMode === 'tree'" class="tree-scroll">
            <JsonTreeNode v-if="parsed != null" name="root" :value="parsed" :depth="0" />
            <div v-else class="placeholder muted">等待输入合法 JSON…</div>
          </div>

          <!-- 文本视图 -->
          <div v-else class="tree-scroll">
            <div class="output-box mono">{{ pretty || '等待输入…' }}</div>
            <div class="mt8">
              <el-button size="small" type="primary" plain @click="copy(compact)">复制压缩后的 JSON</el-button>
            </div>
          </div>

          <!-- 统计 -->
          <div v-if="stats" class="stat-row">
            <el-tag size="small" type="info">对象: {{ stats.objects }}</el-tag>
            <el-tag size="small" type="info">数组: {{ stats.arrays }}</el-tag>
            <el-tag size="small" type="info">键: {{ stats.keys }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.pane {
  --el-card-header-padding: 10px 14px;
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
}
.ops {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tree-scroll {
  min-height: 300px;
  max-height: 420px;
  overflow: auto;
}
.placeholder {
  padding: 30px 0;
  text-align: center;
}
.stat-row {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
