<script setup lang="ts">
/**
 * 算术题生成器
 * 按四则运算、数值范围与题量生成口算练习题,可隐藏/显示答案、
 * 复制为文本或打印,适合家长出题与课堂练习。
 */
import { reactive, ref } from 'vue'
import { DocumentCopy, Finished, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type Op = '+' | '-' | '×' | '÷'

interface Q {
  id: number
  a: number
  b: number
  op: Op
  ans: number
  text: string
}

const cfg = reactive({
  ops: ['+', '-'] as Op[],
  min: 1,
  max: 100,
  count: 20,
  hideAns: true,
  column: 2,
})

const list = ref<Q[]>([])
let uid = 1

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function makeOne(): Q {
  const opPool = cfg.ops.length ? cfg.ops : (['+'] as Op[])
  const op = opPool[Math.floor(Math.random() * opPool.length)]
  let a = randInt(cfg.min, cfg.max)
  let b = randInt(cfg.min, cfg.max)
  let ans = 0
  if (op === '+') {
    ans = a + b
  } else if (op === '-') {
    if (a < b) [a, b] = [b, a] // 避免负数
    ans = a - b
  } else if (op === '×') {
    // 乘法控制在两位数以内,避免题目过长
    a = randInt(2, Math.min(19, Math.max(2, cfg.max)))
    b = randInt(2, Math.min(19, Math.max(2, cfg.max)))
    ans = a * b
  } else {
    // 整除:先定答案与除数
    b = randInt(2, Math.max(2, Math.min(19, cfg.max)))
    ans = randInt(2, Math.max(2, Math.min(19, cfg.max)))
    a = b * ans
  }
  return { id: uid++, a, b, op, ans, text: `${a} ${op} ${b} =` }
}

function generate() {
  if (!cfg.ops.length) {
    ElMessage.warning('至少选择一种运算')
    return
  }
  const n = Math.min(100, Math.max(1, cfg.count))
  cfg.count = n
  list.value = Array.from({ length: n }, () => makeOne())
}

function asText(withAns: boolean): string {
  return list.value
    .map((q, i) => `${String(i + 1).padStart(2, '0')}. ${q.text}${withAns ? ' ' + q.ans : ''}`)
    .join('\n')
}

async function copy(withAns: boolean) {
  if (!list.value.length) {
    ElMessage.info('先生成一批题目')
    return
  }
  try {
    await navigator.clipboard.writeText(asText(withAns))
    ElMessage.success(withAns ? '已复制(含答案)' : '已复制(不含答案)')
  } catch {
    ElMessage.error('复制失败')
  }
}

function printPaper() {
  if (!list.value.length) return
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) {
    ElMessage.warning('弹窗被拦截,请允许后重试')
    return
  }
  const body = list.value
    .map((q, i) => `<div class="q"><b>${String(i + 1).padStart(2, '0')}.</b> ${q.text} ${cfg.hideAns ? '______' : '<em>' + q.ans + '</em>'}</div>`)
    .join('')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>口算练习</title>
<style>
body{font-family:system-ui,sans-serif;padding:32px;}
h2{text-align:center;}
.grid{display:grid;grid-template-columns:repeat(${cfg.column},1fr);gap:14px 28px;font-size:18px;}
.q{display:flex;gap:8px;border-bottom:1px dashed #ccc;padding:6px 0;}
em{color:#16a34a;font-style:normal;font-weight:700;}
@media print{.q{border-bottom:none;}}
</style></head><body>
<h2>口算练习</h2>
<div class="grid">${body}</div>
</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

generate()
</script>

<template>
  <div class="ar">
    <div class="head">
      <div>
        <h3 class="title">算术题生成器</h3>
        <p class="sub">四则运算口算题按需生成,可切换答案并打印练习纸</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="Refresh" @click="generate">生成题目</el-button>
        <el-button size="small" :icon="DocumentCopy" @click="copy(false)">复制题目</el-button>
        <el-button size="small" :icon="DocumentCopy" @click="copy(true)">复制含答案</el-button>
        <el-button size="small" :icon="Finished" @click="printPaper">打印</el-button>
      </div>
    </div>

    <div class="cfg">
      <span class="lbl">运算</span>
      <el-checkbox-group v-model="cfg.ops" size="small">
        <el-checkbox-button value="+">加</el-checkbox-button>
        <el-checkbox-button value="-">减</el-checkbox-button>
        <el-checkbox-button value="×">乘</el-checkbox-button>
        <el-checkbox-button value="÷">除</el-checkbox-button>
      </el-checkbox-group>
      <span class="lbl">数值</span>
      <el-input-number v-model="cfg.min" :min="0" :max="999" size="small" controls-position="right" />
      <span class="dash">~</span>
      <el-input-number v-model="cfg.max" :min="1" :max="999" size="small" controls-position="right" />
      <span class="lbl">题量</span>
      <el-input-number v-model="cfg.count" :min="1" :max="100" size="small" />
      <span class="lbl">分栏</span>
      <el-radio-group v-model="cfg.column" size="small">
        <el-radio-button :value="1">1 栏</el-radio-button>
        <el-radio-button :value="2">2 栏</el-radio-button>
        <el-radio-button :value="3">3 栏</el-radio-button>
      </el-radio-group>
      <el-switch v-model="cfg.hideAns" size="small" active-text="隐藏答案" inactive-text="显示答案" />
    </div>

    <div v-if="list.length" class="paper" :style="{ gridTemplateColumns: 'repeat(' + cfg.column + ', 1fr)' }">
      <div v-for="(q, i) in list" :key="q.id" class="q">
        <span class="no">{{ String(i + 1).padStart(2, '0') }}.</span>
        <span class="expr">{{ q.text }}</span>
        <span v-if="!cfg.hideAns" class="ans">{{ q.ans }}</span>
        <span v-else class="blank" />
      </div>
    </div>
    <div v-else class="empty">暂无题目,点击「生成题目」开始</div>

    <p class="foot">说明:减法自动保证被减数不小于减数,除法的被除数由「除数 × 商」构造保证整除;乘法与除法的因数上限按 19 收敛,适合低年级口算。</p>
  </div>
</template>

<style scoped>
.ar {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
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
  gap: 8px;
  flex-wrap: wrap;
}
.cfg {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 14px;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.dash {
  color: var(--el-text-color-placeholder);
}
.paper {
  display: grid;
  gap: 6px 24px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px 20px;
}
.q {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  padding: 5px 0;
  border-bottom: 1px dashed var(--card-border);
}
.no {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.expr {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
.ans {
  color: #16a34a;
  font-weight: 700;
}
.blank {
  flex: 1;
  min-width: 40px;
  border-bottom: 1px solid var(--el-border-color);
  height: 1em;
}
.empty {
  padding: 40px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  border: 1px dashed var(--card-border);
  border-radius: 12px;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
