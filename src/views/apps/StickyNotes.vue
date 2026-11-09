<script setup lang="ts">
/**
 * 便签墙
 * 彩色便签,随手记想法 / 待办,支持改色、删除与本地持久化,
 * 无需登录,数据仅存本机浏览器。
 */
import { onMounted, reactive, ref } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Note {
  id: string
  text: string
  color: string
  ts: number
}

const COLORS = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#ffedd5']
const KEY = 'utools_stickynotes'

const notes = reactive<{ list: Note[] }>({ list: [] })

function add() {
  notes.list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    text: '',
    color: COLORS[notes.list.length % COLORS.length],
    ts: Date.now(),
  })
  save()
}

function remove(id: string) {
  notes.list = notes.list.filter((n) => n.id !== id)
  save()
}

function cycleColor(n: Note) {
  const i = COLORS.indexOf(n.color)
  n.color = COLORS[(i + 1) % COLORS.length]
  save()
}

let timer: number | null = null
function save() {
  if (timer) clearTimeout(timer)
  timer = window.setTimeout(() => localStorage.setItem(KEY, JSON.stringify(notes.list)), 300)
}

function fmt(ts: number): string {
  const d = new Date(ts)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(() => {
  try {
    notes.list = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    notes.list = []
    ElMessage.warning('本地便签数据解析失败,已重置')
  }
})
</script>

<template>
  <div class="sn">
    <div class="head">
      <div>
        <h3 class="title">便签墙</h3>
        <p class="sub">共 {{ notes.list.length }} 张便签 · 内容自动保存到本机</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="add">新建便签</el-button>
    </div>

    <div class="board">
      <div
        v-for="n in notes.list"
        :key="n.id"
        class="note"
        :style="{ background: n.color }"
      >
        <textarea v-model="n.text" class="note-text" placeholder="写点什么…" @input="save" />
        <div class="note-foot">
          <span class="note-time">{{ fmt(n.ts) }}</span>
          <span class="note-acts">
            <el-button text size="small" @click="cycleColor(n)" title="换颜色">🎨</el-button>
            <el-button text size="small" :icon="Delete" @click="remove(n.id)" />
          </span>
        </div>
      </div>
      <div v-if="!notes.list.length" class="empty" @click="add">点击「新建便签」开始记录想法</div>
    </div>
  </div>
</template>

<style scoped>
.sn {
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
.board {
  columns: 3 200px;
  column-gap: 14px;
}
.note {
  break-inside: avoid;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
  box-shadow: 0 3px 10px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: column;
  min-height: 130px;
}
.note-text {
  flex: 1;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  font-size: 14px;
  line-height: 1.6;
  color: #374151;
  min-height: 80px;
  font-family: inherit;
}
.note-text::placeholder {
  color: #9ca3af;
}
.note-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.note-time {
  font-size: 11px;
  color: #6b7280;
}
.note-acts {
  display: flex;
  gap: 2px;
}
.empty {
  text-align: center;
  padding: 50px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  cursor: pointer;
}
</style>
