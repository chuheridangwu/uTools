<script setup lang="ts">
/**
 * 编码解码工具
 * 双向即时转换:Base64(UTF-8 安全)、URL 编码、十六进制、Unicode 转义。
 * 四个输出面板独立显示,左侧文本输入后右侧实时更新。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'
import { copyText } from '@/utils/common'

const text = ref('uTools 在线工具站\nHello, world!')

/** Base64 编解码(处理任意 UTF-8 内容) */
function b64encode(str: string): string {
  return btoa(new TextEncoder().encode(str).reduce((acc, ch) => acc + String.fromCharCode(ch), ''))
}
function b64decode(str: string): string {
  const bin = atob(str)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const b64 = computed(() => {
  try {
    return { status: 'ok' as const, text: b64encode(text.value) }
  } catch {
    return { status: 'err' as const, text: '(无法编码)' }
  }
})

const url = computed(() => {
  try {
    return { status: 'ok' as const, text: encodeURIComponent(text.value) }
  } catch {
    return { status: 'err' as const, text: '' }
  }
})

const hex = computed(() =>
  Array.from(new TextEncoder().encode(text.value))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' '),
)

const unicode = computed(() => text.value.replace(/./g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')))

/** 解码面板:输入任意格式 → 回填主文本 */
const decodeInput = ref('')
const decodeKind = ref<'base64' | 'url' | 'hex' | 'unicode' | 'auto'>('auto')

const decodedResult = computed(() => {
  if (!decodeInput.value.trim()) return ''
  try {
    if (decodeKind.value === 'base64') return b64decode(decodeInput.value.trim())
    if (decodeKind.value === 'url') return decodeURIComponent(decodeInput.value.replace(/\+/g, ' '))
    if (decodeKind.value === 'unicode')
      return decodeInput.value.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    if (decodeKind.value === 'hex')
      return new TextDecoder().decode(
        new Uint8Array(decodeInput.value.trim().split(/\s+/).map((h) => parseInt(h, 16))),
      )
    // auto:启发式判断格式
    const s = decodeInput.value.trim()
    if (/\\u[0-9a-fA-F]{4}/.test(s)) return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    if (/^(?:[0-9a-fA-F]{2}\s+)+[0-9a-fA-F]{1,2}$/.test(s))
      return new TextDecoder().decode(new Uint8Array(s.split(/\s+/).map((h) => parseInt(h, 16))))
    if (/^https?%3A/.test(s) || s.includes('%')) return decodeURIComponent(s.replace(/\+/g, ' '))
    return b64decode(s.replace(/\s/g, ''))
  } catch {
    return '(解码失败)'
  }
})

function copy(v: string) {
  copyText(v)
  ElMessage.success('已复制')
}

function reset() {
  text.value = ''
  decodeInput.value = ''
}
</script>

<template>
  <ToolPage>
    <template #title>编码解码</template>
    <template #desc>文本与 Base64、URL、Hex、Unicode 转义之间互相转换,双向即时预览。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>输入文本</span>
          <el-button size="small" @click="reset">清空</el-button>
        </div>
      </template>
      <el-input v-model="text" type="textarea" :rows="4" class="mono" />

      <el-row :gutter="12" class="mt12">
        <el-col :span="6" v-for="(p, i) in [
          { label: 'Base64', value: b64.text, ok: b64.status === 'ok' },
          { label: 'URL 编码', value: url.text, ok: url.status === 'ok' },
          { label: '十六进制 Hex', value: hex, ok: true },
          { label: 'Unicode 转义', value: unicode, ok: true },
        ]" :key="i">
          <div class="pane">
            <div class="pane-h">
              {{ p.label }}
              <el-button size="small" text @click="p.ok && p.value && copy(p.value)">复制</el-button>
            </div>
            <div class="pane-v mono">{{ p.value || '-' }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="mt12">
      <template #header>反向解码</template>
      <el-row :gutter="12">
        <el-col :span="14">
          <el-select v-model="decodeKind" size="small" style="width: 130px" class="mb8">
            <el-option label="自动识别" value="auto" />
            <el-option label="Base64" value="base64" />
            <el-option label="URL 编码" value="url" />
            <el-option label="Hex" value="hex" />
            <el-option label="Unicode 转义" value="unicode" />
          </el-select>
          <el-input v-model="decodeInput" type="textarea" :rows="4" class="mono" placeholder="粘贴任意编码片段…" />
        </el-col>
        <el-col :span="10">
          <div class="decval mono">{{ decodedResult || '-' }}</div>
          <el-button class="mt8" size="small" @click="decodedResult && (text = decodedResult)">用作输入</el-button>
        </el-col>
      </el-row>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt12 { margin-top: 12px; }
.mt8 { margin-top: 8px; }
.mb8 { margin-bottom: 8px; }
.mt0 { margin-top: 0; }
.head { display: flex; justify-content: space-between; align-items: center; }
.pane { border: 1px solid var(--card-border); border-radius: 8px; overflow: hidden; }
.pane-h { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-size: 12px; background: var(--el-fill-color-light); }
.pane-v { padding: 10px; min-height: 68px; font-size: 12px; word-break: break-all; }
.decval { padding: 10px 12px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--el-fill-color-lighter); min-height: 110px; font-size: 13px; white-space: pre-wrap; }
</style>
