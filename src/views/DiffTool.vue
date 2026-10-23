<script setup lang="ts">
/**
 * 文本对比
 * 用 diff 库 diffLines 得到 [{{ Change: { added, removed, value } }}],输出合并视图。
 * 支持并排视图(基于合并结果拆出左右列,忽略性对齐)。
 */
import { computed, ref } from 'vue'
import { diffLines, type Change } from 'diff'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const textA = ref('第一行\n第二行\n第三行')
const textB = ref('第一行\n第二行修改\n第三行\n新增第四行')
const viewMode = ref<'side' | 'unified'>('unified')
const showContextOnly = ref(false)

/** diff 结果块 */
const changes = computed<Change[]>(() => diffLines(textA.value, textB.value))

/** 是否存在差异 */
const hasDiff = computed(() => changes.value.some((c) => c.added || c.removed))

/** 统计:相同/新增/删除行数 */
const stats = computed(() => {
  let same = 0
  let added = 0
  let removed = 0
  for (const c of changes.value) {
    const n = c.count ?? 0
    if (c.added) added += n
    else if (c.removed) removed += n
    else same += n
  }
  return { same, added, removed }
})

interface Row {
  left?: string
  right?: string
  status: 'same' | 'added' | 'removed' | 'changed'
  numL?: number
  numR?: number
}

/** 合并视图:直接线性展示 Change 序列 */
const unifiedRows = computed(() => {
  const rows: { type: 'added' | 'removed' | 'same'; text: string }[] = []
  for (const c of changes.value) {
    c.value
      .replace(/\n$/, '')
      .split('\n')
      .forEach((t) => rows.push({ type: c.added ? 'added' : c.removed ? 'removed' : 'same', text: t }))
  }
  return rows
})

/** 把 change 序列折叠成长度可对齐的行序列 */
function buildAligned(changes: Change[]): Row[] {
  const out: Row[] = []
  let numL = 0
  let numR = 0
  for (const c of changes) {
    const lines = c.value.replace(/\n$/, '').split('\n')
    if (c.added) for (const t of lines) out.push({ right: t, status: 'added', numR: ++numR })
    else if (c.removed) for (const t of lines) out.push({ left: t, status: 'removed', numL: ++numL })
    else {
      for (const t of lines) out.push({ left: t, right: t, status: 'same', numL: ++numL, numR: ++numR })
    }
  }
  return out
}

/** 并排视图行:找到成对的 removed/added 段合并为 changed 行 */
const sideRows = computed<Row[]>(() => {
  const out: Row[] = []
  let numL = 0
  let numR = 0
  let i = 0
  while (i < changes.value.length) {
    const c = changes.value[i]
    if (c.added) {
      // 新增块:作为纯 added 行
      c.value.replace(/\n$/, '').split('\n').forEach((t) => {
        out.push({ right: t, status: 'added', numR: ++numR })
      })
      i++
    } else if (c.removed) {
      const rlines = c.value.replace(/\n$/, '').split('\n')
      i++
      const next = changes.value[i] && changes.value[i].added ? changes.value[i] : null
      const nlines = next?.value.replace(/\n$/, '').split('\n') ?? []
      const pairs = Math.min(rlines.length, nlines.length)
      for (let j = 0; j < pairs; j++) out.push({ left: rlines[j], right: nlines[j], status: 'changed', numL: ++numL, numR: ++numR })
      for (let j = pairs; j < rlines.length; j++) out.push({ left: rlines[j], status: 'removed', numL: ++numL })
      for (let j = pairs; j < nlines.length; j++) out.push({ right: nlines[j], status: 'added', numR: ++numR })
      if (next) i++
    } else {
      c.value.replace(/\n$/, '').split('\n').forEach((t) => {
        out.push({ left: t, right: t, status: 'same', numL: ++numL, numR: ++numR })
      })
      i++
    }
  }
  return out
})

