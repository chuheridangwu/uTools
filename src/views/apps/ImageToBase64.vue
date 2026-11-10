<script setup lang="ts">
/**
 * 图片转 Base64
 * 把图片转换成 Base64 / Data URL,可直接复制为 CSS 背景、HTML img 或 Markdown;
 * 也支持把 Base64 字符串还原为图片下载。所有处理均在本机完成。
 */
import { computed, reactive, ref } from 'vue'
import { CopyDocument, Download, Picture, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const tab = ref<'encode' | 'decode'>('encode')
const fileRef = ref<HTMLInputElement>()

/* ------------------------------ 编码 ------------------------------ */
const enc = reactive({
  name: '',
  dataUrl: '',
  size: 0,
  type: '',
  css: true,
})

const base64Only = computed(() => enc.dataUrl.replace(/^data:[^,]+,/, ''))

const cssSnippet = computed(() => `background-image: url("${enc.dataUrl}");`)
const imgSnippet = computed(() => `<img src="${enc.dataUrl}" alt="${enc.name}" />`)
const mdSnippet = computed(() => `![${enc.name}](${enc.dataUrl})`)

const currentSnippet = computed(() => {
  if (enc.css) return cssSnippet.value
  return imgSnippet.value
})

function pickFile() {
  fileRef.value?.click()
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) loadFile(file)
}

