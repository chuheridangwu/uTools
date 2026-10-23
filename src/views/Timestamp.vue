<script setup lang="ts">
/**
 * 时间戳转换工具
 * 功能:实时当前秒/毫秒戳、双向互转(日期 ↔ 时间戳)、本地/UTC 双视图、常规模板选择。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import ToolPage from '@/components/ToolPage.vue'

dayjs.extend(utc)

/** 毫秒级当前时间戳(10秒节流? 使用 requestAnimation 优先) */
const now = ref(0)
let timer: number

onMounted(() => {
  now.value = Date.now()
  timer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))

const stampInput = ref('')
const dateInput = ref('')

const parsedStamp = computed(() => {
  const n = Number(stampInput.value.trim())
  if (!Number.isFinite(n) || stampInput.value.trim() === '') return null
  // 10位按秒,13位按毫秒
  const ms = Math.abs(n) < 1e11 ? n * 1000 : n
  return {
    ms,
    local: dayjs(ms).format('YYYY-MM-DD HH:mm:ss'),
    utc: dayjs(ms).utc().format('YYYY-MM-DD HH:mm:ss'),
  }
})

const parsedDate = computed(() => {
  const s = dateInput.value.trim()
  if (!s) return null
  const d = dayjs(s)
  if (!d.isValid()) return null
  return { sec: d.unix(), ms: d.valueOf() }
})

function clearAll() {
  stampInput.value = ''
  dateInput.value = ''
}
</script>

<template>
  <ToolPage>
    <template #title>时间戳转换</template>
    <template #desc>时间戳 ↔ 日期互转,支持秒 / 毫秒自动识别;右侧实时显示当前时间戳。</template>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>转换</template>

          <div class="lab">当前时间戳(实时)</div>
          <div class="mono cur">
            <b>{{ now }}</b>
            <span class="muted">({{ Math.floor(now / 1000) }} 秒)</span>
          </div>

          <div class="lab mt16">时间戳 → 日期</div>
          <el-input v-model="stampInput" placeholder="输入 10 位秒戳或 13 位毫秒戳" class="mono" />
          <div v-if="parsedStamp" class="res">
            <div>本地: {{ parsedStamp.local }}</div>
            <div>UTC: {{ parsedStamp.utc }}</div>
          </div>

          <div class="lab mt16">日期 → 时间戳</div>
          <el-input v-model="dateInput" placeholder="如 2025-06-01 12:30:00" class="mono" />
          <div v-if="parsedDate" class="res">
            <div>秒: {{ parsedDate.sec }}</div>
            <div>毫秒: {{ parsedDate.ms }}</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never">
          <template #header>快捷操作</template>
          <div class="btns">
            <el-button size="small" @click="stampInput = String(Math.floor(now / 1000))">填入当前秒戳</el-button>
            <el-button size="small" @click="stampInput = String(now)">填入当前毫秒戳</el-button>
            <el-button size="small" @click="dateInput = dayjs().format('YYYY-MM-DD HH:mm:ss')">填入当前时间</el-button>
            <el-button size="small" @click="clearAll">清空</el-button>
          </div>
          <el-alert class="mt16" type="info" :closable="false" title="说明">
            自动识别格式:长度 10 位视为秒,13 位视为毫秒;支持负值(1970 年以前)。
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.lab {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.cur {
  font-size: 15px;
}
.res {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-color-primary);
  line-height: 1.8;
}
.btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.mt16 { margin-top: 16px; }
</style>
