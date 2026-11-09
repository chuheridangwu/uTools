<script setup lang="ts">
/**
 * 密码强度检测
 * 估算密码的字符空间与信息熵,给出强度评分与预计破解时间,
 * 并检查常见弱口令与重复模式,所有计算均在本机完成。
 */
import { computed, ref } from 'vue'
import { Hide, View, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const pwd = ref('')
const show = ref(true)

/** 常见弱口令(节选) */
const WEAK = [
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111',
  '1234567', 'dragon', '123123', 'abc123', '1234567890', 'iloveyou', '000000', 'admin',
  'qwerty123', '1q2w3e', 'letmein', 'welcome', 'monkey', 'sunshine', 'master', 'football',
  '666666', '888888', 'qq123456', 'a123456', 'woaini', 'p@ssw0rd', 'admin888', 'root',
]

const CHARSETS = [
  { re: /[a-z]/, size: 26, label: '小写字母' },
  { re: /[A-Z]/, size: 26, label: '大写字母' },
  { re: /[0-9]/, size: 10, label: '数字' },
  { re: /[^A-Za-z0-9]/, size: 33, label: '符号' },
]

const poolSize = computed(() => {
  let n = 0
  for (const cs of CHARSETS) if (cs.re.test(pwd.value)) n += cs.size
  return n
})

const usedClasses = computed(() => CHARSETS.filter((c) => c.re.test(pwd.value)).map((c) => c.label))

/** 信息熵:bits = len * log2(pool) */
const entropy = computed(() => {
  if (!pwd.value) return 0
  return pwd.value.length * Math.log2(poolSize.value || 1)
})

interface Level {
  key: string
  text: string
  color: string
  pct: number
}

const level = computed<Level>(() => {
  const e = entropy.value
  if (!pwd.value) return { key: 'none', text: '—', color: '#94a3b8', pct: 0 }
  if (WEAK.includes(pwd.value.toLowerCase())) return { key: 'weak', text: '极弱(常见弱口令)', color: '#ef4444', pct: 10 }
  if (e < 28) return { key: 'weak', text: '弱', color: '#ef4444', pct: 25 }
  if (e < 40) return { key: 'fair', text: '一般', color: '#f59e0b', pct: 50 }
  if (e < 60) return { key: 'good', text: '较强', color: '#0ea5e9', pct: 75 }
  return { key: 'strong', text: '强', color: '#16a34a', pct: 100 }
})

/** 破解时间估算:假设每秒 1e10 次猜测 */
const crackTime = computed(() => {
  if (!pwd.value) return '—'
  const keyspace = Math.pow(poolSize.value || 1, pwd.value.length)
  const sec = keyspace / 2 / 1e10
  return humanTime(sec)
})

function humanTime(sec: number): string {
  if (sec < 1) return '瞬间'
  if (sec < 60) return sec.toFixed(0) + ' 秒'
  const min = sec / 60
  if (min < 60) return min.toFixed(0) + ' 分钟'
  const hour = min / 60
  if (hour < 24) return hour.toFixed(0) + ' 小时'
  const day = hour / 24
  if (day < 365) return day.toFixed(0) + ' 天'
  const year = day / 365
  if (year < 1000) return year.toFixed(0) + ' 年'
  if (year < 1e6) return (year / 1e3).toFixed(0) + ' 千年'
  if (year < 1e9) return (year / 1e6).toFixed(0) + ' 百万年'
  if (year < 1e12) return (year / 1e9).toFixed(0) + ' 十亿年'
  return '宇宙年龄级(> 万亿年)'
}

/** 问题检测 */
const issues = computed(() => {
  const list: string[] = []
  const p = pwd.value
  if (!p) return list
  if (p.length < 8) list.push('长度不足 8 位')
  else if (p.length < 12) list.push('建议长度至少 12 位')
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p)) list.push('大小写字母混合更安全')
  if (!/[0-9]/.test(p)) list.push('加入数字提升字符空间')
  if (!/[^A-Za-z0-9]/.test(p)) list.push('加入符号可显著增强')
  if (/(.)\1{2,}/.test(p)) list.push('存在连续重复字符(如 aaa)')
  if (/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|qwe|asd|zxc)/i.test(p)) list.push('包含键盘或数字连续序列')
  if (/(19|20)\d{2}/.test(p)) list.push('避免使用年份等可猜测信息')
  if (WEAK.includes(p.toLowerCase())) list.push('属于常见弱口令')
  return list
})

