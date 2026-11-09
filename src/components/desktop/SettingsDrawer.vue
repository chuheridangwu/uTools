<script setup lang="ts">
/**
 * 设置抽屉(桌面模式):
 * 首页形态、壁纸、图标大小、毛玻璃、明暗主题、重置布局。
 */
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDesktopStore, WALLPAPERS, type WallpaperPreset } from '@/stores/desktop'
import { useAppStore } from '@/stores/app'

const visible = defineModel<boolean>({ required: true })
const desktop = useDesktopStore()
const appStore = useAppStore()

const presetList: { key: WallpaperPreset; label: string }[] = [
  { key: 'aurora', label: '极光' },
  { key: 'dawn', label: '晨曦' },
  { key: 'mist', label: '薄雾' },
  { key: 'forest', label: '松林' },
  { key: 'violet', label: '紫夜' },
]

const fileInput = ref<HTMLInputElement>()

function pickWallpaper(key: WallpaperPreset) {
  desktop.setWallpaper(key)
}

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  // 压缩到最长边 1600px 再存,避免 localStorage 爆掉
  const img = new Image()
  img.onload = () => {
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    try {
      const data = canvas.toDataURL('image/jpeg', 0.82)
      desktop.setWallpaper('custom', data)
      ElMessage.success('壁纸已更新')
    } catch {
      ElMessage.error('图片处理失败')
    }
  }
  img.src = URL.createObjectURL(file)
}

function switchMode(mode: 'classic' | 'desktop') {
  desktop.setMode(mode)
  ElMessage.success(mode === 'desktop' ? '已切换到桌面模式' : '已切换到经典模式')
}

async function resetLayout() {
  await ElMessageBox.confirm('将恢复默认的桌面图标与 Dock,壁纸保留。继续?', '重置桌面布局', { type: 'warning' })
  desktop.resetLayout()
  ElMessage.success('已重置')
}

function previewStyle(key: Exclude<WallpaperPreset, 'custom'>): string {
  return WALLPAPERS[key]
}
</script>

<template>
  <el-drawer v-model="visible" title="设置" size="380px">
    <div class="sec">
      <div class="sec-title">首页形态</div>
      <el-radio-group :model-value="desktop.mode" size="small" @update:model-value="switchMode($event as 'classic' | 'desktop')">
        <el-radio-button value="classic">经典列表</el-radio-button>
        <el-radio-button value="desktop">桌面模式</el-radio-button>
      </el-radio-group>
      <p class="tip">桌面模式即全屏桌面导航;经典模式是传统的侧边栏 + 卡片列表。</p>
    </div>

    <div class="sec">
      <div class="sec-title">壁纸</div>
      <div class="wall-grid">
        <button
          v-for="p in presetList"
          :key="p.key"
          class="wall"
          :class="{ on: desktop.wallpaper.preset === p.key }"
          :style="{ background: previewStyle(p.key as Exclude<WallpaperPreset, 'custom'>) }"
          :title="p.label"
          @click="pickWallpaper(p.key)"
        />
        <button
          v-if="desktop.wallpaper.preset === 'custom' && desktop.wallpaper.custom"
          class="wall on custom"
          :style="{ background: `center / cover no-repeat url(${desktop.wallpaper.custom})` }"
          title="自定义壁纸"
        />
        <button class="wall upload" @click="fileInput?.click()">＋ 上传</button>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onUpload" />
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">图标大小</div>
      <el-radio-group :model-value="desktop.iconSize" size="small" @update:model-value="desktop.setIconSize($event as 's' | 'm' | 'l')">
        <el-radio-button value="s">小</el-radio-button>
        <el-radio-button value="m">中</el-radio-button>
        <el-radio-button value="l">大</el-radio-button>
      </el-radio-group>
    </div>

    <div class="sec">
      <div class="sec-title">外观</div>
      <div class="row-between">
        <span class="row-label">暗色主题</span>
        <el-switch :model-value="appStore.dark" @update:model-value="appStore.toggleDark($event as boolean)" />
      </div>
      <div class="row-between">
        <span class="row-label">毛玻璃效果</span>
        <el-switch v-model="desktop.glass" @update:model-value="desktop.persist()" />
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">维护</div>
      <el-button size="small" @click="resetLayout">重置桌面布局</el-button>
      <p class="tip">桌面布局、Dock、壁纸、收藏等全部保存在本机浏览器,不会上传。</p>
    </div>
  </el-drawer>
</template>

<style scoped>
.sec {
  margin-bottom: 22px;
}
.sec-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.tip {
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.wall-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.wall {
  height: 56px;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  background-size: cover;
}
.wall.on {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
.wall.upload {
  display: grid;
  place-items: center;
  border: 1px dashed var(--card-border);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color-light);
}
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.row-label {
  font-size: 13px;
}
</style>
