<script setup lang="ts">
/**
 * IMEI 校验与生成
 * 校验 15 位 IMEI 的校验位(卢恩算法),按 TAC 前缀批量生成
 * 合法测试用 IMEI,并可一键复制,全部本地计算。
 */
import { computed, reactive, ref } from 'vue'
import { Cellphone, CopyDocument, Refresh, Select } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const input = ref('')
const gen = reactive({ tac: '86123456', count: 5 })
const list = ref<string[]>([])

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/** 卢恩:对 15 位整体求和,能被 10 整除即合法 */
function luhnSum(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum
}

function checkDigitFor14(first14: string): string {
  // 补 0 后按卢恩算,使 15 位总和 %10==0
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let d = Number(first14[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

const result = computed(() => {
  const raw = digitsOnly(input.value)
  if (!raw) return { state: 'empty' as const, raw }
  if (raw.length !== 15) return { state: 'len' as const, raw }
  const ok = luhnSum(raw) % 10 === 0
  return { state: ok ? ('ok' as const) : ('bad' as const), raw }
})

const resultText = computed(() => {
  switch (result.value.state) {
    case 'empty': return '等待输入 15 位 IMEI'
    case 'len': return `当前 ${result.value.raw.length} 位,需要 15 位`
    case 'ok': return '校验通过 ✓ 这是一个格式合法的 IMEI'
    default: return '校验失败 ✗ 校验位不匹配(可能是输入错误)'
  }
})

function makeOne(tac: string): string {
  const serial = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const first14 = tac + serial
  return first14 + checkDigitFor14(first14)
}

function generate() {
  const tac = digitsOnly(gen.tac).padStart(8, '0').slice(0, 8)
  if (!tac) {
    ElMessage.warning('TAC 前缀需 8 位数字')
    return
  }
  gen.tac = tac
  const n = Math.min(50, Math.max(1, gen.count))
  gen.count = n
  list.value = Array.from({ length: n }, () => makeOne(tac))
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function copyAll() {
  if (!list.value.length) return
  try {
    await navigator.clipboard.writeText(list.value.join('\n'))
    ElMessage.success(`已复制 ${list.value.length} 条`)
  } catch {
    ElMessage.error('复制失败')
  }
}

function useFromInput() {
  const raw = digitsOnly(input.value)
  if (raw.length === 15) generate()
}
</script>

<template>
  <div class="imei">
    <div class="head">
      <div>
        <h3 class="title">IMEI 校验与生成</h3>
        <p class="sub">15 位手机 IMEI 的校验位计算与批量生成,全部本地完成</p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title"><el-icon><Select /></el-icon>校验 IMEI</div>
        <el-input
          v-model="input"
          maxlength="20"
          placeholder="输入 15 位 IMEI,如 861234567890123"
          clearable
        />
        <div class="res" :class="result.state">{{ resultText }}</div>
        <div class="hint">回车或点「用此前缀生成」可把前 8 位当 TAC 批量生成合法 IMEI。</div>
        <div class="ops">
          <el-button size="small" :icon="Refresh" @click="input = ''">清空</el-button>
          <el-button size="small" type="primary" :icon="Cellphone" :disabled="result.raw.length < 8" @click="useFromInput">用此前缀生成</el-button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><el-icon><Cellphone /></el-icon>批量生成</div>
        <div class="row">
          <span class="lbl">TAC(前 8 位)</span>
          <el-input v-model="gen.tac" maxlength="8" style="width: 140px" />
          <span class="lbl">数量</span>
          <el-input-number v-model="gen.count" :min="1" :max="50" size="small" />
        </div>
        <div class="ops">
          <el-button size="small" type="primary" @click="generate">生成</el-button>
          <el-button size="small" :icon="CopyDocument" :disabled="!list.length" @click="copyAll">复制全部</el-button>
        </div>
        <div v-if="list.length" class="list">
          <div v-for="(it, i) in list" :key="it + i" class="li" @click="copy(it)">
            <span class="idx">{{ i + 1 }}</span>
            <span class="num">{{ it }}</span>
            <el-icon class="cp"><CopyDocument /></el-icon>
          </div>
        </div>
        <div v-else class="empty">尚未生成,填写 TAC 后点击「生成」</div>
      </div>
    </div>

    <p class="foot">说明:IMEI 结构为 TAC(8 位机型代码)+ 序列号(6 位)+ 校验位(1 位,卢恩算法)。生成的号码仅用于测试 / 开发填充数据,请勿用于伪造设备标识。</p>
  </div>
</template>

<style scoped>
.imei {
  padding: 4px 2px;
}
.head {
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
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}
@media (max-width: 780px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.res {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.res.ok {
  color: #16a34a;
}
.res.bad {
  color: #ef4444;
}
.res.len,
.res.empty {
  color: var(--el-text-color-secondary);
}
.hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ops {
  display: flex;
  gap: 8px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow: auto;
}
.li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
}
.li:hover {
  background: var(--el-fill-color-light);
}
.idx {
  width: 22px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  text-align: right;
  flex: none;
}
.num {
  flex: 1;
  letter-spacing: 0.5px;
}
.cp {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