function random(len = 16) {
  const lowers = 'abcdefghijkmnpqrstuvwxyz'
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const nums = '23456789'
  const syms = '!@#$%^&*-_=+?'
  const all = lowers + uppers + nums + syms
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  // 保证每类至少一个
  const arr = [pick(lowers), pick(uppers), pick(nums), pick(syms)]
  while (arr.length < len) arr.push(pick(all))
  // 打乱
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  pwd.value = arr.join('')
  show.value = true
}

async function copy() {
  if (!pwd.value) return
  await copyText(pwd.value)
  ElMessage.success('已复制密码')
}
</script>

<template>
  <div class="ps">
    <div class="head">
      <div>
        <h3 class="title">密码强度检测</h3>
        <p class="sub">估算信息熵与破解时间,检测弱口令与常见模式,数据仅在本机计算</p>
      </div>
      <el-button size="small" @click="random()">随机生成</el-button>
    </div>

    <el-input
      v-model="pwd"
      size="large"
      :type="show ? 'text' : 'password'"
      placeholder="输入要检测的密码…"
      class="inp"
    >
      <template #suffix>
        <el-icon class="eye" @click="show = !show">
          <component :is="show ? Hide : View" />
        </el-icon>
      </template>
    </el-input>

    <div class="bar">
      <div class="bar-fill" :style="{ width: level.pct + '%', background: level.color }" />
    </div>
    <div class="bar-meta">
      <span class="level" :style="{ color: level.color }">{{ level.text }}</span>
      <span class="entropy">约 {{ entropy.toFixed(1) }} bit</span>
    </div>

    <div class="stats">
      <div class="st"><div class="st-l">字符长度</div><div class="st-v">{{ pwd.length }}</div></div>
      <div class="st"><div class="st-l">字符种类</div><div class="st-v">{{ usedClasses.length }}</div></div>
      <div class="st"><div class="st-l">字符空间</div><div class="st-v">{{ poolSize }}</div></div>
      <div class="st"><div class="st-l">预计破解</div><div class="st-v">{{ crackTime }}</div></div>
    </div>

    <div v-if="usedClasses.length" class="classes">
      <span v-for="c in usedClasses" :key="c" class="cls">{{ c }}</span>
    </div>

    <div v-if="issues.length" class="issues">
      <div class="iss-title">改进建议</div>
      <ul>
        <li v-for="(i, idx) in issues" :key="idx">{{ i }}</li>
      </ul>
    </div>
    <div v-else-if="pwd" class="good-tip">未发现明显问题,继续保持 👍</div>

    <div class="acts">
      <el-button :icon="CopyDocument" :disabled="!pwd" @click="copy">复制密码</el-button>
    </div>

    <p class="foot">破解时间按每秒 10¹⁰ 次离线猜测估算,仅作相对比较;请勿在此输入真实的敏感密码。</p>
  </div>
</template>

<style scoped>
.ps {
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
.inp :deep(input) {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 17px;
  letter-spacing: 1px;
}
.eye {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.bar {
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  overflow: hidden;
  margin-top: 16px;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s, background 0.3s;
}
.bar-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
}
.level {
  font-weight: 600;
}
.entropy {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 16px;
}
@media (max-width: 640px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
.st {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: center;
}
.st-l {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.st-v {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.classes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.cls {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, #16a34a 14%, transparent);
  color: #16a34a;
}
.issues {
  margin-top: 16px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 16px;
}
.iss-title {
  font-size: 13px;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 8px;
}
.issues ul {
  margin: 0;
  padding-left: 18px;
}
.issues li {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.9;
}
.good-tip {
  margin-top: 16px;
  font-size: 13px;
  color: #16a34a;
}
.acts {
  margin-top: 16px;
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
