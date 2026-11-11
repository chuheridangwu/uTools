<script setup lang="ts">
/**
 * 二维码生成
 * 本地绘制二维码到 canvas,支持容错等级、尺寸、留白、前景/背景色,
 * 可在二维码中心上传图片并调整大小,点击按钮生成,可下载 PNG。
 * 全部在浏览器本地完成,不上传任何内容。
 */
import { onMounted, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Picture } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import ToolPage from '@/components/ToolPage.vue'
import { downloadBlob } from '@/utils/common'

const text = ref('https://example.com')
const size = ref(320)
const margin = ref(16)
const level = ref<'L' | 'M' | 'Q' | 'H'>('H')
const fg = ref('#111111')
const bg = ref('#ffffff')

/** 中心图片(dataURL 用于预览,Image 用于绘制) */
const logoUrl = ref('')
const logoImg = shallowRef<HTMLImageElement | null>(null)
/** 中心图片相对二维码的宽度百分比 */
const logoPercent = ref(22)
/** 是否已生成过(未生成时预览区显示占位) */
const generated = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)

/** 圆角矩形路径(兼容不支持 ctx.roundRect 的浏览器) */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 在二维码中心绘制图片(白色圆角底板 + 等比缩放 + 圆角裁切) */
function drawLogo(c: HTMLCanvasElement) {
  const img = logoImg.value
  if (!img || !img.width || !img.height) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  const W = c.width
  const box = Math.max(8, Math.round((W * logoPercent.value) / 100))
  const pad = Math.max(3, Math.round(box * 0.12))
  const x = Math.round((W - box) / 2)
  const y = Math.round((W - box) / 2)
  const bgPad = Math.round(box * 0.18)

  ctx.save()
  // 白色底板,保证二维码模块与图片之间有清晰间隔
  ctx.fillStyle = bg.value
  roundRect(ctx, x - pad, y - pad, box + pad * 2, box + pad * 2, bgPad)
  ctx.fill()

  // 等比缩放,避免图片变形
  const ratio = Math.min(box / img.width, box / img.height)
  const dw = Math.max(1, Math.round(img.width * ratio))
  const dh = Math.max(1, Math.round(img.height * ratio))
  const dx = Math.round(x + (box - dw) / 2)
  const dy = Math.round(y + (box - dh) / 2)

  roundRect(ctx, dx, dy, dw, dh, Math.round(Math.min(dw, dh) * 0.14))
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

/** 生成(点击按钮或首次进入时调用) */
async function generate() {
  const c = canvasRef.value
  if (!c) return
  const value = text.value.trim()
  if (!value) {
    ElMessage.warning('请先输入二维码内容')
    return
  }
  if (logoImg.value && (level.value === 'L' || level.value === 'M')) {
    // 中间有图片时提高容错,避免遮挡导致识别失败
    level.value = 'H'
  }
  try {
    await QRCode.toCanvas(c, value, {
      width: size.value,
      margin: Math.round(margin.value / 4), // 模块数单位,大致换算
      errorCorrectionLevel: level.value,
      color: { dark: fg.value, light: bg.value },
    })
    drawLogo(c)
    generated.value = true
  } catch (e) {
    generated.value = false
    ElMessage.error(`生成失败: ${(e as Error).message}`)
  }
}

/** 选择中心图片 */
function pickLogo() {
  fileRef.value?.click()
}

function onLogoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.warning('图片请小于 8MB')
    return
  }
  const reader = new FileReader()
  reader.onerror = () => ElMessage.error('图片读取失败')
  reader.onload = () => {
    const url = String(reader.result ?? '')
    const img = new Image()
    img.onload = () => {
      logoUrl.value = url
      logoImg.value = img
      if (level.value === 'L' || level.value === 'M') level.value = 'H'
      ElMessage.success('已添加中心图片,可点击「生成二维码」查看效果')
      // 已经生成过则立即刷新,方便观察大小
      if (generated.value) void generate()
    }
    img.onerror = () => ElMessage.error('图片解析失败,请换一张试试')
    img.src = url
  }
  reader.readAsDataURL(file)
}

