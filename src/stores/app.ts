/**
 * 全局应用状态(Pinia)
 * 负责三件事:
 *  1. 明暗主题(持久化)
 *  2. 工具收藏(首页置顶展示)
 *  3. 最近使用(侧边栏快速访问)
 */
import { defineStore } from 'pinia'
import type { ToolMeta } from '@/types/tool'
import { TOOL_MAP } from '@/config/tools'
import { storage } from '@/utils/common'

interface AppState {
  dark: boolean
  favorites: string[]   // 收藏的工具 key
  recents: string[]     // 最近使用的工具 key(最多 8 个)
}

export const useAppStore = defineStore('utools-app', {
  state: (): AppState => ({
    dark: storage.get<boolean>('dark', false),
    favorites: storage.get<string[]>('favorites', ['json-viewer', 'timestamp', 'image-converter']),
    recents: storage.get<string[]>('recents', []),
  }),

  getters: {
    /** 收藏的工具元信息(过滤已下线的 key) */
    favoriteTools: (s): ToolMeta[] => s.favorites.map((k) => TOOL_MAP.get(k)).filter(Boolean) as ToolMeta[],
    /** 是否已收藏某工具 */
    isFavorite: (s) => (key: string) => s.favorites.includes(key),
  },

  actions: {
    /** 切换明暗主题并写入 <html>.dark(Element Plus 暗色模式要求的类名) */
    toggleDark(value?: boolean) {
      this.dark = value === undefined ? !this.dark : value
      document.documentElement.classList.toggle('dark', this.dark)
      storage.set('dark', this.dark)
    },

    /** 切换收藏状态 */
    toggleFavorite(key: string) {
      this.favorites = this.favorites.includes(key)
        ? this.favorites.filter((k) => k !== key)
        : [key, ...this.favorites]
      storage.set('favorites', this.favorites)
    },

    /** 记录一次工具访问(去重后放到最新) */
    visitTool(key: string) {
      this.recents = [key, ...this.recents.filter((k) => k !== key)].slice(0, 8)
      storage.set('recents', this.recents)
    },
  },
})
