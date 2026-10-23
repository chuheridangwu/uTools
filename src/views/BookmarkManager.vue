<script setup lang="ts">
/**
 * 书签管理
 * 解析浏览器导出的 HTML 书签(Netscape bookmark 格式),支持搜索/分类浏览/编辑添加,数据保存到 localStorage。
 */
import type { UploadFile } from 'element-plus'
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'

// Netscape bookmark 格式:<DL><DT><H3>文件夹</H3><DL>... <DT><A HREF="">名</A>
interface Bookmark {
  id: string
  title: string
  url: string
  folder: string
  added?: string
}

const STORAGE_KEY = 'utools_bookmarks'
const bookmarks = ref<Bookmark[]>([])
const query = ref('')
const folderFilter = ref('全部')
const importing = ref(false)

const folders = computed(() => {
  const set = new Set<string>(['全部'])
  for (const b of bookmarks.value) if (b.folder) set.add(b.folder)
  return Array.from(set)
})

const filtered = computed(() =>
  bookmarks.value.filter((b) => {
    const okFolder = folderFilter.value === '全部' || b.folder === folderFilter.value
    const q = query.value.toLowerCase()
    const okQuery = !q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    return okFolder && okQuery
  }),
)

// 树形展示用的按文件夹分组
const grouped = computed(() => {
  const map = new Map<string, Bookmark[]>()
  for (const b of filtered.value) {
    const key = b.folder || '/'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([folder, items]) => ({ folder, items }))
})

/* ── 导入 ── */

function onFile(f: File) {
  const r = new FileReader()
  r.onload = () => importHtml(String(r.result))
  r.readAsText(f, 'utf-8')
}

function importHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let count = 0
  const walk = (dl: Element, path: string) => {
    for (const child of Array.from(dl.children)) {
      if (child.tagName === 'DT') {
        const h3 = child.querySelector(':scope > h3')
        const a = child.querySelector(':scope > a')
        if (h3) {
          // 文件夹:进入它的下一个 DL(通常在其子节点里,兼容不同浏览器)
          const sub = child.querySelector(':scope > dl') || child.nextElementSibling
          const name = `${h3.textContent?.trim()}`
          const nextPath = `${path}${path ? '/' : ''}${name}`
          if (sub && sub.tagName.toLowerCase() === 'dl') walk(sub, nextPath)
        } else if (a) {
          const url = a.getAttribute('href') || ''
          if (!url) continue
          const addedAttr = a.getAttribute('add_date')
          bookmarks.value.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${count++}`,
            title: a.textContent?.trim() || url,
            url,
            folder: path || '/',
            added: addedAttr ? new Date(parseInt(addedAttr, 10) * 1000).toISOString().slice(0, 10) : undefined,
          })
        }
      }
    }
  }
  const candidates = Array.from(doc.querySelectorAll('dl'))
  let collected = 0
  for (const c of candidates) {
    // 只处理顶层 DL,避免重复
    if (c.parentElement && c.parentElement.tagName !== 'BODY' && c.parentElement.tagName !== 'HTML') continue
    walk(c, '')
    collected++
  }
  if (!collected) return ElMessage.warning('未在 HTML 中找到书签结构(<DL>)')
  if (!bookmarks.value.length) return ElMessage.warning('没有解析到任何书签')
  ElMessage.success(`已导入 ${bookmarks.value.length} 条书签`)
}

/* ── 编辑 / 新增 ── */

const editing = ref<Bookmark | null>(null)
const formVisible = ref(false)

function openForm(b?: Bookmark) {
  editing.value = b ? { ...b } : { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: '', url: '', folder: '/' }
  formVisible.value = true
}

async function save() {
  if (!editing.value) return
  if (!editing.value.url.trim() || !/^https?:\/\//i.test(editing.value.url.trim())) {
    return ElMessage.warning('URL 需以 http(s):// 开头')
  }
  const idx = bookmarks.value.findIndex((b) => b.id === editing.value!.id)
  if (idx >= 0) bookmarks.value[idx] = editing.value
  else bookmarks.value.push(editing.value)
  formVisible.value = false
  persist()
}

async function removeOne(b: Bookmark) {
  await ElMessageBox.confirm('删除这条书签?', '确认', { type: 'warning' })
  bookmarks.value = bookmarks.value.filter((x) => x.id !== b.id)
  persist()
}

function clearAll() {
  ElMessageBox.confirm('清空所有书签?', '确认', { type: 'warning' }).then(() => {
    bookmarks.value = []
    persist()
  }).catch(() => 0)
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks.value))
}

onMounted(() => {
  try {
    bookmarks.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    bookmarks.value = []
  }
})

watch(bookmarks, persist, { deep: true })

/** 从书签 URL 中安全取出域名(模板中无法直接使用全局 URL 构造器) */
function hostOf(u: string): string {
  try {
    return new URL(u).hostname
  } catch {
    return u
  }
}

/** 简易导出为 Netscape HTML */
function exportHtml() {
  const lines = ['<!DOCTYPE NETSCAPE-bookmark-file-1>', '<HTML><META HTTP-EQUIV="Refresh" CONTENT="0;URL=javascript:">']
  lines.push('<TITLE>Bookmarks</TITLE>')
  lines.push('<H1>Bookmarks</H1>')
  lines.push('<DL><p>')
  const byFolder = new Map<string, Bookmark[]>()
  for (const b of bookmarks.value) {
    if (!byFolder.has(b.folder)) byFolder.set(b.folder, [])
    byFolder.get(b.folder)!.push(b)
  }
  for (const [folder, items] of byFolder) {
    if (folder !== '/') {
      lines.push(`   <DT><H3>${folder}</H3>`)
      lines.push('   <DL><p>')
    }
    for (const it of items) {
      lines.push(`      <DT><A HREF="${it.url}" ADD_DATE="${Date.now()}">${it.title}</A>`)
    }
    if (folder !== '/') lines.push('   </DL><p>')
  }
  lines.push('</DL><p></HTML>')
  const blob = new Blob([lines.join('\n')], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'bookmarks.html'
  a.click()
  URL.revokeObjectURL(a.href)
}

/** on-change 统一包装(模板内不便写泛型注解) */
const onUploadChange = (f: UploadFile) => onFile(f.raw as File)
</script>

<template>
  <ToolPage>
    <template #title>书签管理</template>
    <template #desc>导入浏览器导出的 HTML 书签,支持搜索/文件夹过滤/新增删除,数据保存在浏览器本地。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>操作</span>
          <el-button size="small" type="primary" plain @click="openForm()">新增书签</el-button>
        </div>
      </template>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-upload drag :auto-upload="false" :show-file-list="false" accept=".html,.htm" :on-change="onUploadChange">
            <div class="drop">拖入浏览器导出的书签 HTML</div>
          </el-upload>
        </el-col>
        <el-col :span="12">
          <div class="op">
            <el-button v-if="bookmarks.length" size="small" @click="exportHtml">导出为 HTML</el-button>
            <el-button v-if="bookmarks.length" size="small" type="danger" plain @click="clearAll">清空</el-button>
            <div class="muted small mt8">共 {{ bookmarks.length }} 条书签;数据保存在 localStorage。</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-if="bookmarks.length" shadow="never" class="mt12">
      <template #header>
        <div class="head">
          <span>{{ filtered.length }} / {{ bookmarks.length }} 条</span>
          <span class="inrow">
            <el-input v-model="query" size="small" placeholder="搜索标题或链接" style="width: 200px" clearable />
            <el-select v-model="folderFilter" size="small" style="width: 150px">
              <el-option v-for="f in folders" :key="f" :value="f" :label="f" />
            </el-select>
          </span>
        </div>
      </template>

      <div v-for="g in grouped" :key="g.folder" class="grp">
        <div class="gtitle mono">📁 {{ g.folder }}({{ g.items.length }})</div>
        <div v-for="b in g.items" :key="b.id" class="bi">
          <img class="fav" :src="`https://favicon.im/${hostOf(b.url)}`" alt="" onerror="this.style.display='none'" />
          <div class="flex1">
            <a class="bt" :href="b.url" target="_blank" rel="noopener">{{ b.title }}</a>
            <div class="bu small muted">{{ b.url }}</div>
          </div>
          <el-button size="small" text @click="openForm(b)">编辑</el-button>
          <el-button size="small" text type="danger" @click="removeOne(b)">删</el-button>
        </div>
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="editing ? (bookmarks.some(b => b.id === editing?.id) ? '编辑书签' : '新增书签') : '新增书签'" width="480px">
      <el-form label-width="60px" size="small">
        <el-form-item label="标题">
          <el-input v-model="editing!.title" />
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="editing!.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="文件夹">
          <el-input v-model="editing!.folder" placeholder="如 /开发/前端" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="formVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.drop { padding: 28px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.op { display: flex; flex-direction: column; gap: 8px; }
.inrow { display: flex; align-items: center; gap: 8px; }
.grp { margin-bottom: 14px; }
.gtitle { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.bi { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; transition: background 0.15s; }
.bi:hover { background: var(--el-fill-color-lighter); }
.fav { width: 18px; height: 18px; border-radius: 3px; flex-shrink: 0; }
.flex1 { flex: 1; min-width: 0; }
.bt { font-size: 13px; color: var(--el-color-primary); text-decoration: none; }
.bu { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.small { font-size: 11.5px; }
</style>
