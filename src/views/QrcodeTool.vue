<script setup lang="ts">
/**
 * 二维码生成
 * 本地绘制 QR 码到 canvas,支持容错等级、尺寸、留白、前景/背景色,可下载 PNG。
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'

const text = ref('https://example.com')
const size = ref(256)
const margin = ref(16)
const level = ref<'L' | 'M' | 'Q' | 'H'>('M')
const fg = ref('#111111')
const bg = ref('#ffffff')

const canvasRef = ref<HTMLCanvasElement | null>(null)

async function render() {
  const c = canvasRef.value
  if (!c || !text.value) return
  try {
    await QRCode.toCanvas(c, text.value, {
      width: size.value,
      margin: Math.round(margin.value / 4), // 模块数单位,大致换算
      errorCorrectionLevel: level.value,
      color: { dark: fg.value, light: bg.value },
    })
  } catch (e) {
    ElMessage.error(`生成失败: ${(e as Error).message}`)
  }
}

async function download() {
  const c = canvasRef.value
  if (!c) return
  c.toBlob((b) => {
    if (b) downloadBlob(b, `qrcode-${Date.now()}.png`)
  }, 'image/png')
}

watch([text, size, margin, level, fg, bg], () => render())
</script>

<template>
  <ToolPage>
    <template #title>二维码生成</template>
    <template #desc>输入文本或链接,本地生成二维码,支持容错等级、尺寸与颜色,可下载 PNG。</template>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>设置</template>
          <div class="form">
            <div class="lab">内容(链接 / 文本)</div>
            <el-input v-model="text" type="textarea" :rows="6" />
            <div class="lab">{{ `${size} ${'px'}` }} 尺寸</div>
            <el-slider v-model="size" :min="128" :max="1024" size="small" />
            <div class="lab">留白 {{ margin }} px</div>
            <el-slider v-model="margin" :min="0" :max="64" size="small" />
            <div class="lab">容错等级</div>
            <el-radio-group v-model="level" size="small">
              <el-radio-button value="L">L 低</el-radio-button>
              <el-radio-button value="M">M 中</el-radio-button>
              <el-radio-button value="Q">Q 高</el-radio-button>
              <el-radio-button value="H">H 最高</el-radio-button>
            </el-radio-group>
            <div class="lab">前景 / 背景颜色</div>
            <div class="inrow">
              <el-color-picker v-model="fg" size="small" />
              <el-color-picker v-model="bg" size="small" />
              <el-button size="small" @click="download">下载 PNG</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>预览</template>
          <div class="stage">
            <canvas ref="canvasRef"></canvas>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.llab { font-size: 12px; }
.form { display: flex; flex-direction: column; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin: 8px 0 4px; }
.inrow { display: flex; align-items: center; gap: 8px; }
.stage { display: flex; align-items: center; justify-content: center; min-height: 320px; padding: 12px; background: var(--el-fill-color-lighter); border-radius: 8px; }
</style>