function removeLogo() {
  logoUrl.value = ''
  logoImg.value = null
  // 已生成则立即去掉中心图片
  if (generated.value) void generate()
}

/** 下载 PNG(始终按当前设置重新生成,避免导出旧图) */
async function download() {
  if (!text.value.trim()) {
    ElMessage.warning('请先输入二维码内容')
    return
  }
  await generate()
  const c = canvasRef.value
  if (!c || !generated.value) return
  c.toBlob((b) => {
    if (b) downloadBlob(b, `qrcode-${Date.now()}.png`)
  }, 'image/png')
}

function reset() {
  text.value = 'https://example.com'
  size.value = 320
  margin.value = 16
  level.value = 'H'
  fg.value = '#111111'
  bg.value = '#ffffff'
  logoUrl.value = ''
  logoImg.value = null
  logoPercent.value = 22
  generated.value = false
  void generate()
}

onMounted(() => {
  void generate()
})
</script>

<template>
  <ToolPage>
    <template #title>二维码生成</template>
    <template #desc>
      输入文本或链接,本地生成二维码,支持容错等级、尺寸与颜色;可在中心上传图片并调整大小,点击按钮生成,下载 PNG。
    </template>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>设置</template>
          <div class="form">
            <div class="lab">内容(链接 / 文本)</div>
            <el-input v-model="text" type="textarea" :rows="5" placeholder="https://example.com" />

            <div class="lab">中心图片(可选)</div>
            <div class="inrow">
              <el-button size="small" :icon="Picture" @click="pickLogo">上传图片</el-button>
              <img v-if="logoUrl" :src="logoUrl" class="logo-thumb" alt="中心图片" />
              <el-button v-if="logoUrl" size="small" :icon="Delete" text @click="removeLogo">
                移除
              </el-button>
              <span v-else class="none-tag">未上传</span>
            </div>
            <input
              ref="fileRef"
              type="file"
              accept="image/*"
              hidden
              @change="onLogoChange"
            />
            <template v-if="logoUrl">
              <div class="lab">图片大小 {{ logoPercent }}%</div>
              <el-slider v-model="logoPercent" :min="10" :max="35" :step="1" size="small" />
              <div class="hint">中间有图片时会自动使用 H 级容错,建议不要超过 30%。</div>
            </template>

            <div class="lab">尺寸 {{ size }} px</div>
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
            </div>

            <div class="acts">
              <el-button type="primary" size="small" @click="generate">生成二维码</el-button>
              <el-button size="small" :disabled="!generated" @click="download">下载 PNG</el-button>
              <el-button size="small" text @click="reset">重置</el-button>
            </div>
            <div class="hint">修改设置后点击「生成二维码」刷新预览。</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="never">
          <template #header>预览</template>
          <div class="stage">
            <canvas ref="canvasRef" :class="{ off: !generated }"></canvas>
            <div v-if="!generated" class="placeholder">点击左侧「生成二维码」开始</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.form { display: flex; flex-direction: column; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin: 8px 0 4px; }
.inrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.logo-thumb {
  width: 34px; height: 34px; object-fit: cover; border-radius: 8px;
  border: 1px solid var(--el-border-color); background: #fff;
}
.none-tag { font-size: 12px; color: var(--el-text-color-placeholder); }
.hint { font-size: 11px; color: var(--el-text-color-placeholder); line-height: 1.6; margin-top: 4px; }
.acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.stage {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 320px; padding: 12px; overflow: auto;
  background: var(--el-fill-color-lighter); border-radius: 8px;
}
.stage canvas { max-width: 100%; height: auto; border-radius: 6px; }
.stage canvas.off { display: none; }
.placeholder { font-size: 12px; color: var(--el-text-color-placeholder); }
</style>
