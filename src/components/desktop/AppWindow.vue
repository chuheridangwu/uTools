<script setup lang="ts">
/**
 * 桌面模式的应用窗口:毛玻璃全屏浮层,顶部标题栏 + 关闭按钮,
 * 内容按 appKey 懒加载:
 *  - kind=tool → 站内工具视图(import.meta.glob 与 router 同源)
 *  - kind=app  → 统一应用目录(CATALOG_MAP)注册的组件
 */
import { computed, defineAsyncComponent, ref, watch, type Component } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { useDesktopStore } from '@/stores/desktop'
import { CATALOG_MAP } from '@/config/appCatalog'
import { TOOL_MAP } from '@/config/tools'

const props = defineProps<{ visible: boolean; appKey: string }>()
const emit = defineEmits<{ close: [] }>()

const desktop = useDesktopStore()
const item = computed(() => desktop.items.find((i) => i.key === props.appKey))

const kind = computed(() => item.value?.kind ?? (CATALOG_MAP.get(props.appKey)?.kind ?? 'tool'))
const title = computed(() => item.value?.name ?? TOOL_MAP.get(props.appKey)?.name ?? CATALOG_MAP.get(props.appKey)?.name ?? '')

const viewModules = import.meta.glob('../../views/*.vue')

/* 异步组件缓存:按 key 建一次 defineAsyncComponent */
const cache = new Map<string, Component>()
const resolved = computed<Component | null>(() => {
  if (!props.visible || !props.appKey) return null
  const ck = kind.value + ':' + props.appKey
  if (!cache.has(ck)) {
    if (kind.value === 'app') {
      const meta = CATALOG_MAP.get(props.appKey)
      if (!meta) return null
      cache.set(ck, defineAsyncComponent(meta.comp as () => Promise<Component>))
    } else {
      const pascal = props.appKey.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
      const loader = viewModules[`../../views/${pascal}.vue`]
      if (!loader) return null
      cache.set(ck, defineAsyncComponent(loader as () => Promise<Component>))
    }
  }
  return cache.get(ck) ?? null
})

/* 切换 key 时短暂显示加载态 */
const loading = ref(false)
watch(() => [props.visible, props.appKey] as const, async ([v]) => {
  if (!v) return
  loading.value = true
  await new Promise((r) => setTimeout(r, 120))
  loading.value = false
}, { immediate: true })
</script>

<template>
  <teleport to="body">
    <transition name="win">
      <div v-if="visible" class="win-overlay" @click.self="emit('close')">
        <div class="win glass-win">
          <div class="win-bar">
            <span class="win-dot red" @click="emit('close')" />
            <span class="win-dot yellow" />
            <span class="win-dot green" />
            <span class="win-title">{{ title }}</span>
            <el-button text circle size="small" @click="emit('close')">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div class="win-body">
            <div v-if="loading" class="win-loading">加载中…</div>
            <component :is="resolved" v-else-if="resolved" />
            <div v-else class="win-loading">应用不存在</div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.win-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: rgb(0 0 0 / 45%);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 4vw;
}
.win {
  width: 100%;
  max-width: 1100px;
  height: 100%;
  max-height: 88vh;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  box-shadow: 0 24px 80px rgb(0 0 0 / 40%);
}
.glass-win {
  border: 1px solid var(--card-border);
}
.win-bar {
  height: 42px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-bottom: 1px solid var(--card-border);
  background: var(--el-bg-color);
}
.win-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  cursor: pointer;
}
.win-dot.red { background: #ff5f57; }
.win-dot.yellow { background: #febc2e; }
.win-dot.green { background: #28c840; }
.win-title {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.win-title + .el-button {
  margin-left: auto;
}
.win-body {
  flex: 1;
  overflow: auto;
  padding: 16px 18px;
  min-height: 0;
}
.win-loading {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.win-enter-active,
.win-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.win-enter-from,
.win-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
