<script setup lang="ts">
/**
 * 便签
 * 支持创建多条便签(标题+正文+优先级),本地 localStorage 保存,刷新不丢失;支持固定与归档。
 */
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolPage from '@/components/ToolPage.vue'

interface Note {
  id: string
  title: string
  body: string
  color: string
  pinned: boolean
  updatedAt: number
}

const STORAGE_KEY = 'utools_notes'
const notes = ref<Note[]>([])
const query = ref('')
const editing = ref<Note | null>(null)
const formVisible = ref(false)

const COLORS = ['#fef9c3', '#dcfce7', '#e0e7ff', '#fce7f3', '#ffe4e6', '#e0f2fe']

const filtered = computed(() =>
  notes.value
    .filter((n) => {
      const q = query.value.toLowerCase()
      return !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt),
)

function openForm(n?: Note) {
  editing.value = n
    ? { ...n }
    : { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: '', body: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], pinned: false, updatedAt: Date.now() }
  formVisible.value = true
}

function save() {
  if (!editing.value) return
  if (!editing.value.title.trim() && !editing.value.body.trim()) return ElMessage.warning('内容不能为空')
  editing.value.updatedAt = Date.now()
  const idx = notes.value.findIndex((n) => n.id === editing.value!.id)
  if (idx >= 0) notes.value[idx] = editing.value
  else notes.value.push(editing.value)
  formVisible.value = false
}

function removeOne(n: Note) {
  ElMessageBox.confirm('删除这条便签?', '确认', { type: 'warning' }).then(() => {
    notes.value = notes.value.filter((x) => x.id !== n.id)
  }).catch(() => 0)
}

function togglePin(n: Note) {
  const x = notes.value.find((y) => y.id === n.id)
  if (x) {
    x.pinned = !x.pinned
    x.updatedAt = Date.now()
  }
}

function fmtTime(t: number): string {
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  try {
    notes.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    notes.value = []
  }
})

watch(notes, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true })
</script>

<template>
  <ToolPage>
    <template #title>便签</template>
    <template #desc>轻量便签,支持标题/正文/颜色/置顶,数据保存在浏览器 localstorage,刷新不丢失。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span class="inrow">
            <el-input v-model="query" size="small" placeholder="搜索便签" style="width: 220px" clearable />
          </span>
          <el-button size="small" type="primary" @click="openForm()">新建便签</el-button>
        </div>
      </template>
      <el-empty v-if="!filtered.length" description="还没有便签,点右上角新建" />
      <div v-else class="grid">
        <div v-for="n in filtered" :key="n.id" class="note" :style="{ background: n.color }">
          <div class="nhead">
            <div class="mtitle">{{ n.title || '(无标题)' }}</div>
            <el-tag v-if="n.pinned" size="small" type="warning" effect="plain">置顶</el-tag>
          </div>
          <div class="mbody">{{ n.body || '(无正文)' }}</div>
          <div class="nfoot small muted">{{ fmtTime(n.updatedAt) }}</div>
          <div class="nops">
            <el-button size="small" text @click="togglePin(n)">{{ n.pinned ? '取消置顶' : '置顶' }}</el-button>
            <el-button size="small" text @click="openForm(n)">编辑</el-button>
            <el-button size="small" text type="danger" @click="removeOne(n)">删</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="editing && notes.some(n => n.id === editing?.id) ? '编辑便签' : '新建便签'" width="500px">
      <el-form label-width="60px" size="small">
        <el-form-item label="标题">
          <el-input v-model="editing!.title" placeholder="可选" />
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="editing!.body" type="textarea" :rows="7" placeholder="记录点什么..." />
        </el-form-item>
        <el-form-item label="颜色">
          <span
            v-for="c in COLORS"
            :key="c"
            class="sw"
            :style="{ background: c, outline: editing!.color === c ? '2px solid #6366f1' : 'none' }"
            @click="editing!.color = c"
          ></span>
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="editing!.pinned" />
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
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.inrow { display: flex; align-items: center; gap: 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.note { border-radius: 10px; padding: 12px; display: flex; flex-direction: column; min-height: 150px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08); }
.nhead { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.mtitle { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.mbody { margin-top: 8px; font-size: 13px; color: rgba(0, 0, 0, 0.7); flex: 1; white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.nfoot { margin-top: 10px; }
.nops { margin-top: 4px; display: flex; flex-direction: column; align-items: flex-start; gap: 0; }
.nops .el-button { padding: 2px 6px; }
.sw { width: 20px; height: 20px; border-radius: 50%; display: inline-block; margin-right: 6px; cursor: pointer; }
.small { font-size: 11px; }
</style>
