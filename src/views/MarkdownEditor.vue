<script setup lang="ts">
/**
 * Markdown 编辑器
 * 左右分栏实时预览(marked 解析),支持复制 HTML 和导出 .md/.html。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import hljs from 'highlight.js'
import { marked } from 'marked'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

const text = ref('# 标题示例\n\n这是一段 **加粗**、*斜体*、`代码` 中的内容。\n\n## 列表\n\n- 项目 1\n- 项目 2\n\n> 引用这里\n\n```js\nconsole.log("hello");\n```\n\n| 名称 | 值 |\n|----|----|\n| a | 1 |\n')

// 代码块高亮(通过自定义 renderer;marked 新版 renderer 回调收到 token 对象)
marked.use({
  renderer: {
    code(token) {
      const { text: code, lang } = token as { text: string; lang?: string }
      let htmlCode: string
      try {
        htmlCode = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value
      } catch {
        htmlCode = code
      }
      return `<pre><code class="hljs">${htmlCode}</code></pre>`
    },
  },
})

const html = computed(() => marked.parse(text.value, { async: false }) as string)

function copyHtml() {
  copyText(html.value)
  ElMessage.success('已复制 HTML')
}

function exportMd() {
  downloadText('doc.md', text.value)
}

function exportHtml() {
  const full = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>预览</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/default.css"></head>
<body>${html.value}</body></html>`
  downloadText('doc.html', full)
}

// 内置一些示例片段
const snippets = [
  { label: '1 级标题', ins: '# ' },
  { label: '二级标题', ins: '## ' },
  { label: '粗体', ins: '**粗体**' },
  { label: '斜体', ins: '*斜体*' },
  { label: '代码', ins: '`代码`' },
  { label: '代码块', ins: '```js\n\n```' },
  { label: '引用', ins: '> ' },
  { label: '链接', ins: '[文字](https://example.com)' },
  { label: '图片', ins: '![alt](https://picsum.photos/200/100)' },
  { label: '无序列表', ins: '- ' },
  { label: '有序列表', ins: '1. ' },
  { label: '表格', ins: '| A | B |\n|--|--|\n| 1 | 2 |' },
  { label: '分隔线', ins: '\n---\n' },
]

/** 把片段插入光标处 */
function insertAtCursor(sn: string) {
  const ta = document.querySelector('.mdta') as HTMLTextAreaElement | undefined
  const at = ta?.selectionStart ?? text.value.length
  text.value = text.value.slice(0, at) + sn + text.value.slice(at)
}
</script>

<template>
  <ToolPage>
    <template #title>Markdown 编辑器</template>
    <template #desc>左写右看的 Markdown 编辑器,支持语法高亮与代码块,可复制 HTML 或导出文件。</template>

    <el-card shadow="never" :body-style="{ padding: '0' }">
      <template #header>
        <div class="head">
          <div class="snips">
            <el-button v-for="s in snippets" :key="s.label" size="small" text @click="insertAtCursor(s.ins)">
              {{ s.label }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="layout">
        <div class="pane">
          <div class="pane-h"><span>Markdown</span>
            <div>
              <el-button size="small" text @click="text = ''">清空</el-button>
              <el-button size="small" text @click="exportMd">导出 .md</el-button>
            </div>
          </div>
          <textarea v-model="text" class="mono mdta textarea"></textarea>
        </div>
        <div class="pane">
          <div class="pane-h"><span>预览</span>
            <div>
              <el-button size="small" text @click="copyHtml">复制 HTML</el-button>
              <el-button size="small" text @click="exportHtml">导出 .html</el-button>
            </div>
          </div>
          <div class="md-body" v-html="html"></div>
        </div>
      </div>
    </el-card>
  </ToolPage>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.snips { display: flex; flex-wrap: wrap; gap: 2px; }
.layout { display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 440px; }
.pane { border-right: 1px solid var(--card-border); display: flex; flex-direction: column; min-height: 0; }
.pane:last-child { border-right: none; }
.pane-h {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-fill-color-light);
  font-size: 12px;
  border-bottom: 1px solid var(--card-border);
}
.textarea { flex: 1; border: none; padding: 12px; font-size: 13px; line-height: 1.7; resize: none; outline: none; background: transparent; }
.md-body { flex: 1; overflow: auto; padding: 12px; font-size: 13.5px; }
.md-body :deep(h1) { font-size: 24px; }
.md-body :deep(h2) { font-size: 20px; }
.md-body :deep(h1, h2, h3, h4) { margin: 12px 0 8px; }
.md-body :deep(p) { margin: 8px 0; }
.md-body :deep(pre) { padding: 10px; border-radius: 6px; overflow: auto; font-size: 12.5px; }
.md-body :deep(blockquote) { background: var(--el-fill-color-lighter); padding: 6px 10px; border-left: 3px solid var(--el-color-primary); }
.md-body :deep(table) { border-collapse: collapse; }
.md-body :deep(th, td) { border: 1px solid var(--card-border); padding: 4px 10px; }
</style>
