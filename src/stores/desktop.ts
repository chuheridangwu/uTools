/**
 * 桌面模式状态(Pinia)
 * 模仿找Tab 的「桌面式起始页」:
 *  - mode:首页形态(classic=经典列表 / desktop=桌面模式)
 *  - desktopItems:桌面上的图标(站内工具 / 新应用 / 自定义网站),有序可拖拽
 *  - dock:固定到底部 Dock 的图标 key
 *  - wallpaper / iconSize / themeFollow:外观设置
 * 桌面模式下不走路由跳转:工具与应用都渲染在 AppWindow 浮层里。
 */
import { defineStore } from 'pinia'
import { storage } from '@/utils/common'
import { TOOL_MAP } from '@/config/tools'
import { APP_MAP, type DesktopAppMeta } from '@/config/desktopApps'

export type DesktopKind = 'tool' | 'app' | 'site'

export interface DesktopItem {
  key: string
  kind: DesktopKind
  name: string
  icon: string        // Element Plus 图标名;site 类型用首字母
  accent: string      // 主题色
  url?: string        // site 类型:跳转网址
}

export type WallpaperPreset = 'aurora' | 'dawn' | 'mist' | 'forest' | 'violet' | 'custom'

export const WALLPAPERS: Record<Exclude<WallpaperPreset, 'custom'>, string> = {
  aurora: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #312e81 100%)',
  dawn: 'linear-gradient(135deg, #fda085 0%, #f6d365 55%, #a8edea 100%)',
  mist: 'linear-gradient(180deg, #e0f2fe 0%, #93c5fd 60%, #bfdbfe 100%)',
  forest: 'linear-gradient(135deg, #022c22 0%, #065f46 55%, #0a4d3a 100%)',
  violet: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)',
}

interface DesktopState {
  mode: 'classic' | 'desktop'
  items: DesktopItem[]
  dock: string[]
  wallpaper: { preset: WallpaperPreset; custom?: string }
  iconSize: 's' | 'm' | 'l'
  glass: boolean
  showLabels: boolean
  doubleClickOpen: boolean
  showClock: boolean
}

/** 默认桌面:全部站内工具 + 全部新应用(首次进入时种子) */
function seedItems(): DesktopItem[] {
  const tools: DesktopItem[] = [...TOOL_MAP.values()].map((t) => ({
    key: t.key,
    kind: 'tool' as const,
    name: t.name,
    icon: t.icon,
    accent: t.accent,
  }))
  const apps: DesktopItem[] = [...APP_MAP.values()].map((a: DesktopAppMeta) => ({
    key: a.key,
    kind: 'app' as const,
    name: a.name,
    icon: a.icon,
    accent: a.accent,
  }))
  return [...apps, ...tools]
}

