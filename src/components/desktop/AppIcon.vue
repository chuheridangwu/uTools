<script setup lang="ts">
/**
 * 仿找Tab 的圆角应用图标(桌面 / Dock / 商店 / 设置共用)
 * 优先级:iconUrl → emoji → Element Plus 图标 → 名称首字。
 * 底色由 accent 生成一层柔和渐变,圆角风格随 iconStyle 切换。
 */
import { computed, ref, watch, type Component } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  name: string
  icon?: string
  accent?: string
  emoji?: string
  iconUrl?: string
  size?: number
  rounded?: boolean
  fontSize?: number
}>(), {
  icon: '',
  accent: '#667eea',
  emoji: '',
  iconUrl: '',
  size: 56,
  rounded: true,
  fontSize: 0,
})

function iconOf(name: string): Component {
  return (ElIcons as unknown as Record<string, Component>)[name] ?? ElIcons.Grid
}

const glyph = computed(() => props.icon ? iconOf(props.icon) : null)
const initial = computed(() => props.name.slice(0, 1).toUpperCase())
const px = computed(() => `${props.size}px`)
const iconSizeNum = computed(() => Math.round(props.fontSize || props.size * 0.46))
const iconPx = computed(() => `${iconSizeNum.value}px`)

/** 外链 favicon 可能离线/失效,失败后回退到 emoji、内置图标或首字,避免出现空白图标 */
const imgFailed = ref(false)
watch(() => props.iconUrl, () => { imgFailed.value = false }, { immediate: true })
function onImgError() { imgFailed.value = true }
const boxStyle = computed(() => ({
  width: px.value,
  height: px.value,
  borderRadius: props.rounded ? `${Math.round(props.size * 0.24)}px` : `${Math.round(props.size * 0.14)}px`,
  background: `linear-gradient(145deg, color-mix(in srgb, ${props.accent} 72%, #ffffff), ${props.accent} 72%, color-mix(in srgb, ${props.accent} 82%, #000000))`,
}))
</script>

<template>
  <div class="app-icon" :style="boxStyle">
    <img v-if="iconUrl && !imgFailed" :src="iconUrl" class="glyph-img" :alt="name" @error="onImgError" />
    <span v-else-if="emoji" class="glyph-emoji" :style="{ fontSize: iconPx }">{{ emoji }}</span>
    <el-icon v-else-if="glyph" :size="iconSizeNum" color="#fff">
      <component :is="glyph" />
    </el-icon>
    <span v-else class="glyph-letter" :style="{ fontSize: iconPx }">{{ initial }}</span>
  </div>
</template>

<style scoped>
.app-icon {
  display: grid;
  place-items: center;
  flex: none;
  color: #fff;
  box-shadow: 0 6px 16px rgb(15 23 42 / 22%), inset 0 1px 0 rgb(255 255 255 / 28%);
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.glyph-img {
  width: 72%;
  height: 72%;
  object-fit: contain;
  border-radius: 20%;
}
.glyph-emoji,
.glyph-letter {
  line-height: 1;
  font-weight: 700;
  color: #fff;
}
</style>
