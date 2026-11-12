<script setup lang="ts">
/**
 * 二维码工具(生成 + 解析)
 * 生成:本地绘制二维码到 canvas,对齐草料(cli.im)常用参数——
 *   码制(QR)、容错率 L/M/Q/H、尺寸、码边距(个色块)、前景/背景色、中心 Logo 与大小;
 *   可下载 PNG / SVG。
 * 解析:jsQR 本地解码图片中的二维码,不上传。
 * 全部在浏览器本地完成。
 */
import { computed, onMounted, ref, shallowRef } from 'vue'
import type { UploadFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { CopyDocument, Delete, Picture } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadBlob } from '@/utils/common'
import { loadImage } from '@/utils/image'

type Level = 'L' | 'M' | 'Q' | 'H'

const tab = ref<'generate' | 'decode'>('generate')

/* ------------------------------ 生成 ------------------------------ */
const text = ref('https://example.com')
const size = ref(400)
const sizePreset = ref<number | 'custom'>(400)
const margin = ref(3) // 单位:色块(模块)
const level = ref<Level>('H')
const fg = ref('#111111')
const bg = ref('#ffffff')

/** 中心图片(dataURL 用于预览,Image 用于绘制) */
const logoUrl = ref('')
const logoImg = shallowRef<HTMLImageElement | null>(null)
const logoPercent = ref(22)
const generated = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)

const levelLabel: Record<Level, string> = {
  L: 'L 7%',
  M: 'M 15%',
  Q: 'Q 25%',
  H: 'H 30%',
}

/** 常用内容模板(对齐草料的文本/网址/电话/短信/邮件/WiFi) */
const TPL: Record<string, string> = {
  text: '在这里输入任意文本',
  url: 'https://example.com',
  tel: 'tel:13800138000',
  sms: 'SMSTO:13800138000:你好',
  mailto: 'mailto:someone@example.com',
  wifi: 'WIFI:T:WPA;S:WiFi名称;P:密码;;',
}
const tplKind = ref('url')

function applyTpl(kind: string) {
  tplKind.value = kind
  if (TPL[kind]) text.value = TPL[kind]
}

function onPresetChange(v: number | 'custom') {
  if (typeof v === 'number') size.value = v
}

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
  // 底板,保证二维码模块与图片之间有清晰间隔
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
      margin: margin.value,
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
  if (generated.value) void generate()
}

/** 下载 PNG(始终按当前设置重新生成,避免导出旧图) */
async function downloadPng() {
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

/** 下载 SVG(矢量,适合印刷;只含二维码本身,不含中心图片) */
async function downloadSvg() {
  const value = text.value.trim()
  if (!value) {
    ElMessage.warning('请先输入二维码内容')
    return
  }
  try {
    const svg = await QRCode.toString(value, {
      type: 'svg',
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: level.value,
      color: { dark: fg.value, light: bg.value },
    })
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `qrcode-${Date.now()}.svg`)
    if (logoUrl.value) ElMessage.info('SVG 不含中心图片;需要带 Logo 请下载 PNG')
  } catch (e) {
    ElMessage.error(`导出失败: ${(e as Error).message}`)
  }
}

function reset() {
  text.value = 'https://example.com'
  tplKind.value = 'url'
  sizePreset.value = 400
  size.value = 400
  margin.value = 3
  level.value = 'H'
  fg.value = '#111111'
  bg.value = '#ffffff'
  logoUrl.value = ''
  logoImg.value = null
  logoPercent.value = 22
  generated.value = false
  void generate()
}

/* ------------------------------ 解析 ------------------------------ */
const decodeCanvasUrl = ref('')
const decodeResult = ref('')
const decodeBusy = ref(false)

