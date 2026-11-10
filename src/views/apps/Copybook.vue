<script setup lang="ts">
/**
 * 字帖生成器
 * 输入汉字或字母,按「每字一行」生成描红字帖(田字格 / 米字格 / 空白格),
 * 可调格子大小、描红深浅与打印留白,导出高清 PNG 便于打印练习。
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { Download, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const canvasRef = ref<HTMLCanvasElement>()

type GridStyle = 'tian' | 'mi' | 'plain'

const SAMPLE = '永和九年岁在癸丑'

const f = reactive({
  text: SAMPLE,
  grid: 'mi' as GridStyle,
  cell: 96,
  perRow: 8,
  trace: 0.16,      // 描红透明度
  everyCell: false, // 每格都描红;否则仅每行首格
  margin: 24,
})

/** 每个字符占一行;字符集去空白与换行 */
const lines = () => Array.from(f.text.replace(/\s+/g, ''))

function drawGridCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, style: GridStyle) {
  ctx.save()
  ctx.strokeStyle = '#c0392b'
  ctx.globalAlpha = 0.35
  ctx.lineWidth = Math.max(1, size / 60)
  // 外框
  ctx.strokeRect(x, y, size, size)
  if (style === 'tian' || style === 'mi') {
    ctx.beginPath()
    ctx.moveTo(x + size / 2, y)
    ctx.lineTo(x + size / 2, y + size)
    ctx.moveTo(x, y + size / 2)
    ctx.lineTo(x + size, y + size / 2)
    ctx.stroke()
  }
  if (style === 'mi') {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + size, y + size)
    ctx.moveTo(x + size, y)
    ctx.lineTo(x, y + size)
    ctx.stroke()
  }
  ctx.restore()
}

function layout() {
  const chars = lines()
  const rows = Math.max(1, chars.length)
  const cols = Math.max(1, f.perRow)
  const cell = f.cell
  const m = f.margin
  return { chars, rows, cols, cell, m, w: m * 2 + cols * cell, h: m * 2 + rows * cell }
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const { chars, rows, cols, cell, m } = layout()
  canvas.width = m * 2 + cols * cell
  canvas.height = m * 2 + rows * cell
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(cell * 0.8)}px "Kaiti SC", "STKaiti", "KaiTi", serif`

  for (let r = 0; r < rows; r++) {
    const ch = chars[r] ?? ''
    for (let c = 0; c < cols; c++) {
      const x = m + c * cell
      const y = m + r * cell
      drawGridCell(ctx, x, y, cell, f.grid)
      if (!f.everyCell && c > 0) continue
      if (!ch) continue
      ctx.save()
      ctx.fillStyle = `rgba(40,40,40,${f.trace})`
      ctx.fillText(ch, x + cell / 2, y + cell / 2 + cell * 0.02)
      ctx.restore()
    }
  }
}

function exportPng() {
  const canvas = canvasRef.value
  if (!canvas) return
  // 2 倍导出
  const out = document.createElement('canvas')
  out.width = canvas.width * 2
  out.height = canvas.height * 2
  const ctx = out.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  const a = document.createElement('a')
  a.href = out.toDataURL('image/png')
  a.download = 'copybook.png'
  a.click()
  ElMessage.success('已导出 PNG(2 倍)')
}

function reset() {
  f.text = SAMPLE
  f.grid = 'mi'
  f.cell = 96
  f.perRow = 8
  f.trace = 0.16
  f.everyCell = false
}

watch(f, render)
onMounted(render)
</script>

<template>
  <div class="cb">
    <div class="head">
      <div>
        <h3 class="title">字帖生成器</h3>
        <p class="sub">每字一行描红练字,田字格 / 米字格可选,导出 PNG 打印</p>
      </div>
      <div class="acts">
        <el-button size="small" type="primary" :icon="Download" @click="exportPng">导出 PNG</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
      </div>
    </div>

    <div class="cfg">
      <el-input v-model="f.text" class="txt" maxlength="30" show-word-limit placeholder="输入要练的字,例如:永和九年" />
      <el-radio-group v-model="f.grid" size="small">
        <el-radio-button value="mi">米字格</el-radio-button>
        <el-radio-button value="tian">田字格</el-radio-button>
        <el-radio-button value="plain">空白格</el-radio-button>
      </el-radio-group>
      <span class="lbl">格子</span>
      <el-input-number v-model="f.cell" :min="56" :max="160" :step="8" size="small" />
      <span class="lbl">每行</span>
      <el-input-number v-model="f.perRow" :min="4" :max="12" size="small" />
      <span class="lbl">描红</span>
      <el-slider v-model="f.trace" :min="0.05" :max="0.6" :step="0.01" style="width: 120px" />
      <el-checkbox v-model="f.everyCell">每格都描红</el-checkbox>
    </div>

    <div class="preview">
      <canvas ref="canvasRef" class="paper" />
    </div>

    <p class="foot">说明:默认每行首格给出描红字形、其余为空格供临摹(可勾选「每格都描红」);「描红」滑杆调深浅;导出为 2 倍尺寸,适合 A4 打印。</p>
  </div>
</template>

<style scoped>
.cb {
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
.txt {
  width: 220px;
}
.lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.preview {
  overflow: auto;
  max-height: 520px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
}
.paper {
  display: block;
  max-width: 100%;
  background: #fff;
  border-radius: 6px;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