export const useDesktopStore = defineStore('utools-desktop', {
  state: (): DesktopState => ({
    mode: storage.get<'classic' | 'desktop'>('desktop-mode', 'classic'),
    items: storage.get<DesktopItem[]>('desktop-items', seedItems()),
    dock: storage.get<string[]>('desktop-dock', ['lan-transfer', 'noise-mixer', 'clipboard']),
    wallpaper: storage.get<{ preset: WallpaperPreset; custom?: string }>('desktop-wallpaper', { preset: 'aurora' }),
    iconSize: storage.get<'s' | 'm' | 'l'>('desktop-icon-size', 'm'),
    glass: storage.get<boolean>('desktop-glass', true),
    showLabels: storage.get<boolean>('desktop-show-labels', true),
    doubleClickOpen: storage.get<boolean>('desktop-dblclick-open', false),
    showClock: storage.get<boolean>('desktop-show-clock', true),
  }),

  getters: {
    /** 壁纸 CSS background 值 */
    wallpaperStyle: (s): string => {
      if (s.wallpaper.preset === 'custom' && s.wallpaper.custom) return `center / cover no-repeat url(${s.wallpaper.custom})`
      return WALLPAPERS[s.wallpaper.preset as Exclude<WallpaperPreset, 'custom'>] ?? WALLPAPERS.aurora
    },
    /** 图标网格尺寸 */
    iconPx: (s): number => (s.iconSize === 's' ? 44 : s.iconSize === 'l' ? 68 : 56),
    isOnDesktop: (s) => (key: string) => s.items.some((i) => i.key === key),
    isDocked: (s) => (key: string) => s.dock.includes(key),
  },

  actions: {
    persist() {
      storage.set('desktop-mode', this.mode)
      storage.set('desktop-items', this.items)
      storage.set('desktop-dock', this.dock)
      storage.set('desktop-wallpaper', this.wallpaper)
      storage.set('desktop-icon-size', this.iconSize)
      storage.set('desktop-glass', this.glass)
      storage.set('desktop-show-labels', this.showLabels)
      storage.set('desktop-dblclick-open', this.doubleClickOpen)
      storage.set('desktop-show-clock', this.showClock)
    },

    setMode(mode: DesktopState['mode']) {
      this.mode = mode
      this.persist()
    },

    /** 商店添加:站内工具或新应用 */
    addTool(key: string) {
      if (this.isOnDesktop(key)) return
      const tool = TOOL_MAP.get(key)
      if (tool) {
        this.items.push({ key: tool.key, kind: 'tool', name: tool.name, icon: tool.icon, accent: tool.accent })
      } else {
        const app = APP_MAP.get(key)
        if (app) this.items.push({ key: app.key, kind: 'app', name: app.name, icon: app.icon, accent: app.accent })
      }
      this.persist()
    },

    /** 手动添加网站快捷方式 */
    addSite(name: string, url: string) {
      const normalized = /^https?:\/\//.test(url) ? url : `https://${url}`
      let key = 'site-' + Date.now().toString(36)
      while (this.items.some((i) => i.key === key)) key += 'x'
      this.items.push({ key, kind: 'site', name, icon: '', accent: '#0ea5e9', url: normalized })
      this.persist()
    },

    /** 从桌面移除 */
    remove(key: string) {
      this.items = this.items.filter((i) => i.key !== key)
      this.dock = this.dock.filter((k) => k !== key)
      this.persist()
    },

    /** 拖拽排序:把 from 位置的项移动到 to 位置 */
    move(from: number, to: number) {
      if (from === to || from < 0 || to < 0 || from >= this.items.length || to >= this.items.length) return
      const [it] = this.items.splice(from, 1)
      this.items.splice(to, 0, it)
      this.persist()
    },

    toggleDock(key: string) {
      this.dock = this.dock.includes(key) ? this.dock.filter((k) => k !== key) : [...this.dock, key]
      this.persist()
    },

    setWallpaper(preset: WallpaperPreset, custom?: string) {
      this.wallpaper = { preset, custom }
      this.persist()
    },

    setIconSize(size: DesktopState['iconSize']) {
      this.iconSize = size
      this.persist()
    },

    setGlass(v: boolean) {
      this.glass = v
      this.persist()
    },

    setShowLabels(v: boolean) {
      this.showLabels = v
      this.persist()
    },

    setDoubleClickOpen(v: boolean) {
      this.doubleClickOpen = v
      this.persist()
    },

    setShowClock(v: boolean) {
      this.showClock = v
      this.persist()
    },

    /** 导出当前桌面配置为 JSON 字符串 */
    exportConfig(): string {
      return JSON.stringify(
        {
          version: 1,
          items: this.items,
          dock: this.dock,
          wallpaper: this.wallpaper,
          iconSize: this.iconSize,
          glass: this.glass,
          showLabels: this.showLabels,
          doubleClickOpen: this.doubleClickOpen,
          showClock: this.showClock,
        },
        null,
        2,
      )
    },

    /** 导入桌面配置(宽松校验,忽略未知字段) */
    importConfig(json: string): boolean {
      try {
        const c = JSON.parse(json)
        if (Array.isArray(c.items)) this.items = c.items
        if (Array.isArray(c.dock)) this.dock = c.dock
        if (c.wallpaper && typeof c.wallpaper.preset === 'string') this.wallpaper = c.wallpaper
        if (c.iconSize === 's' || c.iconSize === 'm' || c.iconSize === 'l') this.iconSize = c.iconSize
        if (typeof c.glass === 'boolean') this.glass = c.glass
        if (typeof c.showLabels === 'boolean') this.showLabels = c.showLabels
        if (typeof c.doubleClickOpen === 'boolean') this.doubleClickOpen = c.doubleClickOpen
        if (typeof c.showClock === 'boolean') this.showClock = c.showClock
        this.persist()
        return true
      } catch {
        return false
      }
    },

    /** 重置桌面布局(保留模式与壁纸) */
    resetLayout() {
      this.items = seedItems()
      this.dock = ['lan-transfer', 'noise-mixer', 'clipboard']
      this.persist()
    },
  },
})
