<script setup lang="ts">
/**
 * UUID 生成器
 * 批量生成 UUID v4,支持大写 / 去连字符 / 加花括号,一键复制或导出为 .txt。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { v4 as uuidv4 } from 'uuid'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

const count = ref(10)
const upper = ref(false)
const noHyphen = ref(false)
const brace = ref(false)

/** 按 v4 标准生成 */
function one(): string {
  let u = uuidv4()
  if (noHyphen.value) u = u.replace(/-/g, '')
  if (upper.value) u = u.toUpperCase()
  if (brace.value) u = `{${u}}`
  return u
}

const list = ref<string[]>([])

function regenerate() {
  if (count.value < 1 || count.value > 5000) {
    ElMessage.warning('生成数量范围为 1~5000')
    return
  }
  list.value = Array.from({ length: count.value }, one)
  ElMessage.success(`已生成 ${count.value} 条`)
}

/** 首次进入自动生成一批示例 */
regenerate()

function copyAll() {
  copyText(list.value.join('\n'))
}

function exportTxt() {
  downloadText('uuid.txt', list.value.join('\n'))
}

const firstThree = computed(() => list.value.slice(0, 3))
</script>

<template>
  <ToolPage>
    <template #title>UUID 生成器</template>
    <template #desc>批量生成 UUID v4,支持大写 / 去连字符 / 花括号,一键复制或导出文件。</template>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>生成结果(共 {{ list.length }} 条)</template>
          <div class="mono list">
            <div v-for="(u, i) in list" :key="i" class="uuid-row">
              <span class="idx muted">{{ String(i + 1).padStart(3, '0') }}</span>
              {{ u }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>选项</template>
          <div class="cmd">
            <div class="rowc">生成数量 <el-input-number v-model="count" :min="1" :max="5000" size="small" style="width: 130px" /></div>
            <div class="rowc"><el-checkbox v-model="upper" size="small">大写</el-checkbox></div>
            <div class="rowc"><el-checkbox v-model="noHyphen" size="small">去连字符</el-checkbox></div>
            <div class="rowc"><el-checkbox v-model="brace" size="small">加花括号</el-checkbox></div>
            <el-button type="primary" @click="regenerate">重新生成</el-button>
            <el-button @click="copyAll">全部复制</el-button>
            <el-button @click="exportTxt">导出 TXT</el-button>
          </div>
          <div class="mt8">
            <div class="lab">示例格式</div>
            <div class="mono small" v-for="(u, i) in firstThree" :key="i">{{ u }}</div>
          </div>
        </el-card>
        <el-alert class="mt8" type="info" :closable="false">
          <template #title>UUID v4 内容</template>
          122 位随机数 + RFC 4122 规定的版本(4)、变体(10)位,几乎不会重复。
        </el-alert>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.list { max-height: 400px; overflow: auto; font-size: 12.5px; }
.uuid-row { padding: 2px 0; }
.idx { width: 36px; display: inline-block; opacity: .5; }
.cmd { display: flex; flex-direction: column; gap: 10px; }
.rowc { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.small { font-size: 12px; opacity: .7; }
</style>
