<script setup lang="ts">
/**
 * ASCII 码表(仿找Tab「ASCII 码表」)
 * 0~255 全表:十进制 / 十六进制 / 八进制 / 二进制 / HTML 实体 / 控制字符说明,
 * 支持分组与搜索,点击行复制字符,可导出 TSV。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText, downloadText } from '@/utils/common'

const CONTROL = [
  'NUL 空字符', 'SOH 标题开始', 'STX 正文开始', 'ETX 正文结束', 'EOT 传输结束',
  'ENQ 请求', 'ACK 确认', 'BEL 响铃', 'BS 退格', 'HT 水平制表',
  'LF 换行', 'VT 垂直制表', 'FF 换页', 'CR 回车', 'SO 移出',
  'SI 移入', 'DLE 数据链路转义', 'DC1 设备控制 1', 'DC2 设备控制 2', 'DC3 设备控制 3',
  'DC4 设备控制 4', 'NAK 否认', 'SYN 同步空闲', 'ETB 传输块结束', 'CAN 取消',
  'EM 介质结束', 'SUB 替换', 'ESC 转义', 'FS 文件分隔', 'GS 组分隔',
  'RS 记录分隔', 'US 单元分隔',
]

interface Row { code: number; glyph: string; name: string; group: string }

const ALL: Row[] = Array.from({ length: 256 }, (_, code) => {
  let glyph: string
  let name: string
  let group: string
  if (code < 32) {
    glyph = CONTROL[code].split(' ')[0]
    name = CONTROL[code]
    group = 'control'
  } else if (code === 32) {
    glyph = 'SP'
    name = 'SPACE 空格'
    group = 'printable'
  } else if (code === 127) {
    glyph = 'DEL'
    name = 'DEL 删除'
    group = 'control'
  } else if (code < 127) {
    glyph = String.fromCharCode(code)
    name = '可打印字符'
    group = 'printable'
  } else {
    glyph = String.fromCharCode(code)
    name = 'Latin-1 扩展字符'
    group = 'extended'
  }
  return { code, glyph, name, group }
})

const group = ref<'all' | 'control' | 'printable' | 'extended'>('printable')
const query = ref('')
const groups = [
  { key: 'printable', label: '可打印 32~126' },
  { key: 'control', label: '控制字符 0~31 / 127' },
  { key: 'extended', label: '扩展 128~255' },
  { key: 'all', label: '全部 256' },
] as const

const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0')
const oct = (n: number) => n.toString(8).padStart(3, '0')
const bin = (n: number) => n.toString(2).padStart(8, '0')

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return ALL.filter((r) => {
    if (group.value !== 'all' && r.group !== group.value) return false
    if (!q) return true
    const hay = `${r.code} ${hex(r.code)} ${oct(r.code)} ${bin(r.code)} ${r.glyph} ${r.name} &#${r.code}; 0x${hex(r.code)}`.toLowerCase()
    return hay.includes(q)
  })
})

async function copyChar(r: Row) {
  const ch = r.code >= 32 && r.code !== 127 ? String.fromCharCode(r.code) : r.glyph
  await copyText(ch)
  ElMessage.success(`已复制 ${r.glyph}`)
}

function exportTsv() {
  const lines = ['十进制\t字符\t十六进制\t八进制\t二进制\tHTML 实体\t说明']
  rows.value.forEach((r) => {
    lines.push([r.code, r.glyph, '0x' + hex(r.code), oct(r.code), bin(r.code), `&#${r.code};`, r.name].join('\t'))
  })
  downloadText(lines.join('\n'), 'ascii-table.tsv', 'text/tab-separated-values;charset=utf-8')
  ElMessage.success('已导出 TSV')
}
</script>

<template>
  <div class="at">
    <div class="head">
      <div>
        <h3 class="title">ASCII 码表</h3>
        <p class="sub">0~255 全表,支持按字符 / 数字 / 十六进制 / 名称搜索,点击行复制字符</p>
      </div>
      <div class="acts">
        <el-input v-model="query" class="q" clearable placeholder="搜索 A / 65 / 0x41 / NUL" />
        <el-button size="small" @click="exportTsv">导出 TSV</el-button>
      </div>
    </div>

    <div class="chips">
      <button
        v-for="g in groups" :key="g.key" class="chip"
        :class="{ on: group === g.key }" @click="group = g.key"
      >{{ g.label }}</button>
      <span class="count">共 {{ rows.length }} 条</span>
    </div>

    <div class="table">
      <div class="tr th">
        <span>字符</span><span>十进制</span><span>十六进制</span><span>八进制</span><span>二进制</span><span>HTML 实体</span><span>说明</span>
      </div>
      <div v-for="r in rows" :key="r.code" class="tr" @click="copyChar(r)">
        <span class="glyph">{{ r.glyph }}</span>
        <span>{{ r.code }}</span>
        <span>0x{{ hex(r.code) }}</span>
        <span>{{ oct(r.code) }}</span>
        <span class="mono">{{ bin(r.code) }}</span>
        <span class="mono">&amp;#{{ r.code }};</span>
        <span class="name">{{ r.name }}</span>
      </div>
      <div v-if="!rows.length" class="empty">没有匹配的结果</div>
    </div>
    <p class="foot">控制字符不可直接复制,点击会复制其缩写;128~255 为 Latin-1 扩展区,显示效果取决于字体。</p>
  </div>
</template>

<style scoped>
.at { padding: 4px 2px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.title { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.acts { display: flex; gap: 8px; align-items: center; }
.q { width: 230px; }
.chips { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.chip {
  border: 1px solid var(--el-border-color); background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular); border-radius: 15px; padding: 5px 12px;
  font-size: 12px; cursor: pointer;
}
.chip.on { background: var(--el-color-primary); border-color: var(--el-color-primary); color: #fff; }
.count { font-size: 11px; color: var(--el-text-color-secondary); margin-left: auto; }
.table { border: 1px solid var(--el-border-color-lighter); border-radius: 10px; overflow: hidden; max-height: 460px; overflow-y: auto; }
.tr {
  display: grid; grid-template-columns: 70px 70px 90px 80px 120px 100px minmax(120px, 1fr);
  gap: 8px; align-items: center; padding: 7px 12px; font-size: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter); cursor: pointer;
}
.tr:last-child { border-bottom: none; }
.tr:not(.th):hover { background: var(--el-fill-color-light); }
.tr.th { position: sticky; top: 0; z-index: 1; background: var(--el-fill-color-light); font-weight: 700; cursor: default; }
.glyph { font-size: 15px; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.name { color: var(--el-text-color-secondary); }
.empty { padding: 28px; text-align: center; color: var(--el-text-color-secondary); font-size: 12px; }
.foot { font-size: 11px; color: var(--el-text-color-secondary); margin: 10px 0 0; }
@media (max-width: 760px) { .tr { grid-template-columns: 50px 60px 70px 1fr; } .tr > :nth-child(4), .tr > :nth-child(5), .tr > :nth-child(6) { display: none; } }
</style>
