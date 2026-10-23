<script setup lang="ts">
/**
 * JSON 生成器(测试数据工厂)
 * 流程:定义 N 条记录 + 每条记录 M 个字段(字段类型可选) → 生成数组 JSON。
 * 支持类型:string / uuid / 数字区间 / 布尔 / 邮箱 / 姓名 / 手机(零长度可选)等。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { v4 as uuidv4 } from 'uuid'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

/** 单个字段定义 */
interface FieldSpec {
  key: string
  type:
    | 'string'
    | 'uuid'
    | 'int'
    | 'float'
    | 'bool'
    | 'email'
    | 'name'
    | 'phone'
    | 'date'
    | 'ip'
    | 'arrayTokens'
  min: number
  max: number
  /** string 类型的候选池,逗号分隔 */
  strsText: string
}

const lastNames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴']
const firstNames = ['伟', '芳', '娜', '敏', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超']

const records = ref(20)
const fields = ref<FieldSpec[]>([
  { key: 'id', type: 'uuid', min: 0, max: 0, strsText: '' },
  { key: 'name', type: 'name', min: 0, max: 0, strsText: '' },
  { key: 'email', type: 'email', min: 0, max: 0, strsText: '' },
  { key: 'age', type: 'int', min: 18, max: 60, strsText: '' },
  { key: 'vip', type: 'bool', min: 0, max: 0, strsText: '' },
])

/** 区间随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 区间随机浮点(保留 2 位) */
function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

/** 按字段类型产出单个值 */
function makeValue(f: FieldSpec): unknown {
  switch (f.type) {
    case 'string': {
      const pool = f.strsText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      return pool.length ? pool[randInt(0, pool.length - 1)] : ''
    }
    case 'uuid':
      return uuidv4()
    case 'int':
      return randInt(f.min, Math.max(f.min, f.max))
    case 'float':
      return randFloat(f.min, Math.max(f.min, f.max))
    case 'bool':
      return Math.random() < 0.5
    case 'email':
      return `${['tom', 'amy', 'jack', 'lucy'][randInt(0, 3)]}${randInt(1, 999)}@example.com`
    case 'name':
      return `${lastNames[randInt(0, lastNames.length - 1)]}${firstNames[randInt(0, firstNames.length - 1)]}`
    case 'phone':
      return `138${String(randInt(10000000, 99999999))}`
    case 'date':
      return new Date(Date.now() - randInt(0, 3650) * 86400000).toISOString().slice(0, 10)
    case 'ip': {
      return `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`
    }
    case 'arrayTokens':
      // 生成一个 3~6 个随机短字符串的数组,用于演示嵌套结构
      return Array.from({ length: randInt(3, 6) }, () =>
        Math.random().toString(36).slice(2, 8),
      )
  }
}

/** 生成结果数组 */
const generated = computed(() => {
  const n = Math.max(1, Math.min(5000, records.value))
  const out: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {}
    for (const f of fields.value) row[f.key.trim() || `field${i}`] = makeValue(f)
    out.push(row)
  }
  return out
})

/** 格式化后的 JSON */
const pretty = computed(() => JSON.stringify(generated.value, null, 2))

function addField() {
  fields.value.push({
    key: `field${fields.value.length + 1}`,
    type: 'string',
    min: 0,
    max: 0,
    strsText: '选项A,选项B,选项C',
  })
}

function removeField(idx: number) {
  fields.value.splice(idx, 1)
}

async function copyIt() {
  await copyText(pretty.value) && ElMessage.success('已复制 JSON')
}
function downloadIt() {
  downloadText(pretty.value, 'mock-data.json', 'application/json')
}
</script>

<template>
  <ToolPage>
    <template #title>JSON 生成器</template>
    <template #desc>自定义字段模板批量生成测试 JSON 数据,可复制/下载;不超过 5000 条生成在毫秒内完成。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head-row">
          <span>字段模板</span>
          <div>
            <el-input-number v-model="records" :min="1" :max="5000" size="small" style="width: 120px" />
            <span class="muted" style="margin-left: 6px">条</span>
            <el-button size="small" type="primary" class="ml8" @click="addField">+ 加字段</el-button>
          </div>
        </div>
      </template>

      <!-- 字段行 -->
      <div class="field-rows">
        <div v-for="(f, i) in fields" :key="i" class="field-row">
          <el-input v-model="f.key" placeholder="字段名" size="small" style="width: 160px" />
          <el-select v-model="f.type" size="small" style="width: 130px">
            <el-option value="string" label="字符串(候选)" />
            <el-option value="uuid" label="UUID" />
            <el-option value="int" label="整数(区间)" />
            <el-option value="float" label="浮点(区间)" />
            <el-option value="bool" label="布尔" />
            <el-option value="email" label="邮箱" />
            <el-option value="name" label="中文姓名" />
            <el-option value="phone" label="手机号" />
            <el-option value="date" label="日期(近10年)" />
            <el-option value="ip" label="IPv4" />
            <el-option value="arrayTokens" label="字符串数组" />
          </el-select>
          <template v-if="f.type === 'int' || f.type === 'float'">
            <span class="muted">min</span>
            <el-input-number v-model="f.min" size="small" style="width: 90px" />
            <span class="muted">max</span>
            <el-input-number v-model="f.max" size="small" style="width: 90px" />
          </template>
          <template v-if="f.type === 'string'">
            <el-input
              v-model="f.strsText"
              placeholder="候选用英文逗号分隔,如 A,B,C"
              size="small"
              class="flex1"
            />
          </template>
          <el-button size="small" type="danger" text @click="removeField(i)">删除</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="mt16">
      <template #header>
        <div class="head-row">
          <span>生成结果({{ generated.length }} 条)</span>
          <div>
            <el-button size="small" type="primary" @click="copyIt">复制</el-button>
            <el-button size="small" @click="downloadIt">下载 .json</el-button>
          </div>
        </div>
      </template>
      <div class="output-box mono" style="max-height: 380px">{{ pretty }}</div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ml8 {
  margin-left: 12px;
}
.field-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.flex1 {
  flex: 1;
  min-width: 160px;
}
</style>
