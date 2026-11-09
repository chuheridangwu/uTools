<script setup lang="ts">
/**
 * 阴影 / 圆角生成器
 * 调节 box-shadow 的偏移、模糊、扩散、颜色与内阴影,并设置圆角,
 * 实时预览并输出 CSS。
 */
import { computed, reactive } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const s = reactive({
  x: 0,
  y: 8,
  blur: 24,
  spread: 0,
  color: '#00000040',
  inset: false,
  radius: 16,
  layers: 1,
})

const shadow = computed(() => {
  const base = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`
  if (s.layers >= 2) {
    const second = `${Math.round(s.x * 0.5)}px ${Math.round(s.y * 2)}px ${s.blur * 2}px ${s.spread}px ${s.color}`
    return `${s.inset ? 'inset ' : ''}${base}, ${second}`
  }
  return `${s.inset ? 'inset ' : ''}${base}`
})

const css = computed(() => `box-shadow: ${shadow.value};\nborder-radius: ${s.radius}px;`)

const PRESETS = [
  { name: '柔和', x: 0, y: 8, blur: 24, spread: 0, color: '#00000040', radius: 16, layers: 1, inset: false },
  { name: '悬浮', x: 0, y: 16, blur: 40, spread: -8, color: '#0f172a66', radius: 20, layers: 2, inset: false },
  { name: '锐利', x: 4, y: 4, blur: 0, spread: 0, color: '#111827', radius: 4, layers: 1, inset: false },
  { name: '卡片', x: 0, y: 2, blur: 8, spread: 0, color: '#0000001a', radius: 12, layers: 2, inset: false },
  { name: '内凹', x: 0, y: 4, blur: 10, spread: 0, color: '#00000040', radius: 12, layers: 1, inset: true },
  { name: '霓虹', x: 0, y: 0, blur: 24, spread: 4, color: '#6366f1', radius: 14, layers: 1, inset: false },
]

function applyPreset(p: (typeof PRESETS)[number]) {
  s.x = p.x; s.y = p.y; s.blur = p.blur; s.spread = p.spread; s.color = p.color; s.radius = p.radius; s.layers = p.layers; s.inset = p.inset
}

async function copyCss() {
  await copyText(css.value)
  ElMessage.success('已复制 CSS')
}
</script>

<template>
  <div class="sh">
    <div class="head">
      <div>
        <h3 class="title">阴影 / 圆角生成器</h3>
        <p class="sub">调节参数实时预览,复制即可使用</p>
      </div>
      <el-button size="small" type="primary" :icon="CopyDocument" @click="copyCss">复制 CSS</el-button>
    </div>

    <div class="cols">
      <div class="stage">
        <div class="box" :style="{ boxShadow: shadow, borderRadius: s.radius + 'px' }">
          <span>PREVIEW</span>
        </div>
      </div>

      <div class="controls">
        <div class="row"><span class="label">水平偏移</span><el-slider v-model="s.x" :min="-50" :max="50" /><span class="val">{{ s.x }}px</span></div>
        <div class="row"><span class="label">垂直偏移</span><el-slider v-model="s.y" :min="-50" :max="50" /><span class="val">{{ s.y }}px</span></div>
        <div class="row"><span class="label">模糊半径</span><el-slider v-model="s.blur" :min="0" :max="100" /><span class="val">{{ s.blur }}px</span></div>
        <div class="row"><span class="label">扩散半径</span><el-slider v-model="s.spread" :min="-30" :max="40" /><span class="val">{{ s.spread }}px</span></div>
        <div class="row"><span class="label">圆角</span><el-slider v-model="s.radius" :min="0" :max="80" /><span class="val">{{ s.radius }}px</span></div>
        <div class="row">
          <span class="label">阴影颜色</span>
          <el-color-picker v-model="s.color" show-alpha size="small" />
          <el-checkbox v-model="s.inset" class="inset">内阴影</el-checkbox>
          <el-checkbox :model-value="s.layers >= 2" @change="s.layers = $event ? 2 : 1">双层</el-checkbox>
        </div>

        <div class="presets">
          <span class="label">预设</span>
          <el-button v-for="p in PRESETS" :key="p.name" size="small" @click="applyPreset(p)">{{ p.name }}</el-button>
        </div>

        <pre class="code">{{ css }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sh {
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
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 820px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.stage {
  display: grid;
  place-items: center;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--el-fill-color-light);
  min-height: 300px;
}
.box {
  width: 180px;
  height: 180px;
  display: grid;
  place-items: center;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  letter-spacing: 2px;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row :deep(.el-slider) {
  flex: 1;
}
.label {
  width: 66px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.val {
  width: 46px;
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.inset {
  margin-left: 8px;
}
.presets {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.code {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0b1020;
  color: #d1e3ff;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
