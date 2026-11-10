<script setup lang="ts">
/**
 * 文本行处理
 * 按固定顺序组成一条处理流水线:修剪 → 去空行 → 过滤 → 去重 → 大小写 → 排序 → 反转 → 编号 → 前后缀。
 * 所有操作实时计算,不修改原始输入,便于反复试错。
 */
import { computed, reactive } from 'vue'
import { CopyDocument, Delete, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const state = reactive({
  input: '苹果\n香蕉\nApple\n苹果\n\n  橘子  \nBanana\n',
  trim: true,
  dropEmpty: true,
  dedupe: false,
  filterOn: false,
  keyword: '',
  exclude: false,
  caseMode: 'none',
  sortMode: 'none',
  reverse: false,
  numbering: false,
  numberSep: '. ',
  prefix: '',
  suffix: '',
})

const CASES = [
  { key: 'none', label: '不转换' },
  { key: 'upper', label: '全部大写' },
  { key: 'lower', label: '全部小写' },
  { key: 'title', label: '首字母大写' },
]
const SORTS = [
  { key: 'none', label: '不排序' },
  { key: 'asc', label: '升序(自然排序)' },
  { key: 'desc', label: '降序(自然排序)' },
  { key: 'length', label: '按长度' },
]

/** 数字按数值大小比较,避免 1,10,2 这类字典序问题 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true })
}

const lines = computed(() => state.input.split(/\r?\n/))
const output = computed(() => {
  let list = [...lines.value]
  if (state.trim) list = list.map((l) => l.trim())
  if (state.dropEmpty) list = list.filter((l) => l.length > 0)
  if (state.filterOn && state.keyword) {
    const kw = state.keyword
    list = state.exclude ? list.filter((l) => !l.includes(kw)) : list.filter((l) => l.includes(kw))
  }
  if (state.dedupe) list = [...new Set(list)]
  if (state.caseMode === 'upper') list = list.map((l) => l.toUpperCase())
  else if (state.caseMode === 'lower') list = list.map((l) => l.toLowerCase())
  else if (state.caseMode === 'title') {
    list = list.map((l) => (l ? l[0].toUpperCase() + l.slice(1) : l))
  }
  if (state.sortMode === 'asc') list.sort(naturalCompare)
  else if (state.sortMode === 'desc') list.sort((a, b) => naturalCompare(b, a))
  else if (state.sortMode === 'length') list.sort((a, b) => a.length - b.length || naturalCompare(a, b))
  if (state.reverse) list.reverse()
  if (state.numbering) list = list.map((l, i) => String(i + 1) + state.numberSep + l)
  if (state.prefix || state.suffix) list = list.map((l) => state.prefix + l + state.suffix)
  return list.join('\n')
})

const resultLines = computed(() => (output.value ? output.value.split('\n').length : 0))
const stats = computed(() => ({
  raw: lines.value.length,
  result: resultLines.value,
  chars: output.value.length,
  unique: new Set(lines.value.filter((l) => l.trim())).size,
}))

function reset() {
  state.input = ''
}

function useAsInput() {
  state.input = output.value
}

async function copyResult() {
  if (!output.value) return
  await copyText(output.value)
  ElMessage.success('已复制结果')
}

function exportTxt() {
  if (!output.value) return
  downloadText(output.value, 'lines.txt', 'text/plain;charset=utf-8')
  ElMessage.success('已导出 lines.txt')
}
</script>

<template>
  <div class="tl">
    <div class="head">
      <div>
        <h3 class="title">文本行处理</h3>
        <p class="sub">去空行、去重、排序、编号、过滤与大小写,实时预览结果</p>
      </div>
      <div class="acts">
        <el-button size="small" @click="useAsInput">结果作为输入 ⇄</el-button>
        <el-button size="small" :icon="CopyDocument" @click="copyResult">复制结果</el-button>
        <el-button size="small" :icon="Download" @click="exportTxt">导出 txt</el-button>
        <el-button size="small" :icon="Delete" @click="reset">清空</el-button>
      </div>
    </div>

    <div class="panes">
      <div class="pane">
        <div class="p-head">原始文本</div>
        <el-input v-model="state.input" type="textarea" :rows="12" spellcheck="false" placeholder="每行一条内容…" />
      </div>
      <div class="pane">
        <div class="p-head">
          处理结果
          <span class="count">{{ stats.result }} 行 / {{ stats.chars }} 字符</span>
        </div>
        <pre class="out">{{ output || '—' }}</pre>
      </div>
    </div>

    <div class="opts">
      <div class="group">
        <div class="g-title">清理</div>
        <el-checkbox v-model="state.trim">去首尾空格</el-checkbox>
        <el-checkbox v-model="state.dropEmpty">去空行</el-checkbox>
        <el-checkbox v-model="state.dedupe">去重(保留首次出现)</el-checkbox>
        <el-checkbox v-model="state.reverse">反转行序</el-checkbox>
      </div>
      <div class="group">
        <div class="g-title">过滤</div>
        <div class="line">
          <el-checkbox v-model="state.filterOn">启用关键字过滤</el-checkbox>
          <el-input v-model="state.keyword" size="small" style="width: 150px" placeholder="关键字" />
        </div>
        <el-checkbox v-model="state.exclude" :disabled="!state.filterOn">排除含关键字的行</el-checkbox>
      </div>
      <div class="group">
        <div class="g-title">转换</div>
        <div class="line">
          <span class="lbl">大小写</span>
          <el-select v-model="state.caseMode" size="small" style="width: 150px">
            <el-option v-for="c in CASES" :key="c.key" :label="c.label" :value="c.key" />
          </el-select>
        </div>
        <div class="line">
          <span class="lbl">排序</span>
          <el-select v-model="state.sortMode" size="small" style="width: 150px">
            <el-option v-for="s in SORTS" :key="s.key" :label="s.label" :value="s.key" />
          </el-select>
        </div>
      </div>
      <div class="group">
        <div class="g-title">包装</div>
        <div class="line">
          <el-checkbox v-model="state.numbering">添加行号</el-checkbox>
          <el-input v-model="state.numberSep" size="small" style="width: 80px" placeholder="分隔符" />
        </div>
        <div class="line">
          <span class="lbl">前缀</span>
          <el-input v-model="state.prefix" size="small" style="width: 100px" placeholder="无" />
          <span class="lbl">后缀</span>
          <el-input v-model="state.suffix" size="small" style="width: 100px" placeholder="无" />
        </div>
      </div>
    </div>

    <p class="foot">
      处理顺序:修剪 → 去空行 → 过滤 → 去重 → 大小写 → 排序 → 反转 → 编号 → 前后缀;原始共 {{ stats.raw }} 行,其中非空不重复 {{ stats.unique }} 行。所有处理均在本机完成。
    </p>
  </div>
</template>

<style scoped>
.tl {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}
@media (max-width: 720px) {
  .panes {
    grid-template-columns: 1fr;
  }
}
.p-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.count {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.out {
  margin: 0;
  min-height: 262px;
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.opts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}
.group {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 2px;
}
.line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  line-height: 1.7;
}
</style>
