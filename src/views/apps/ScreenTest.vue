<script setup lang="ts">
/**
 * 屏幕与键盘检测
 * 屏幕坏点检测:切换红/绿/蓝/白/黑等纯色全屏,检查亮点暗点;
 * 键盘测试:按下按键实时高亮,检测失灵或连击。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const tab = ref<'screen' | 'keyboard'>('screen')

/* ------------------------------ 屏幕坏点 ------------------------------ */
const COLORS = [
  { name: '红', c: '#ff0000' },
  { name: '绿', c: '#00ff00' },
  { name: '蓝', c: '#0000ff' },
  { name: '白', c: '#ffffff' },
  { name: '黑', c: '#000000' },
  { name: '黄', c: '#ffff00' },
  { name: '青', c: '#00ffff' },
  { name: '品红', c: '#ff00ff' },
  { name: '灰', c: '#808080' },
]
const activeColor = ref('')
const fsRef = ref<HTMLDivElement>()

async function enterFullscreen(c: string) {
  activeColor.value = c
  try {
    await fsRef.value?.requestFullscreen()
  } catch {
    /* 用户或环境不允许全屏,仍以覆盖层显示 */
  }
}

function exitFullscreen() {
  activeColor.value = ''
  if (document.fullscreenElement) void document.exitFullscreen()
}

function onFsChange() {
  if (!document.fullscreenElement) activeColor.value = ''
}

/* ------------------------------ 键盘测试 ------------------------------ */
interface KeyHit {
  code: string
  label: string
  count: number
  active: boolean
}
const hits = ref<Map<string, KeyHit>>(new Map())
const pressed = ref<string[]>([])

function labelOf(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Meta')
  let key = e.key
  if (key === ' ') key = 'Space'
  if (e.code.startsWith('Digit')) key = e.code.replace('Digit', '')
  if (e.code.startsWith('Key')) key = e.code.replace('Key', '')
  parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts.join(' + ')
}

function onKeyDown(e: KeyboardEvent) {
  if (tab.value !== 'keyboard') return
  e.preventDefault()
  const map = hits.value
  const prev = map.get(e.code)
  map.set(e.code, {
    code: e.code,
    label: labelOf(e),
    count: (prev?.count || 0) + 1,
    active: true,
  })
  hits.value = new Map(map)
  pressed.value = [...new Set([...pressed.value, labelOf(e)])]
}

function onKeyUp(e: KeyboardEvent) {
  if (tab.value !== 'keyboard') return
  const map = hits.value
  const prev = map.get(e.code)
  if (prev) {
    map.set(e.code, { ...prev, active: false })
    hits.value = new Map(map)
  }
}

function clearHits() {
  hits.value = new Map()
  pressed.value = []
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('fullscreenchange', onFsChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('fullscreenchange', onFsChange)
})
</script>

<template>
  <div class="st">
    <div class="head">
      <div>
        <h3 class="title">屏幕与键盘检测</h3>
        <p class="sub">检查显示器坏点与键盘按键,排查硬件小问题</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="screen">屏幕坏点</el-radio-button>
        <el-radio-button value="keyboard">键盘测试</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 屏幕 -->
    <div v-if="tab === 'screen'" class="screen-tab">
      <p class="tip">点击下方色块进入全屏纯色查看。仔细检查是否有异常的亮点或暗点,检查完按 Esc 或点击退出。</p>
      <div class="swatches">
        <button
          v-for="c in COLORS"
          :key="c.c"
          class="sw"
          :style="{ background: c.c }"
          :title="c.name"
          @click="enterFullscreen(c.c)"
        />
      </div>
    </div>

    <!-- 键盘 -->
    <div v-else class="kb-tab">
      <div class="kb-stat">
        <span>已测按键:<b>{{ hits.size }}</b></span>
        <span>当前按下:<b>{{ pressed.join(', ') || '—' }}</b></span>
        <el-button size="small" text @click="clearHits">清空</el-button>
      </div>
      <div class="kb-hint">在下方区域按下任意键(建议先点击本窗口使其获得焦点)</div>
      <div class="keys" tabindex="0">
        <div v-for="h in [...hits.values()]" :key="h.code" class="key" :class="{ on: h.active }">
          <span class="k-label">{{ h.label }}</span>
          <span class="k-count">×{{ h.count }}</span>
        </div>
        <div v-if="!hits.size" class="keys-empty">还没有检测到按键</div>
      </div>
    </div>

    <!-- 全屏纯色覆盖层 -->
    <div
      v-if="activeColor"
      ref="fsRef"
      class="fullscreen"
      :style="{ background: activeColor }"
      @click="exitFullscreen"
    >
      <span class="fs-hint">点击退出 (Esc)</span>
    </div>
  </div>
</template>

<style scoped>
.st {
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
.tip {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin: 0 0 16px;
}
.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
}
.sw {
  height: 72px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  cursor: pointer;
  transition: transform 0.15s;
}
.sw:hover {
  transform: translateY(-3px);
}
.kb-stat {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.kb-stat b {
  color: var(--el-color-primary);
}
.kb-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 14px;
}
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 160px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 14px;
  outline: none;
}
.key {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 56px;
  padding: 8px 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--el-bg-color);
  transition: all 0.1s;
}
.key.on {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
  transform: translateY(1px);
}
.k-label {
  font-size: 13px;
  font-weight: 600;
}
.k-count {
  font-size: 10px;
  opacity: 0.7;
}
.keys-empty {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  align-self: center;
  margin: auto;
}
.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
}
.fs-hint {
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgb(0 0 0 / 45%);
  color: #fff;
}
</style>