/** 过滤掉无变化行 */
const sideRowsFiltered = computed(() =>
  showContextOnly.value ? sideRows.value.filter((r) => r.status !== 'same') : sideRows.value,
)
const unifiedRowsFiltered = computed(() =>
  showContextOnly.value ? unifiedRows.value.filter((r) => r.type !== 'same') : unifiedRows.value,
)

function clearAll() {
  textA.value = ''
  textB.value = ''
}
</script>

<template>
  <ToolPage>
    <template #title>文本对比</template>
    <template #desc>逐行 diff,支持并排与合并视图,可选只看差异行。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="unified">合并视图</el-radio-button>
            <el-radio-button value="side">并排视图</el-radio-button>
          </el-radio-group>
          <div class="ops">
            <el-checkbox v-model="showContextOnly" size="small">只显示差异</el-checkbox>
            <el-button size="small" @click="clearAll">清空</el-button>
            <el-button size="small" @click="copyText(textB)">复制右侧内容</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12" class="mb12">
        <el-col :span="12">
          <div class="pane-label muted">文本 A(原)</div>
          <el-input v-model="textA" type="textarea" :rows="5" class="mono" />
        </el-col>
        <el-col :span="12">
          <div class="pane-label muted">文本 B(新)</div>
          <el-input v-model="textB" type="textarea" :rows="5" class="mono" />
        </el-col>
      </el-row>

      <div v-if="hasDiff" class="result">
        <!-- 合并视图 -->
        <div v-if="viewMode === 'unified'" class="diff mono">
          <div
            v-for="(r, i) in unifiedRowsFiltered"
            :key="i"
            class="dline"
            :class="r.type"
          >
            <span class="sign">{{ r.type === 'added' ? '+' : r.type === 'removed' ? '-' : ' ' }}</span>
            {{ r.text }}
          </div>
        </div>

        <!-- 并排视图 -->
        <div v-else class="diff mono">
          <div class="dhead">
            <span>编号</span><span>文本 A</span><span>编号</span><span>文本 B</span>
          </div>
          <div v-for="(r, i) in sideRowsFiltered" :key="i" class="sline" :class="r.status">
            <span class="num muted">{{ r.numL ?? '' }}</span>
            <span class="cell">{{ r.left ?? '' }}</span>
            <span class="num muted">{{ r.numR ?? '' }}</span>
            <span class="cell">{{ r.right ?? '' }}</span>
          </div>
        </div>
      </div>
      <el-alert v-else class="mt8" type="success" :closable="false" show-icon title="两段文本完全一致" />

      <div class="statbar mt12">
        <el-tag size="small" type="success">相同: {{ stats.same }}</el-tag>
        <el-tag size="small" type="danger">删除: {{ stats.removed }}</el-tag>
        <el-tag size="small" type="warning">新增: {{ stats.added }}</el-tag>
      </div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ops {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pane-label {
  font-size: 12px;
  margin-bottom: 4px;
}
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }
.mt8 { margin-top: 8px; }

.diff {
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 10px 0;
  font-size: 12.5px;
  max-height: 380px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
}
.dline {
  padding: 0 12px;
  white-space: pre-wrap;
}
.dline.added { color: var(--el-color-success); background: rgba(16, 185, 129, 0.08); }
.dline.removed { color: var(--el-color-danger); background: rgba(239, 68, 68, 0.08); text-decoration: line-through; text-decoration-color: rgba(239,68,68,.4); }
.sign { display: inline-block; width: 14px; }

.dhead { display: grid; grid-template-columns: 44px 1fr 44px 1fr; color: var(--el-text-color-secondary); font-size: 11px; padding: 0 6px 6px; }
.dhead span { padding: 0 6px; }
.sline { display: grid; grid-template-columns: 44px 1fr 44px 1fr; }
.sline > span { padding: 0 6px; }
.num { text-align: right; user-select: none; opacity: .6; }
.cell { white-space: pre-wrap; word-break: break-all; }
.sline.added .cell:last-child { background: rgba(16, 185, 129, 0.08); }
.sline.removed .cell:first-of-type { background: rgba(239, 68, 68, 0.08); }
.sline.changed > .cell { background: rgba(245, 158, 11, 0.10); }
</style>