function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  enc.name = file.name
  enc.size = file.size
  enc.type = file.type
  const reader = new FileReader()
  reader.onload = () => {
    enc.dataUrl = String(reader.result)
  }
  reader.readAsDataURL(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

async function copy(v: string, tip = '已复制') {
  if (!v) return
  await copyText(v)
  ElMessage.success(tip)
}

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

/* ------------------------------ 解码 ------------------------------ */
const dec = reactive({ raw: '', error: '', dataUrl: '', name: 'decoded.png' })

function decode() {
  dec.error = ''
  dec.dataUrl = ''
  let s = dec.raw.trim()
  if (!s) return
  // 去掉前缀或引号
  s = s.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
  if (!/^data:/.test(s)) {
    // 尝试补全为 png
    if (/^[A-Za-z0-9+/=\s]+$/.test(s)) s = 'data:image/png;base64,' + s.replace(/\s/g, '')
    else {
      dec.error = '不是有效的 Base64 或 Data URL'
      return
    }
  }
  // 校验可解码
  try {
    const parts = s.split(',')
    const b64 = parts[1] || ''
    atob(b64.slice(0, 100).padEnd(Math.ceil(b64.slice(0, 100).length / 4) * 4, '='))
    dec.dataUrl = s
    const ext = (s.match(/data:image\/(\w+)/)?.[1] || 'png').replace('jpeg', 'jpg')
    dec.name = 'decoded.' + ext
  } catch {
    dec.error = 'Base64 内容无法解码,请检查是否完整'
  }
}

function downloadDecoded() {
  if (!dec.dataUrl) return
  const a = document.createElement('a')
  a.href = dec.dataUrl
  a.download = dec.name
  a.click()
}

function resetEnc() {
  enc.name = ''
  enc.dataUrl = ''
  enc.size = 0
  enc.type = ''
}
</script>

<template>
  <div class="ib">
    <div class="head">
      <div>
        <h3 class="title">图片转 Base64</h3>
        <p class="sub">图片与 Base64 / Data URL 互相转换,可复制为 CSS、HTML 或 Markdown</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="encode">图片 → Base64</el-radio-button>
        <el-radio-button value="decode">Base64 → 图片</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 编码 -->
    <template v-if="tab === 'encode'">
      <input ref="fileRef" type="file" accept="image/*" hidden @change="onFile" />
      <div v-if="!enc.dataUrl" class="drop" @click="pickFile" @dragover.prevent @drop="onDrop">
        <el-icon :size="34"><Picture /></el-icon>
        <p>点击或拖拽图片到此处</p>
      </div>

      <template v-else>
        <div class="top">
          <img :src="enc.dataUrl" class="preview" alt="preview" />
          <div class="meta">
            <div class="m-name">{{ enc.name }}</div>
            <div class="m-row"><span>类型</span>{{ enc.type }}</div>
            <div class="m-row"><span>大小</span>{{ fmtSize(enc.size) }}</div>
            <div class="m-row"><span>Base64 长度</span>{{ base64Only.length.toLocaleString() }} 字符</div>
            <div class="m-acts">
              <el-button size="small" @click="pickFile">更换</el-button>
              <el-button size="small" :icon="RefreshLeft" @click="resetEnc">清空</el-button>
            </div>
          </div>
        </div>

        <div class="out-block">
          <div class="ob-head">
            <span class="ob-title">Data URL</span>
            <el-button size="small" text :icon="CopyDocument" @click="copy(enc.dataUrl)">复制</el-button>
          </div>
          <textarea class="ob-text" readonly :value="enc.dataUrl" />
        </div>

        <div class="out-block">
          <div class="ob-head">
            <span class="ob-title">
              <el-radio-group v-model="enc.css" size="small">
                <el-radio-button :value="true">CSS 背景</el-radio-button>
                <el-radio-button :value="false">HTML img</el-radio-button>
              </el-radio-group>
            </span>
            <el-button size="small" text :icon="CopyDocument" @click="copy(currentSnippet)">复制</el-button>
          </div>
          <textarea class="ob-text" readonly :value="currentSnippet" />
          <div class="ob-extra">
            <el-button size="small" text :icon="CopyDocument" @click="copy(mdSnippet, '已复制 Markdown')">复制 Markdown</el-button>
            <el-button size="small" text :icon="CopyDocument" @click="copy(base64Only, '已复制纯 Base64')">仅复制 Base64</el-button>
          </div>
        </div>
      </template>
    </template>

    <!-- 解码 -->
    <template v-else>
      <el-input
        v-model="dec.raw"
        type="textarea"
        :rows="7"
        placeholder="粘贴 Base64 字符串或 data:image/... 的 Data URL"
        @input="decode"
      />
      <div v-if="dec.error" class="err">{{ dec.error }}</div>
      <div v-else-if="dec.dataUrl" class="dec-result">
        <img :src="dec.dataUrl" class="dec-img" alt="decoded" />
        <div class="dec-meta">
          <el-button type="primary" :icon="Download" @click="downloadDecoded">下载图片</el-button>
        </div>
      </div>
    </template>

    <p class="foot">提示:Base64 会使体积增大约 33%,较大的图片不建议直接内联到网页或样式表中。</p>
  </div>
</template>

<style scoped>
.ib {
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
.drop {
  border: 2px dashed var(--card-border);
  border-radius: 14px;
  min-height: 200px;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}
.drop p {
  margin: 8px 0 0;
  font-size: 13px;
}
.top {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 16px;
}
@media (max-width: 640px) {
  .top {
    flex-direction: column;
  }
}
.preview {
  width: 180px;
  max-height: 180px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
  flex: none;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.m-name {
  font-size: 15px;
  font-weight: 600;
  word-break: break-all;
}
.m-row {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.m-row span {
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}
.m-acts {
  margin-top: 6px;
  display: flex;
  gap: 8px;
}
.out-block {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.ob-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ob-title {
  font-size: 13px;
  font-weight: 600;
}
.ob-text {
  width: 100%;
  min-height: 70px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 10px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  resize: vertical;
  box-sizing: border-box;
  word-break: break-all;
}
.ob-extra {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.err {
  margin-top: 12px;
  color: #ef4444;
  font-size: 13px;
}
.dec-result {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  align-items: center;
}
.dec-img {
  max-width: 240px;
  max-height: 240px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--card-border);
}
.foot {
  margin-top: 16px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