/** 依次尝试原始尺寸与放大后的采样,提高小码识别率 */
async function onDecodeFile(f: File) {
  decodeBusy.value = true
  decodeResult.value = ''
  try {
    const img = await loadImage(f)
    const tryAttempt = (scale: number): string | null => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth * scale
      c.height = img.naturalHeight * scale
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      const code = jsQR(data.data, c.width, c.height)
      decodeCanvasUrl.value = c.toDataURL('image/png')
      return code?.data ?? null
    }
    const hit = tryAttempt(1) ?? tryAttempt(2) ?? tryAttempt(3)
    if (hit) {
      decodeResult.value = hit
      ElMessage.success('解码成功')
    } else {
      ElMessage.warning('未识别出二维码')
    }
  } catch (e) {
    ElMessage.error(`解析失败: ${(e as Error).message}`)
  } finally {
    decodeBusy.value = false
  }
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => void onDecodeFile(f.raw as File)

const decodeIsUrl = computed(() => /^https?:\/\//i.test(decodeResult.value.trim()))

function copyResult() {
  if (!decodeResult.value) return
  copyText(decodeResult.value)
  ElMessage.success('已复制')
}

function openResult() {
  const url = decodeResult.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    ElMessage.warning('结果不是可打开的网址')
    return
  }
  window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  void generate()
})
</script>

