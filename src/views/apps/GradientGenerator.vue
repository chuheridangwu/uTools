<script setup lang="ts">
/**
 * CSS 渐变生成器
 * 线性 / 径向渐变可视化编辑,支持多色标、角度与位置调节,
 * 实时输出可直接使用的 CSS 代码。
 */
import { computed, ref } from 'vue'
import { CopyDocument, MagicStick, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

interface Stop {
  color: string
  pos: number
}

const type = ref<'linear' | 'radial'>('linear')
const angle = ref(135)
const shape = ref('circle')
const stops = ref<Stop[]>([
  { color: '#6366f1', pos: 0 },
  { color: '#ec4899', pos: 100 },
])

const css = computed(() => {
  const list = [...stops.value].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ')
  return type.value === 'linear'
    ? `linear-gradient(${angle.value}deg, ${list})`
    : `radial-gradient(${shape.value} at center, ${list})`
})

function addStop() {
  if (stops.value.length >= 6) {
    ElMessage.info('最多 6 个色标')
    return
  }
  stops.value.push({ color: '#14b8a6', pos: 50 })
}

function removeStop(i: number) {
  if (stops.value.length <= 2) {
    ElMessage.info('至少保留 2 个色标')
    return
  }
  stops.value.splice(i, 1)
}

function randomGradient() {
  const rand = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
  stops.value = [
    { color: rand(), pos: 0 },
    { color: rand(), pos: 50 },
    { color: rand(), pos: 100 },
  ]
  angle.value = Math.floor(Math.random() * 360)
}

const PRESETS = [
  ['#0f172a', '#1e3a8a', '#312e81'],
  ['#fda085', '#f6d365'],
  ['#a8edea', '#fed6e3'],
  ['#22d3ee', '#3b82f6'],
  ['#f43f5e', '#8b5cf6'],
  ['#022c22', '#065f46', '#0a4d3a'],
]

function applyPreset(p: string[]) {
  stops.value = p.map((c, i) => ({ color: c, pos: Math.round((i / (p.length - 1)) * 100) }))
}

async function copyCss() {
  await copyText(`background: ${css.value};`)
  ElMessage.success('已复制 CSS')
}
</script>

<template>
  <div class="grad">
    <div class="head">
      <div>
        <h3 class="title">CSS 渐变生成器</h3>
        <p class="sub">可视化调节色标与角度,实时生成 CSS 代码</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="MagicStick" @click="randomGradient">随机</el-button>
        <el-button size="small" type="primary" :icon="CopyDocument" @click="copyCss">复制 CSS</el-button>
      </div>
    </div>

    <div class="preview" :style="{ background: css }" />

    <div class="controls">
      <div class="row">
        <el-radio-group v-model="type" size="small">
          <el-radio-button value="linear">线性</el-radio-button>
          <el-radio-button value="radial">径向</el-radio-button>
        </el-radio-group>
        <template v-if="type === 'linear'">
          <span class="label">角度</span>
          <el-slider v-model="angle" :min="0" :max="360" style="width: 180px" />
          <span class="val">{{ angle }}°</span>
        </template>
        <template v-else>
          <span class="label">形状</span>
          <el-radio-group v-model="shape" size="small">
            <el-radio-button value="circle">圆形</el-radio-button>
            <el-radio-button value="ellipse">椭圆</el-radio-button>
          </el-radio-group>
        </template>
      </div>

      <div class="stops">
        <div v-for="(s, i) in stops" :key="i" class="stop">
          <el-color-picker v-model="s.color" size="small" />
          <span class="stop-pos">{{ s.pos }}%</span>
          <el-slider v-model="s.pos" :min="0" :max="100" :show-tooltip="false" style="flex: 1" />
          <el-button text size="small" @click="removeStop(i)">×</el-button>
        </div>
        <el-button size="small" :icon="Plus" @click="addStop">添加色标</el-button>
      </div>

      <div class="presets">
        <span class="label">预设</span>
        <button
          v-for="(p, i) in PRESETS"
          :key="i"
          class="preset"
          :style="{ background: `linear-gradient(90deg, ${p.join(', ')})` }"
          @click="applyPreset(p)"
        />
      </div>

      <pre class="code">background: {{ css }};</pre>
    </div>
  </div>
</template>

<style scoped>
.grad {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
.preview {
  height: 180px;
  border-radius: 14px;
  margin-bottom: 16px;
  box-shadow: inset 0 0 0 1px var(--card-border);
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.val {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  width: 44px;
}
.stops {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
}
.stop {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stop-pos {
  font-size: 12px;
  width: 40px;
  color: var(--el-text-color-secondary);
}
.presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preset {
  width: 54px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  cursor: pointer;
}
.code {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0b1020;
  color: #d1e3ff;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
