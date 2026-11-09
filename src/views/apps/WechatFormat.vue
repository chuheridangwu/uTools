<script setup lang="ts">
/**
 * 公众号排版
 * Markdown → 带内联样式的 HTML(公众号编辑器只认内联样式),
 * 多套主题,代码高亮,一键复制富文本(text/html)。
 */
import { computed, ref } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

const md = ref(`# 我们发布了新产品

今天正式上线了 **新的版本**,主要更新:

- 支持多主题排版
- 一键复制到公众号后台
- 代码块自动高亮

> 写作即排版,不再调整格式。

\`\`\`js
const hello = () => console.log('hello 公众号')
\`\`\`

[点击查看详情](https://example.com)`)

const THEMES = {
  teal: { name: '青碧', h1: '#0f766e', h2: '#0d9488', quote: '#0f766e', link: '#0d9488', quoteBg: '#f0fdfa' },
  pink: { name: '樱粉', h1: '#be185d', h2: '#db2777', quote: '#be185d', link: '#db2777', quoteBg: '#fdf2f8' },
  orange: { name: '暖橙', h1: '#c2410c', h2: '#ea580c', quote: '#c2410c', link: '#ea580c', quoteBg: '#fff7ed' },
  blue: { name: '靛蓝', h1: '#1d4ed8', h2: '#2563eb', quote: '#1d4ed8', link: '#2563eb', quoteBg: '#eff6ff' },
}
const themeKey = ref<keyof typeof THEMES>('teal')

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 生成带内联样式的 HTML(marked 的 renderer 输出全部内联,公众号才能保留) */
function render(): string {
  const t = THEMES[themeKey.value]
  const renderer = new marked.Renderer()
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    if (depth === 1) {
      return `<h1 style="font-size:22px;font-weight:700;color:${t.h1};text-align:center;margin:28px 0 18px;">${text}</h1>`
    }
    if (depth === 2) {
      return `<h2 style="font-size:17px;font-weight:700;color:${t.h2};border-left:4px solid ${t.h2};padding-left:10px;margin:26px 0 14px;">${text}</h2>`
    }
    return `<h3 style="font-size:15px;font-weight:700;color:#333;margin:20px 0 10px;">${text}</h3>`
  }
  renderer.paragraph = ({ text }: { text: string }) =>
    `<p style="font-size:15px;line-height:1.9;color:#3a3a3a;margin:14px 0;letter-spacing:0.5px;">${text}</p>`
  renderer.blockquote = ({ tokens }: { tokens: unknown[] }) => {
    const inner = marked.parser(tokens as never)
    return `<blockquote style="border-left:3px solid ${t.quote};background:${t.quoteBg};padding:10px 14px;margin:16px 0;border-radius:4px;font-size:14px;color:#555;">${inner}</blockquote>`
  }
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = (lang || '').split(/\s/)[0]
    const highlighted = language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language }).value
      : esc(text)
    return `<pre style="background:#282c34;border-radius:8px;padding:14px;margin:16px 0;overflow-x:auto;"><code style="font-family:Menlo,Consolas,monospace;font-size:13px;color:#abb2bf;line-height:1.7;">${highlighted}</code></pre>`
  }
  renderer.listitem = ({ text }: { text: string }) =>
    `<li style="font-size:15px;line-height:1.9;color:#3a3a3a;margin:6px 0;">${text}</li>`
  renderer.link = ({ href, text }: { href: string; text: string }) =>
    `<a href="${href}" style="color:${t.link};text-decoration:none;border-bottom:1px solid ${t.link};">${text}</a>`
  renderer.strong = ({ text }: { text: string }) =>
    `<strong style="color:${t.h1};font-weight:700;">${text}</strong>`
  renderer.image = ({ href, text }: { href: string; text: string }) =>
    `<img src="${href}" alt="${text}" style="max-width:100%;border-radius:6px;margin:12px 0;">`

  return marked.parse(md.value, { renderer, async: false }) as string
}

const html = computed(() => render())

const copied = ref(false)

/** 复制富文本:text/html + text/plain 双剪贴板 */
async function copyRich() {
  try {
    const plain = md.value
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html.value], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
    ElMessage.success('已复制带样式正文,去公众号后台粘贴即可')
  } catch {
    await copyText(html.value)
    ElMessage.warning('已复制 HTML 源码(浏览器不支持富文本复制)')
  }
}
</script>

<template>
  <div class="wx">
    <div class="bar">
      <el-radio-group v-model="themeKey" size="small">
        <el-radio-button v-for="(t, k) in THEMES" :key="k" :value="k">{{ t.name }}</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" :icon="CopyDocument" @click="copyRich">
        {{ copied ? '已复制' : '复制到公众号' }}
      </el-button>
    </div>
    <div class="cols">
      <el-input v-model="md" type="textarea" :rows="18" class="editor" placeholder="在此输入 Markdown…" />
      <div class="preview">
        <div class="phone" v-html="html" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 800px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.editor :deep(textarea) {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
}
.preview {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 18px 16px;
  overflow: auto;
  max-height: 70vh;
  background: var(--el-bg-color);
}
.phone :deep(> :first-child) {
  margin-top: 0;
}
</style>
