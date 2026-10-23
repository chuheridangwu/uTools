<script setup lang="ts">
/**
 * 正则测试器
 * 实时在输入文本中做全局匹配,显示高亮结果、分组视图与标志位说明,附小抄。
 */
import { computed, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const pattern = ref('^\\d{3}-\\d{4}$')
const flags = ref('gim')
const sample = ref('010-1234\n020-5678\nabc-def')
const showOutline = ref(true)

const commonList: { name: string; regex: string }[] = [
  { name: '手机号', regex: '^1[3-9]\\d{9}$' },
  { name: '邮箱', regex: '^[\\w.-]+@[\\w-]+(\\.[\\w-]+)+$' },
  { name: 'URL', regex: 'https?://[\\w.-]+(/\\S*)?' },
  { name: 'IPv4', regex: '(\\d{1,3}\\.){3}\\d{1,3}' },
  { name: '十六进制色', regex: '#[0-9a-fA-F]{6}\\b' },
  { name: '整数', regex: '-?\\d+' },
]

/** 解析 + 匹配;失败时给出简易错误信息 */
const error = computed(() => {
  if (!pattern.value) return ''
  try {
    new RegExp(pattern.value, flags.value || '')
    return ''
  } catch (e) {
    return (e as Error).message
  }
})

/** 有效标志位,过滤到 imugsy 范围 */
const validFlags = computed(() => {
  const allowed = 'dimgpsuy'
  return Array.from(new Set((flags.value || '').split('').filter((f) => allowed.includes(f)))).join('')
})

const re = computed(() => {
  if (error.value || !pattern.value) return null
  try {
    return new RegExp(pattern.value, validFlags.value || undefined)
  } catch {
    return null
  }
})

interface MatchItem {
  index: number
  length: number
  text: string
  groups: (string | undefined)[]
  named: Record<string, string>
}

/** 通过 exec 循环得到所有全局匹配(不影响原文) */
const matches = computed<MatchItem[]>(() => {
  if (!re.value) return []
  const r = new RegExp(pattern.value, (validFlags.value || '') + 'g')
  const list: MatchItem[] = []
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = r.exec(sample.value)) !== null && guard++ < 200) {
    if (m[0] === '') { r.lastIndex++; continue }
    list.push({
      index: m.index,
      length: m[0].length,
      text: m[0],
      groups: m.slice(1),
      named: m.groups ?? {},
    })
  }
  if (!list.length) return []
  return list
})

/** 高亮用片段(纯字符串分割) */
const segments = computed(() => {
  const src = sample.value
  if (!matches.value.length) return [{ text: src, matched: false }]
  const out: { text: string; matched: boolean }[] = []
  let pos = 0
  for (const mt of matches.value) {
    if (mt.index > pos) out.push({ text: src.slice(pos, mt.index), matched: false })
    out.push({ text: src.slice(mt.index, mt.index + mt.length), matched: true })
    pos = mt.index + mt.length
  }
  if (pos < src.length) out.push({ text: src.slice(pos), matched: false })
  return out
})

const count = computed(() => matches.value.length)

/** 切换一个标志位字符 */
function toggleFlag(f: string) {
  const set = new Set(flags.value.split(''))
  if (set.has(f)) set.delete(f)
  else set.add(f)
  flags.value = Array.from(set).join('')
}

function useCommon(rx: string) {
  pattern.value = rx
}

function copyPattern() {
  copyText(pattern.value)
  ElMessage.success('已复制正则')
}
</script>

<template>
  <ToolPage>
    <template #title>正则测试器</template>
    <template #desc>实时匹配,支持高亮、编号分组、常用正则速查;标志位 imugsy 自由勾选。</template>

    <el-row :gutter="16" v-if="showOutline">
      <el-col :span="12">
        <el-input v-model="pattern" class="mono">
          <template #prepend>/</template>
          <template #append>/ {{ validFlags }}</template>
        </el-input>
        <div class="flagrow">
          <span
            v-for="f in ['g', 'i', 'm', 'u', 's', 'y']"
            :key="f"
            class="fchip"
            :class="{ on: flags.includes(f) }"
            @click="toggleFlag(f)"
          >{{ f }}</span>
        </div>
        <div class="flagrow">
          <el-checkbox v-model="showOutline" size="small">两组并排布局</el-checkbox>
          <el-tag size="small" type="warning">匹配数: {{ count }}</el-tag>
          <el-button size="small" @click="copyPattern">复制正则</el-button>
        </div>
        <el-alert v-if="error" type="error" :closable="false" :title="'表达式语法错误: ' + error" class="mt8" />
      </el-col>
      <el-col :span="12">
        <el-input v-model="sample" type="textarea" :rows="4" class="mono" placeholder="粘贴原文本" />
      </el-col>
    </el-row>

    <div v-if="matches.length" class="mt12">
      <el-alert type="warning" :closable="false" title="存在匹配" />
      <div v-for="(mt, i) in matches" :key="i" class="mt6">
        <el-card shadow="never" :body-style="{ padding: '8px 12px' }">
          <div class="mono mt0">匹配 {{ i + 1 }}: <b>{{ mt.text }}</b></div>
          <div v-if="mt.groups.length" class="mono groups">
            <span v-for="(g, j) in mt.groups" :key="j">组{{ j + 1 }}:<code>{{ g ?? '(未匹配)' }}</code></span>
          </div>
          <div v-if="Object.keys(mt.named).length" class="mono groups">
            <span v-for="(v, k) in mt.named" :key="k"><code>{{ k }}: {{ v }}</code></span>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 高亮预览 -->
    <div class="mt12">
      <div class="lab">输入文本高亮</div>
      <div class="highlight mono">
        <span v-for="(s, i) in segments" :key="i" :class="s.matched ? 'hit' : ''">{{ s.text }}</span>
      </div>
    </div>

    <!-- 速查表 -->
    <div class="mt12">
      <div class="lab">常用正则</div>
      <div class="quick">
        <el-button v-for="q in commonList" :key="q.name" size="small" @click="useCommon(q.regex)">
          {{ q.name }}
        </el-button>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.mt6 { margin-top: 6px; }
.mt12 { margin-top: 12px; }
.mt8 { margin-top: 8px; }
.lab { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.flagrow { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.fchip { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--card-border); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; color: var(--el-text-color-secondary); transition: all 0.15s; }
.fchip.on { background: var(--el-color-primary); border-color: var(--el-color-primary); color: #fff; }
.groups { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; display: flex; flex-wrap: wrap; gap: 10px; }
.quick { display: flex; flex-wrap: wrap; gap: 6px; }
.highlight { padding: 10px 12px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--el-fill-color-lighter); min-height: 80px; white-space: pre-wrap; }
.hit { background: rgba(99, 102, 241, 0.2); padding: 1px 3px; border-radius: 3px; }
</style>
