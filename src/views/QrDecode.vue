<script setup lang="ts">
/**
 * 二维码解码
 * 使用 jsQR 在本地解码图片中的二维码,不上传;支持拖拽与多图尝试速度优化。
 */
import type { UploadFile } from 'element-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import jsQR from 'jsqr'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'
import { loadImage } from '@/utils/image'

const canvasUrl = ref('')
const result = ref('')
const busy = ref(false)

/** 依次尝试原始尺寸与放大一倍的两种采样,提高小码识别率 */
async function onFile(f: File) {
  busy.value = true
  result.value = ''
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
      canvasUrl.value = c.toDataURL('image/png')
      return code?.data ?? null
    }
    const hit = tryAttempt(1) ?? tryAttempt(2) ?? tryAttempt(3)
    if (hit) {
      result.value = hit
      ElMessage.success('解码成功')
    } else {
      return ElMessage.warning('未识别出二维码')
    }
  } catch (e) {
    ElMessage.error(`解析失败: ${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

function copyResult() {
  if (result.value) copyText(result.value)
  ElMessage.success('已复制')
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>二维码解码</template>
    <template #desc>上传或拖入含二维码的图片,本地用 jsQR 识别并解析出文本/链接,不上传原图。</template>

    <el-card shadow="never" v-loading="busy">
      <template #header>图片</template>
      <el-upload drag :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="onUploadChange">
        <div class="drop">拖入含二维码的图片,或点击选择</div>
      </el-upload>
    </el-card>

    <el-row v-if="result || canvasUrl" :gutter="16" class="mt12">
      <el-col :span="10">
        <el-card shadow="never" :body-style="{ padding: '6px' }">
          <template #header>扫描图</template>
          <img v-if="canvasUrl" :src="canvasUrl" class="scan" alt="扫描结果" />
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>
            <div class="head">
              <span>解析结果</span>
              <el-button size="small" type="primary" @click="copyResult" :disabled="!result">复制</el-button>
            </div>
          </template>
          <el-input v-if="result" type="textarea" :rows="8" :model-value="result" readonly />
          <el-empty v-else description="尚无结果" />
        </el-card>
      </el-col>
    </el-row>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.drop { padding: 28px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.scan { width: 100%; border-radius: 6px; }
</style>
