<script setup lang="ts">
/**
 * 添加 App 整页(P3,仿找Tab /add-app)
 * 粘贴网址 → 自动识别名称与 favicon → 选图标/emoji/标签 → 预览 → 添加到桌面。
 * 传入 site 时复用同一表单做「编辑网站快捷方式」。
 */
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Link } from '@element-plus/icons-vue'
import { ALL_TAGS } from '@/config/appCatalog'
import { useDesktopStore, type DesktopItem } from '@/stores/desktop'
import { copyText } from '@/utils/common'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{
  site?: DesktopItem | null
  initialUrl?: string
  initialName?: string
}>(), { site: null, initialUrl: '', initialName: '' })

const emit = defineEmits<{ close: []; added: [] }>()
const desktop = useDesktopStore()

const form = reactive({
  name: '',
  url: '',
  iconUrl: '',
  emoji: '',
  accent: '#667eea',
  tags: [] as string[],
})
const customTag = ref('')
const previewIconUrl = ref('')
const tagOptions = ALL_TAGS.filter((t) => t !== '全部')
const swatches = ['#667eea', '#f59e0b', '#22c55e', '#ec4899', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6']

watch(
  () => [props.site, props.initialUrl, props.initialName] as const,
  ([site, initialUrl, initialName]) => {
    form.name = site?.name ?? initialName ?? ''
    form.url = site?.url ?? initialUrl ?? ''
    form.iconUrl = site?.iconUrl ?? ''
    form.emoji = site?.emoji ?? ''
    form.accent = site?.accent ?? '#667eea'
    form.tags = [...(site?.tags ?? [])]
  },
  { immediate: true },
)

/** 只把能成功加载的图标 URL 用于预览与保存,避免桌面上出现空白图标 */
watch(() => form.iconUrl, (v) => {
  const url = v.trim()
  if (!url) { previewIconUrl.value = ''; return }
  const img = new Image()
  img.onload = () => { if (form.iconUrl.trim() === url) previewIconUrl.value = url }
  img.onerror = () => { if (form.iconUrl.trim() === url) previewIconUrl.value = '' }
  img.src = url
}, { immediate: true })

const isEditing = computed(() => Boolean(props.site))

/** 从网址推导名称与 favicon */
function deriveFromUrl() {
  const raw = form.url.trim()
  if (!raw) return
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return
  }
  if (!form.name.trim()) {
    const host = u.hostname.replace(/^www\./, '')
    const first = host.split('.')[0]
    form.name = first.charAt(0).toUpperCase() + first.slice(1)
  }
  if (!form.iconUrl.trim()) form.iconUrl = `${u.origin}/favicon.ico`
}

function toggleTag(t: string) {
  form.tags = form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]
}
function addCustomTag() {
  const t = customTag.value.trim()
  if (!t) return
  if (!form.tags.includes(t)) form.tags = [...form.tags, t]
  customTag.value = ''
}

const canSubmit = computed(() => Boolean(form.name.trim() && form.url.trim()))

function submit() {
  if (!canSubmit.value) {
    ElMessage.warning('名称和网址都要填')
    return
  }
  const payload = {
    iconUrl: previewIconUrl.value,
    emoji: form.emoji.trim(),
    accent: form.accent,
    tags: [...form.tags],
  }
  if (props.site) {
    desktop.editSite(props.site.key, { name: form.name.trim(), url: form.url.trim(), ...payload })
    ElMessage.success('已保存修改')
  } else {
    desktop.addSite(form.name.trim(), form.url.trim(), payload)
    ElMessage.success(`已添加「${form.name.trim()}」到桌面`)
  }
  emit('added')
  emit('close')
}

/** 书签小工具:在任意网页点一下,带着网址与标题跳回本页添加 */
const bookmarklet = computed(() =>
  `javascript:(function(){location.href='${window.location.origin}/?add='+encodeURIComponent(location.href)+'&name='+encodeURIComponent(document.title)})()`,
)

async function copyBookmarklet() {
  const ok = await copyText(bookmarklet.value)
  ElMessage[ok ? 'success' : 'error'](ok ? '已复制,粘贴到浏览器书签的网址栏即可' : '复制失败')
}
</script>

