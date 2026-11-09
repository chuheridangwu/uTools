<script setup lang="ts">
/**
 * 身份证解析
 * 校验 18 位身份证号(GB 11643-1999 校验位),并解析出生日期、性别、
 * 年龄、所在地区与校验码,数据仅在本机计算,不上传。
 */
import { computed, ref } from 'vue'
import { CircleCheck, CircleClose, CopyDocument, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const input = ref('')

const WEIGHT = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

/** 省级行政区代码(前两位) */
const PROVINCES: Record<string, string> = {
  '11': '北京市', '12': '天津市', '13': '河北省', '14': '山西省', '15': '内蒙古自治区',
  '21': '辽宁省', '22': '吉林省', '23': '黑龙江省',
  '31': '上海市', '32': '江苏省', '33': '浙江省', '34': '安徽省', '35': '福建省', '36': '江西省', '37': '山东省',
  '41': '河南省', '42': '湖北省', '43': '湖南省', '44': '广东省', '45': '广西壮族自治区', '46': '海南省',
  '50': '重庆市', '51': '四川省', '52': '贵州省', '53': '云南省', '54': '西藏自治区',
  '61': '陕西省', '62': '甘肃省', '63': '青海省', '64': '宁夏回族自治区', '65': '新疆维吾尔自治区',
  '71': '台湾省', '81': '香港特别行政区', '82': '澳门特别行政区',
  '91': '国外',
}

interface Result {
  valid: boolean
  error?: string
  birth?: string
  gender?: string
  age?: number
  region?: string
  checkCode?: string
  seq?: string
  constellation?: string
  zodiac?: string
}

function calcAge(y: number, m: number, d: number): number {
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age
}

function constellation(m: number, d: number): string {
  const cutoffs: [number, number, string][] = [
    [1, 20, '水瓶座'], [2, 19, '双鱼座'], [3, 21, '白羊座'], [4, 20, '金牛座'],
    [5, 21, '双子座'], [6, 22, '巨蟹座'], [7, 23, '狮子座'], [8, 23, '处女座'],
    [9, 23, '天秤座'], [10, 24, '天蝎座'], [11, 23, '射手座'], [12, 22, '摩羯座'],
  ]
  if (d >= cutoffs[m - 1][1]) return cutoffs[m - 1][2]
  return m === 1 ? '摩羯座' : cutoffs[m - 2][2]
}

function zodiacYear(y: number): string {
  const animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
  return animals[(y - 4) % 12]
}

const result = computed<Result>(() => {
  const id = input.value.trim().toUpperCase()
  if (id === '') return { valid: false }
  if (!/^\d{17}[\dX]$/.test(id)) return { valid: false, error: '格式不正确:应为 18 位,前 17 位数字,最后一位数字或 X' }

  // 校验位
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * WEIGHT[i]
  const expect = CHECK[sum % 11]
  const checkCode = id[17]
  if (expect !== checkCode) return { valid: false, error: `校验位错误:最后一位应为 ${expect}` }

  // 出生日期
  const y = Number(id.slice(6, 10))
  const m = Number(id.slice(10, 12))
  const d = Number(id.slice(12, 14))
  if (m < 1 || m > 12 || d < 1 || d > 31) return { valid: false, error: '出生日期不合法' }

  const seq = id.slice(14, 17)
  const gender = Number(seq) % 2 === 1 ? '男' : '女'
  const region = PROVINCES[id.slice(0, 2)] || '未知地区(前两位: ' + id.slice(0, 2) + ')'

  return {
    valid: true,
    birth: `${y} 年 ${m} 月 ${d} 日`,
    gender,
    age: calcAge(y, m, d),
    region,
    checkCode,
    seq,
    constellation: constellation(m, d),
    zodiac: zodiacYear(y) + '年',
  }
})

const FIELDS = computed(() => {
  const r = result.value
  if (!r.valid) return []
  return [
    { l: '出生日期', v: r.birth },
    { l: '性别', v: r.gender },
    { l: '年龄', v: r.age + ' 岁' },
    { l: '所在地区', v: r.region },
    { l: '星座', v: r.constellation },
    { l: '生肖', v: r.zodiac },
    { l: '顺序码', v: r.seq },
    { l: '校验码', v: r.checkCode },
  ]
})

async function copyResult() {
  if (!result.value.valid) return
  const txt = FIELDS.value.map((f) => `${f.l}: ${f.v}`).join('\n')
  await copyText(txt)
  ElMessage.success('已复制解析结果')
}

function genCheck() {
  // 生成本机测试用的合法样例(行政区 110101 + 19900101 + 001)
  const body = '11010119900101001'
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(body[i]) * WEIGHT[i]
  input.value = body + CHECK[sum % 11]
}
</script>

<template>
  <div class="idc">
    <div class="head">
      <div>
        <h3 class="title">身份证解析</h3>
        <p class="sub">校验 18 位身份证号并解析出生日期、性别、地区等信息</p>
      </div>
      <div class="acts">
        <el-button size="small" @click="genCheck">示例号码</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="input = ''">清空</el-button>
      </div>
    </div>

    <el-input v-model="input" size="large" placeholder="输入 18 位身份证号,如 11010119900101001X" clearable maxlength="18" class="inp" />

    <div v-if="input && !result.valid && result.error" class="err">
      <el-icon><CircleClose /></el-icon>
      {{ result.error }}
    </div>

    <div v-else-if="result.valid" class="ok">
      <div class="ok-banner">
        <el-icon :size="22"><CircleCheck /></el-icon>
        <span>号码校验通过</span>
        <el-button size="small" text :icon="CopyDocument" @click="copyResult">复制结果</el-button>
      </div>
      <div class="grid">
        <div v-for="f in FIELDS" :key="f.l" class="card">
          <div class="c-l">{{ f.l }}</div>
          <div class="c-v">{{ f.v }}</div>
        </div>
      </div>
    </div>

    <div v-else class="empty">请输入身份证号,数据仅在本机计算,不会上传</div>

    <p class="foot">校验依据 GB 11643-1999 的校验位算法;地区仅根据前两位省级代码判断,不代表实际户籍。</p>
  </div>
</template>

<style scoped>
.idc {
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
  gap: 8px;
}
.inp :deep(input) {
  font-size: 18px;
  letter-spacing: 2px;
  font-family: ui-monospace, Menlo, monospace;
}
.err {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ef4444;
  font-size: 13px;
}
.ok {
  margin-top: 18px;
}
.ok-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: #16a34a;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}
.ok-banner .el-button {
  margin-left: auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
}
.c-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.c-v {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 600;
}
.empty {
  text-align: center;
  padding: 50px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
.foot {
  margin-top: 18px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
