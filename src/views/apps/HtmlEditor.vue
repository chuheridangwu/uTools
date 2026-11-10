<script setup lang="ts">
/**
 * HTML 编辑器
 * 左侧写 HTML(可混写 CSS / JS),右侧 iframe 实时预览;
 * 支持自动刷新与手动运行、示例模板、下载 .html 文件,全部本地渲染。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { CaretRight, Download, MagicStick, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const SAMPLE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
  h1 { color: #6366f1; }
  button { padding: 8px 18px; border: none; border-radius: 8px;
           background: #6366f1; color: #fff; cursor: pointer; }
  #t { font-size: 28px; color: #ec4899; }
</style>
</head>
<body>
  <h1>你好,HTML 编辑器</h1>
  <p id="t">0</p>
  <button onclick="n++ ; document.getElementById('t').textContent = n">点我 +1</button>
  <script>let n = 0<\/script>
</body>
</html>`

const editing = ref(false)
const code = ref(SAMPLE)
const auto = ref(true)
const iframeRef = ref<HTMLIFrameElement>()
const docLen = ref(0)

function run() {
  const f = iframeRef.value
  if (!f) return
  const html = code.value
  // 本地编辑器自己的代码,同源预览即可;仍拦弹窗 / 表单提交 / 顶级导航
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  f.srcdoc = html
  docLen.value = html.length
}

function insertSample() {
  code.value = SAMPLE
  if (auto.value) run()
}

function clearCode() {
  code.value = ''
  if (auto.value) run()
  ElMessage.success('已清空')
}

function download() {
  if (!code.value) {
    ElMessage.warning('内容为空')
    return
  }
  const blob = new Blob([code.value], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'index.html'
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已下载 index.html')
}

let t = 0

watch([code, auto], () => {
  if (!auto.value || editing.value) return
  window.clearTimeout(t)
  t = window.setTimeout(run, 600)
})

onUnmounted(() => window.clearTimeout(t))

onMounted(() => run())
</script>

<template>
  <div class="he">
    <div class="head">
      <div>
        <h3 class="title">HTML 编辑器</h3>
        <p class="sub">左写右看,HTML / CSS / JS 混写,本地 iframe 实时预览</p>
      </div>
      <div class="acts">
        <el-switch v-model="auto" size="small" active-text="自动刷新" />
        <el-button size="small" type="primary" :icon="CaretRight" @click="run">运行</el-button>
        <el-button size="small" :icon="Download" @click="download">下载 HTML</el-button>
        <el-button size="small" :icon="MagicStick" @click="insertSample">示例</el-button>
        <el-button size="small" :icon="Refresh" @click="clearCode">清空</el-button>
      </div>
    </div>

    <div class="cols">
      <el-input
        v-model="code"
        type="textarea"
        class="editor"
        :rows="20"
        spellcheck="false"
        placeholder="在这里编写 HTML…"
        @compositionstart="editing = true"
        @compositionend="editing = false"
      />
      <div class="pv-col">
        <div class="pv-head">
          <span>预览({{ docLen }} 字符)</span>
        </div>
        <iframe ref="iframeRef" class="pv" title="HTML 预览"></iframe>
      </div>
    </div>

    <p class="foot">说明:预览在本页同源沙箱 iframe 中渲染(拦弹窗 / 表单提交 / 顶级导航);自动刷新在停止输入约 0.6 秒后触发,也可手动点「运行」。</p>
  </div>
</template>

<style scoped>
.he {
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
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: stretch;
}
@media (max-width: 860px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.editor :deep(textarea) {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  height: 420px;
}
.pv-col {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
}
.pv-head {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
}
.pv {
  flex: 1;
  min-height: 420px;
  border: none;
  background: #fff;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