<template>
  <div class="zt-page">
    <header class="zt-head">
      <button class="zt-back" title="返回桌面" @click="emit('close')">
        <el-icon :size="18"><ArrowLeft /></el-icon>
      </button>
      <div>
        <h1 class="zt-h1">{{ isEditing ? '编辑 App' : '添加 App' }}</h1>
        <div class="zt-sub">粘贴网址,自动识别名称和图标,一键放到桌面</div>
      </div>
    </header>

    <div class="zt-page-inner add-layout">
      <div class="zt-card">
        <div class="zt-form-row">
          <label class="zt-label">网址</label>
          <div class="zt-inline">
            <input v-model="form.url" class="zt-input url-input" placeholder="https://example.com" @blur="deriveFromUrl" />
            <button class="zt-btn" @click="deriveFromUrl">获取图标</button>
          </div>
          <div class="zt-hint">未填协议时自动补 https://;图标取站点 /favicon.ico,加载失败会回退到 emoji / 首字母</div>
        </div>

        <div class="zt-form-row">
          <label class="zt-label">名称</label>
          <input v-model="form.name" class="zt-input" placeholder="如:公司邮箱" />
        </div>

        <div class="zt-form-row">
          <label class="zt-label">图标 URL 或直接输入 emoji</label>
          <div class="zt-inline">
            <input v-model="form.iconUrl" class="zt-input icon-input" placeholder="https://example.com/favicon.ico" />
            <input v-model="form.emoji" class="zt-input emoji-input" placeholder="🌈" />
          </div>
          <div class="zt-hint" :class="{ warn: form.iconUrl.trim() && !previewIconUrl }">
            {{ form.iconUrl.trim() && !previewIconUrl ? '图标无法加载,将使用 emoji 或名称首字母' : '图标 URL 优先级高于 emoji' }}
          </div>
        </div>

        <div class="zt-form-row">
          <label class="zt-label">主题色</label>
          <div class="zt-inline">
            <button
              v-for="c in swatches"
              :key="c"
              class="swatch"
              :class="{ on: form.accent === c }"
              :style="{ background: c }"
              :title="c"
              @click="form.accent = c"
            />
          </div>
        </div>

        <div class="zt-form-row">
          <label class="zt-label">标签(可多选)</label>
          <div class="zt-chips tag-chips">
            <button
              v-for="t in tagOptions"
              :key="t"
              class="zt-chip"
              :class="{ on: form.tags.includes(t) }"
              @click="toggleTag(t)"
            >{{ t }}</button>
          </div>
          <input
            v-model="customTag"
            class="zt-input"
            placeholder="自定义标签,回车添加"
            @keydown.enter.prevent="addCustomTag"
          />
        </div>
      </div>

      <div class="zt-card preview-card">
        <div class="zt-card-title">预览</div>
        <div class="zt-card-desc">这就是它放到桌面后的样子</div>
        <div class="preview">
          <AppIcon
            :name="form.name || '新应用'" :accent="form.accent"
            :emoji="form.emoji" :icon-url="previewIconUrl" :size="76" :font-size="38"
          />
          <div class="preview-name">{{ form.name || '新应用' }}</div>
          <div class="preview-url">{{ form.url || 'https://…' }}</div>
          <div v-if="form.tags.length" class="preview-tags">
            <span v-for="t in form.tags" :key="t" class="tag">{{ t }}</span>
          </div>
        </div>
        <button class="zt-btn primary submit" :disabled="!canSubmit" @click="submit">
          <el-icon><Link /></el-icon>{{ isEditing ? '保存修改' : '添加到桌面' }}
        </button>
      </div>

      <div class="zt-card">
        <div class="zt-card-title">浏览器插件 / 书签小工具</div>
        <div class="zt-card-desc">把下面这段代码存成浏览器书签,在任意网页点一下即可带着网址跳回来添加</div>
        <div class="zt-inline">
          <code class="code">{{ bookmarklet }}</code>
          <button class="zt-btn" @click="copyBookmarklet">复制</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-layout { max-width: 860px; }
.url-input { flex: 1; min-width: 220px; }
.icon-input { flex: 1; min-width: 220px; }
.emoji-input { width: 92px; flex: none; text-align: center; }
.tag-chips { margin-bottom: 10px; }
.warn { color: #f59e0b; }
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: var(--zt-shadow);
}
.swatch.on { outline: 2px solid var(--zt-brand); outline-offset: 2px; }
.preview { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 0 22px; }
.preview-name { font-size: 14px; font-weight: 700; }
.preview-url { font-size: 11px; color: var(--zt-sub); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-tags { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
.tag { font-size: 10px; color: var(--zt-sub); background: var(--zt-soft); border-radius: 6px; padding: 1px 6px; }
.submit { width: 100%; height: 40px; }
.code {
  flex: 1;
  min-width: 0;
  padding: 10px;
  border-radius: 9px;
  background: var(--zt-soft);
  border: 1px solid var(--zt-border);
  font-size: 11px;
  word-break: break-all;
  line-height: 1.5;
  color: var(--zt-sub);
}
</style>