<template>
  <ToolPage>
    <template #title>二维码生成</template>
    <template #desc>
      生成与解析二合一:参数对齐草料(容错率 / 尺寸 / 边距 / 配色 / 中心 Logo),支持导出 PNG、SVG;
      解析用 jsQR 在本机完成,图片不上传。
    </template>

    <el-tabs v-model="tab" class="qr-tabs">
      <el-tab-pane label="生成二维码" name="generate">
        <el-row :gutter="16">
          <el-col :span="10">
            <el-card shadow="never">
              <template #header>参数</template>
              <div class="form">
                <div class="lab">内容类型</div>
                <el-radio-group v-model="tplKind" size="small" @change="(v: unknown) => applyTpl(String(v))">
                  <el-radio-button value="text">文本</el-radio-button>
                  <el-radio-button value="url">网址</el-radio-button>
                  <el-radio-button value="tel">电话</el-radio-button>
                  <el-radio-button value="sms">短信</el-radio-button>
                  <el-radio-button value="mailto">邮件</el-radio-button>
                  <el-radio-button value="wifi">WiFi</el-radio-button>
                </el-radio-group>

                <div class="lab">内容(链接 / 文本)</div>
                <el-input v-model="text" type="textarea" :rows="5" placeholder="https://example.com" />

                <div class="lab">码制</div>
                <div class="inrow">
                  <el-tag size="small" type="info">QR Code</el-tag>
                  <span class="hint-inline">汉信码 / PDF417 / Data Matrix 暂不支持</span>
                </div>

                <div class="lab">容错率</div>
                <el-radio-group v-model="level" size="small">
                  <el-radio-button v-for="(label, key) in levelLabel" :key="key" :value="key">
                    {{ label }}
                  </el-radio-button>
                </el-radio-group>

                <div class="lab">尺寸</div>
                <el-radio-group
                  v-model="sizePreset"
                  size="small"
                  @change="(v: unknown) => onPresetChange(v as number | 'custom')"
                >
                  <el-radio-button :value="300">300</el-radio-button>
                  <el-radio-button :value="400">400</el-radio-button>
                  <el-radio-button :value="600">600</el-radio-button>
                  <el-radio-button value="custom">自定义</el-radio-button>
                </el-radio-group>
                <template v-if="sizePreset === 'custom'">
                  <div class="lab">宽度 {{ size }} px</div>
                  <el-slider v-model="size" :min="128" :max="1024" size="small" />
                </template>
                <div class="hint">导出为正方形,高度与宽度一致。</div>

                <div class="lab">码边距 {{ margin }} 个色块</div>
                <el-slider v-model="margin" :min="0" :max="10" :step="1" size="small" />

                <div class="lab">前景 / 背景颜色</div>
                <div class="inrow">
                  <el-color-picker v-model="fg" size="small" />
                  <el-color-picker v-model="bg" size="small" />
                  <el-button size="small" text @click="() => { fg = '#111111'; bg = '#ffffff' }">黑白</el-button>
                </div>

                <div class="lab">中心图片(可选)</div>
                <div class="inrow">
                  <el-button size="small" :icon="Picture" @click="pickLogo">上传图片</el-button>
                  <img v-if="logoUrl" :src="logoUrl" class="logo-thumb" alt="中心图片" />
                  <el-button v-if="logoUrl" size="small" :icon="Delete" text @click="removeLogo">
                    移除
                  </el-button>
                  <span v-else class="none-tag">未上传</span>
                </div>
                <input ref="fileRef" type="file" accept="image/*" hidden @change="onLogoChange" />
                <template v-if="logoUrl">
                  <div class="lab">图片大小 {{ logoPercent }}%</div>
                  <el-slider v-model="logoPercent" :min="10" :max="35" :step="1" size="small" />
                  <div class="hint">中间有图片时会自动使用 H 级容错,建议不要超过 30%。</div>
                </template>

                <div class="acts">
                  <el-button type="primary" size="small" @click="generate">生成二维码</el-button>
                  <el-button size="small" :disabled="!generated" @click="downloadPng">下载 PNG</el-button>
                  <el-button size="small" :disabled="!text.trim()" @click="downloadSvg">下载 SVG</el-button>
                  <el-button size="small" text @click="reset">重置</el-button>
                </div>
                <div class="hint">修改设置后点击「生成二维码」刷新预览;下载会按当前设置重新生成。</div>
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
      </el-tab-pane>

      <el-tab-pane label="解析二维码" name="decode">
        <el-card shadow="never" v-loading="decodeBusy">
          <template #header>上传图片</template>
          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            :on-change="onUploadChange"
          >
            <div class="drop">拖入含二维码的图片,或点击选择</div>
          </el-upload>
        </el-card>

        <el-row v-if="decodeResult || decodeCanvasUrl" :gutter="16" class="mt12">
          <el-col :span="10">
            <el-card shadow="never" :body-style="{ padding: '6px' }">
              <template #header>扫描图</template>
              <img v-if="decodeCanvasUrl" :src="decodeCanvasUrl" class="scan" alt="扫描结果" />
            </el-card>
          </el-col>
          <el-col :span="14">
            <el-card shadow="never">
              <template #header>
                <div class="head">
                  <span>解析结果</span>
                  <div class="inrow">
                    <el-button size="small" :disabled="!decodeIsUrl" @click="openResult">打开链接</el-button>
                    <el-button size="small" type="primary" :icon="CopyDocument" :disabled="!decodeResult" @click="copyResult">
                      复制
                    </el-button>
                  </div>
                </div>
              </template>
              <el-input v-if="decodeResult" type="textarea" :rows="8" :model-value="decodeResult" readonly />
              <el-empty v-else description="尚无结果" />
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </ToolPage>
</template>

<style scoped>
.qr-tabs {
  margin-top: -6px;
}
.form { display: flex; flex-direction: column; }
.lab { font-size: 12px; color: var(--el-text-color-secondary); margin: 10px 0 4px; }
.inrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.logo-thumb {
  width: 34px; height: 34px; object-fit: cover; border-radius: 8px;
  border: 1px solid var(--el-border-color); background: #fff;
}
.none-tag { font-size: 12px; color: var(--el-text-color-placeholder); }
.hint { font-size: 11px; color: var(--el-text-color-placeholder); line-height: 1.6; margin-top: 4px; }
.hint-inline { font-size: 11px; color: var(--el-text-color-placeholder); }
.acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.stage {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 360px; padding: 12px; overflow: auto;
  background: var(--el-fill-color-lighter); border-radius: 8px;
}
.stage canvas { max-width: 100%; height: auto; border-radius: 6px; }
.stage canvas.off { display: none; }
.placeholder { font-size: 12px; color: var(--el-text-color-placeholder); }
.mt12 { margin-top: 12px; }
.drop { padding: 28px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.scan { width: 100%; border-radius: 6px; }
</style>
