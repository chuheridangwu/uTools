<script setup lang="ts">
/**
 * Cron 解析工具
 * 功能:解析 Cron 表达式 → 中文自然语言描述(cronstrue) + 未来 N 次执行时间推演(cron-parser)。
 * 附常用模板,点击填入。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import cronstrue from 'cronstrue/i18n'
import { CronExpressionParser } from 'cron-parser'
import dayjs from 'dayjs'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const expr = ref('0 9 * * 1-5')
const previewCount = ref(5)

const templates: { label: string; value: string }[] = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 8:30', value: '30 8 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每月 1 号 0:00', value: '0 0 1 * *' },
  { label: '工作日 9-18 时整点', value: '0 9-18 * * 1-5' },
  { label: '每 15 分钟', value: '*/15 * * * *' },
  { label: '每年 1 月 1 日', value: '0 0 1 1 *' },
]

/** 统一字段说明(5 段式 Linux cron) */
const fieldsAv = computed(() => {
  const parts = expr.value.trim().split(/\s+/)
  if (parts.length !== 5) return null
  return [
    { label: '分钟', v: parts[0] },
    { label: '小时', v: parts[1] },
    { label: '日', v: parts[2] },
    { label: '月', v: parts[3] },
    { label: '星期', v: parts[4] },
  ]
})

/** 中文释义 */
const desc = computed(() => {
  try {
    // cronstrue 默认 en;指定 zh_CN
    const text = (cronstrue as unknown as { toString(s: string, o?: object): string }).toString(expr.value, { locale: 'zh_CN' })
    return text
  } catch (e) {
    return `解析失败: ${(e as Error).message}`
  }
})

/** 下次执行时间列表 */
const nextTimes = computed<string[]>(() => {
  if (!fieldsAv.value) return []
  try {
    const it = CronExpressionParser.parse(expr.value, { currentDate: new Date() })
    const list: string[] = []
    for (let i = 0; i < previewCount.value; i++) {
      list.push(dayjs(it.next().toDate()).format('YYYY-MM-DD HH:mm:ss'))
    }
    return list
  } catch {
    return []
  }
})

const valid = computed(() => fieldsAv.value !== null && nextTimes.value.length > 0)

function useTemplate(t: string) {
  expr.value = t
}

function copyDesc() {
  copyText(desc.value)
  ElMessage.success('已复制')
}
</script>

<template>
  <ToolPage>
    <template #title>Cron 解析</template>
    <template #desc>解析 Cron 表达式,给出中文人类可读描述与未来执行时间;内置常用模板一键填入。</template>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>表达式</template>
          <el-input v-model="expr" placeholder="* * * * *" class="mono">
            <template #prepend>Linux Cron (5 段)</template>
          </el-input>

          <div class="mt8 fields" v-if="fieldsAv">
            <table>
              <thead>
                <tr><th v-for="f in fieldsAv" :key="f.label">{{ f.label }}</th></tr>
              </thead>
              <tbody>
                <tr><td class="mono" v-for="f in fieldsAv" :key="f.label">{{ f.v }}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="mt12">
            <div class="lab">常用模板:</div>
            <div class="tpls">
              <el-button v-for="t in templates" :key="t.value" size="small" class="mono" @click="useTemplate(t.value)">
                {{ t.label }}
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>解析结果</span>
              <el-button size="small" @click="copyDesc">复制描述</el-button>
            </div>
          </template>

          <div class="lab">中文释义</div>
          <div :class="valid ? 'desc' : 'desc bad'">{{ desc }}</div>

          <div class="lab" style="margin-top: 16px">未来执行时间</div>
          <div class="times">
            <div class="time">
              预览次数:
              <el-input-number v-model="previewCount" :min="1" :max="20" size="small" style="width: 110px" />
            </div>
            <div v-for="(t, i) in nextTimes" :key="i" class="mono time-v">
              <span class="idx">#{{ i + 1 }}</span>
              {{ t }}
            </div>
            <div v-if="fieldsAv && nextTimes.length === 0" class="muted small">表达式解析失败或无法推演</div>
          </div>

          <el-alert class="mt12" type="info" :closable="false">
            <template #title>Cron 格式说明</template>
            分(0-59) 小时(0-23) 日(1-31) 月(1-12) 星期(0-6, 0 为周日)<br />
            支持通配符 * 、或口 、分隔 、 */n 每隔、 -n 范围。
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.lab { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.desc { font-size: 15px; font-weight: 600; color: var(--el-color-primary); line-height: 1.7; }
.desc.bad { color: var(--el-color-danger); }
.tpls { display: flex; flex-wrap: wrap; gap: 6px; }
.times { display: flex; flex-direction: column; gap: 6px; }
.time-v { display: flex; align-items: center; gap: 8px; }
.idx { color: var(--el-text-color-secondary); width: 26px; }
.small { font-size: 12px; }
.fields table { border-collapse: collapse; font-size: 12px; }
.fields th { background: var(--el-fill-color-light); padding: 4px 12px; border: 1px solid var(--card-border); }
.fields td { padding: 4px 12px; border: 1px solid var(--card-border); text-align: center; }
</style>
