<script setup lang="ts">
/**
 * 印章生成器
 * 生成圆形印章(公司 / 财务 / 个人姓名章):环绕文字、中央五角星或
 * 种子图案、底部小字与主色,实时预览并可下载透明背景 PNG。
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { Download, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const canvasRef = ref<HTMLCanvasElement>()

const f = reactive({
  top: '流畅科技开发有限公司',
  bottom: '合同专用章',
  middle: 'star', // 'star' | 'none'
  color: '#d92f2c',
  opacity: 88,
  rough: true,
  size: 384,
})

const COLORS = ['#d92f2c', '#b91c1c', '#1d4ed8', '#111827']

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const s = f.size
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, s, s)

  const cx = s / 2
  const cy = s / 2
  const R = s * 0.46 // 外圈半径
  ctx.globalAlpha = f.opacity / 100
  ctx.fillStyle = f.color
  ctx.strokeStyle = f.color

  /* 外圈 */
  const lw = Math.max(2, Math.round(s * 0.022))
  ctx.lineWidth = lw
  if (f.rough) HandCircle(ctx, cx, cy, R, lw)
  else {
    ctx.beginPath()
    ctx.arc(cx, cy, R - lw / 2, 0, Math.PI * 2)
    ctx.stroke()
  }

  /* 环绕文字(上半弧,分散排列) */
  const text = f.top.replace(/\s/g, '')
  if (text) {
    const fontSize = Math.max(12, Math.round(R * 0.24))
    ctx.font = `600 ${fontSize}px "SimSun", "Songti SC", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const count = text.length
    // 上弧:从 200° 到 340°(以 canvas 角度,即左下到右下上方)
    const startDeg = 200
    const endDeg = 340
    const totalDeg = endDeg - startDeg
    // 文字数少时收紧角度,最多占满
    const spread = Math.min(totalDeg, Math.max(30, (totalDeg * Math.min(0.95, count / 14) + count * 4)))
    const step = count > 1 ? spread / (count - 1) : 0
    const midDeg = (startDeg + endDeg) / 2
    const realStart = midDeg - (count - 1) * step / 2
    const textR = R - lw - fontSize * 0.72
    for (let i = 0; i < count; i++) {
      const deg = realStart + i * step
      const rad = (deg * Math.PI) / 180
      const x = cx + Math.cos(rad) * textR
      const y = cy + Math.sin(rad) * textR
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rad + Math.PI / 2)
      ctx.fillText(text[i], 0, 0)
      ctx.restore()
    }
  }

  /* 中央五角星 */
  if (f.middle === 'star') {
    drawStar(ctx, cx, cy - s * 0.02, s * 0.09)
  }

  /* 底部小字 */
  const bottom = f.bottom.trim()
  if (bottom) {
    const fs = Math.max(11, Math.round(R * 0.17))
    ctx.font = `600 ${fs}px "SimSun", "Songti SC", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(bottom, cx, cy + R * 0.52)
  }

  ctx.globalAlpha = 1
}

/** 手绘感圆圈:多段微小抖动的弧线 */
function HandCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lw: number) {
  const segs = 5
  const arc = (Math.PI * 2) / segs
  for (let i = 0; i < segs; i++) {
    const a0 = i * arc + (Math.random() - 0.5) * 0.02
    const a1 = (i + 1) * arc + (Math.random() - 0.5) * 0.02
    const rr = r + (Math.random() - 0.5) * lw * 0.35
    ctx.beginPath()
    ctx.arc(cx, cy, rr, a0, a1)
    ctx.stroke()
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.42
    const x = cx + Math.cos(rad) * rr
    const y = cy + Math.sin(rad) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `seal_${f.bottom || 'seal'}.png`
  a.click()
  ElMessage.success('已下载透明 PNG')
}

function reset() {
  f.top = '流畅科技开发有限公司'
  f.bottom = '合同专用章'
  f.middle = 'star'
  f.color = '#d92f2c'
  f.opacity = 88
  f.rough = true
}

watch(f, render)
onMounted(render)
</script>

<template>
  <div class="sg">
    <div class="head">
      <div>
        <h3 class="title">印章生成器</h3>
        <p class="sub">生成圆形印章图片,透明背景 PNG,可插入文档或聊天</p>
      </div>
      <div class="acts">
        <el-button size="small" :icon="Download" type="primary" @click="download">下载 PNG</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="reset">重置</el-button>
      </div>
    </div>

    <div class="cols">
      <div class="preview">
        <div class="pv-box">
          <canvas ref="canvasRef" class="pv" @click="render" />
        </div>
        <div class="pv-tip">点击印章可刷新「手绘感」抖动效果</div>
      </div>

      <div class="cfg">
        <div class="row">
          <span class="lbl">主文字<br /><small>(沿弧排列)</small></span>
          <el-input v-model="f.top" maxlength="14" show-word-limit placeholder="如公司全称" />
        </div>
        <div class="row">
          <span class="lbl">底部小字</span>
          <el-input v-model="f.bottom" maxlength="8" style="width: 200px" placeholder="如 合同专用章" />
          <el-radio-group v-model="f.middle" size="small">
            <el-radio-button value="star">五角星</el-radio-button>
            <el-radio-button value="none">空白</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <span class="lbl">颜色</span>
          <button
            v-for="c in COLORS"
            :key="c"
            class="color-dot"
            :style="{ background: c }"
            :class="{ on: f.color === c }"
            @click="f.color = c"
          />
          <el-color-picker v-model="f.color" size="small" />
        </div>
        <div class="row">
          <span class="lbl">透明度</span>
          <el-slider v-model="f.opacity" :min="40" :max="100" style="flex: 1" />
          <span class="val">{{ f.opacity }}%</span>
        </div>
        <div class="row">
          <span class="lbl">手绘感</span>
          <el-switch v-model="f.rough" />
          <span class="lbl" style="margin-left: 12px">尺寸</span>
          <el-radio-group v-model="f.size" size="small">
            <el-radio-button :value="256">256</el-radio-button>
            <el-radio-button :value="384">384</el-radio-button>
            <el-radio-button :value="512">512</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <p class="foot">仅供设计排版参考(如文档示意、模板素材),请勿用于伪造公章、财务章等真实印章,由此产生的责任与本工具无关。</p>
  </div>
</template>

<style scoped>
.sg {
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
.cols {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 760px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.pv-box {
  width: 300px;
  height: 300px;
  display: grid;
  place-items: center;
  background: var(--el-fill-color-light);
  border-radius: 16px;
  border: 1px solid var(--card-border);
}
.pv {
  width: 250px;
  height: 250px;
  cursor: pointer;
}
.pv-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.cfg {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.lbl {
  width: 88px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
  line-height: 1.3;
}
.lbl small {
  color: var(--el-text-color-placeholder);
}
.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.color-dot.on {
  border-color: currentColor;
}
.val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  width: 42px;
  flex: none;
}
.row :deep(.el-slider) {
  width: 160px;
}
.foot {
  margin-top: 18px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
