/**
 * 桌面模式状态 v2(Pinia)
 *
 * 设计要点(对齐找Tab 的数据模型):
 *  - 目录是静态的(src/config/appCatalog.ts),状态里只保存「用户选了哪些 key」。
 *    这样以后每次新增应用,老用户立刻能在商店看到,不会出现旧版
 *    `storage.get('desktop-items', seedItems())` 那种一次性快照永远不更新的问题。
 *  - 三种状态:已添加(desktopIds)/ 已隐藏(hiddenIds)/ 未添加(仅商店可见)。
 *    隐藏是可恢复的,不再像 v1 那样直接把条目删掉。
 *  - 自定义网站单独放在 customSites,支持图标 URL / emoji / 标签 / 编辑。
 *  - 整个状态以一个带 version 的对象保存,启动时自动从 v1 的多 key 配置迁移。
 */
import { defineStore } from 'pinia'
import { storage } from '@/utils/common'
import {
  ALL_TAGS,
  CATALOG,
  CATALOG_MAP,
  DEFAULT_DESKTOP_IDS,
  DEFAULT_DOCK_IDS,
  EXCLUDED_KEYS,
} from '@/config/appCatalog'
import { WALLPAPERS, wallpaperCss, type WallpaperPreset } from '@/config/wallpapers'

export { WALLPAPERS, type WallpaperPreset } from '@/config/wallpapers'

export const DESKTOP_STATE_VERSION = 2

export type DesktopKind = 'tool' | 'app' | 'site'

export interface DesktopItem {
  key: string
  kind: DesktopKind
  name: string
  icon: string        // Element Plus 图标名;site 类型为空
  accent: string
  url?: string        // site:跳转网址
  emoji?: string      // site:emoji 图标
  iconUrl?: string    // site:图标 URL
  short?: string
  desc?: string
  category?: string
  tags?: string[]
  isNew?: boolean
  isHot?: boolean
  needsLogin?: boolean
}

export interface CustomSite {
  key: string
  name: string
  url: string
  icon: string        // 兼容旧数据:emoji 或图标 URL 字符串
  iconUrl?: string
  emoji?: string
  accent: string
  tags: string[]
  createdAt: number
}

interface DesktopPrefs {
  wallpaper: { preset: WallpaperPreset; custom?: string }
  iconSize: 's' | 'm' | 'l'
  iconStyle: 'rounded' | 'square'
  glass: boolean
  showLabels: boolean
  doubleClickOpen: boolean
  showClock: boolean
  showDock: boolean
  doubleClickHide: boolean
}

interface DesktopState extends DesktopPrefs {
  version: number
  mode: 'classic' | 'desktop'
  desktopIds: string[]
  hiddenIds: string[]
  dockIds: string[]
  customSites: CustomSite[]
  /** 最近打开的应用 key(最新在前,最多 12 条) */
  recentIds: string[]
  /** 商店视图:网格 / 列表 */
  storeView: 'grid' | 'list'
}

/* ------------------------------------------------------------------ *
 * 默认值 / 迁移 / 清洗
 * ------------------------------------------------------------------ */

function defaultPrefs(): DesktopPrefs {
  return {
    wallpaper: { preset: 'purple-blue' },
    iconSize: 'm',
    iconStyle: 'rounded',
    glass: true,
    showLabels: true,
    doubleClickOpen: false,
    showClock: true,
    showDock: true,
    doubleClickHide: false,
  }
}

function defaults(): DesktopState {
  return {
    version: DESKTOP_STATE_VERSION,
    // 找Tab 式桌面为默认首页;经典列表模式仍可在「设置 → 首页形态」切回
    mode: 'desktop',
    desktopIds: [...DEFAULT_DESKTOP_IDS],
    hiddenIds: [],
    dockIds: [...DEFAULT_DOCK_IDS],
    customSites: [],
    recentIds: [],
    storeView: 'grid',
    ...defaultPrefs(),
  }
}

/** v1 的散落 key */
const LEGACY_KEYS = {
  mode: 'desktop-mode',
  items: 'desktop-items',
  dock: 'desktop-dock',
  wallpaper: 'desktop-wallpaper',
  iconSize: 'desktop-icon-size',
  glass: 'desktop-glass',
  showLabels: 'desktop-show-labels',
  doubleClickOpen: 'desktop-dblclick-open',
  showClock: 'desktop-show-clock',
}

function isSiteKey(key: string): boolean {
  return key.startsWith('site-')
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/** 清掉无效 key(已下架 / 明确排除 / 网站记录丢失),并去重 */
function sanitize(d: DesktopState): DesktopState {
  const siteKeys = new Set(d.customSites.map((s) => s.key))
  const valid = (k: string): boolean =>
    typeof k === 'string' && !EXCLUDED_KEYS.has(k) && (CATALOG_MAP.has(k) || (isSiteKey(k) && siteKeys.has(k)))
  d.desktopIds = uniq((d.desktopIds ?? []).filter(valid))
  d.hiddenIds = uniq((d.hiddenIds ?? []).filter((k) => CATALOG_MAP.has(k) && !EXCLUDED_KEYS.has(k)))
    .filter((k) => !d.desktopIds.includes(k))
  d.dockIds = uniq((d.dockIds ?? []).filter(valid))
  d.customSites = (d.customSites ?? []).filter((s) => s && typeof s.key === 'string' && isSiteKey(s.key))
  // 自定义网站若被清理掉记录,同步从桌面/Dock 移除
  d.desktopIds = d.desktopIds.filter((k) => !isSiteKey(k) || siteKeys.has(k))
  d.dockIds = d.dockIds.filter((k) => !isSiteKey(k) || siteKeys.has(k))
  // 最近打开只保留目录里仍存在的应用
  d.recentIds = uniq((d.recentIds ?? []).filter((k) => typeof k === 'string' && CATALOG_MAP.has(k))).slice(0, 12)
  d.storeView = d.storeView === 'list' ? 'list' : 'grid'
  // 兜底偏好字段
  const p = defaultPrefs()
  d.wallpaper = d.wallpaper?.preset ? d.wallpaper : p.wallpaper
  d.iconSize = ['s', 'm', 'l'].includes(d.iconSize) ? d.iconSize : p.iconSize
  d.iconStyle = d.iconStyle === 'square' ? 'square' : 'rounded'
  for (const k of ['glass', 'showLabels', 'doubleClickOpen', 'showClock', 'showDock', 'doubleClickHide'] as const) {
    if (typeof d[k] !== 'boolean') d[k] = p[k] as never
  }
  d.mode = d.mode === 'desktop' ? 'desktop' : 'classic'
  d.version = DESKTOP_STATE_VERSION
  return d
}

function readLegacyPrefs(): Partial<DesktopPrefs> & { mode?: DesktopState['mode'] } {
  const out: Partial<DesktopPrefs> & { mode?: DesktopState['mode'] } = {}
  const mode = storage.get<string | null>(LEGACY_KEYS.mode, null)
  if (mode === 'classic' || mode === 'desktop') out.mode = mode
  const wallpaper = storage.get<DesktopPrefs['wallpaper'] | null>(LEGACY_KEYS.wallpaper, null)
  if (wallpaper?.preset) out.wallpaper = wallpaper
  const iconSize = storage.get<string | null>(LEGACY_KEYS.iconSize, null)
  if (iconSize === 's' || iconSize === 'm' || iconSize === 'l') out.iconSize = iconSize
  const bools: [keyof DesktopPrefs, string][] = [
    ['glass', LEGACY_KEYS.glass],
    ['showLabels', LEGACY_KEYS.showLabels],
    ['doubleClickOpen', LEGACY_KEYS.doubleClickOpen],
    ['showClock', LEGACY_KEYS.showClock],
  ]
  for (const [field, key] of bools) {
    const v = storage.get<boolean | null>(key, null)
    if (typeof v === 'boolean') (out as Record<string, unknown>)[field] = v
  }
  return out
}

function migrateFromV1(): DesktopState | null {
  const oldItems = storage.get<DesktopItem[] | null>(LEGACY_KEYS.items, null)
  const oldDock = storage.get<string[] | null>(LEGACY_KEYS.dock, null)
  if (!Array.isArray(oldItems) || oldItems.length === 0) return null

  const customSites: CustomSite[] = oldItems
    .filter((i) => i && i.kind === 'site' && isSiteKey(i.key))
    .map((i) => ({
      key: i.key,
      name: i.name,
      url: i.url || 'https://example.com',
      icon: i.emoji || i.iconUrl || '',
      iconUrl: i.iconUrl,
      emoji: i.emoji,
      accent: i.accent || '#667eea',
      tags: i.tags || [],
      createdAt: Date.now(),
    }))

  const desktopIds = oldItems.map((i) => i.key).filter((k) => typeof k === 'string')
  const siteKeys = new Set(customSites.map((s) => s.key))
  // v1 的种子是「全量」,所以目录里缺失的 key 视为用户主动隐藏,迁移后保持隐藏
  const hiddenIds = CATALOG.map((e) => e.key).filter((k) => !desktopIds.includes(k) && !EXCLUDED_KEYS.has(k))
  const dockIds = Array.isArray(oldDock) && oldDock.length ? oldDock : [...DEFAULT_DOCK_IDS]

  return sanitize({
    ...defaults(),
    ...readLegacyPrefs(),
    desktopIds: [...desktopIds, ...siteKeys].filter((k, i, a) => a.indexOf(k) === i),
    hiddenIds,
    dockIds,
    customSites,
  })
}

function loadState(): DesktopState {
  const saved = storage.get<DesktopState | null>('desktop-state', null)
  if (saved && saved.version === DESKTOP_STATE_VERSION && Array.isArray(saved.desktopIds)) {
    return sanitize({ ...defaults(), ...saved })
  }
  const migrated = migrateFromV1()
  if (migrated) return migrated
  return sanitize({ ...defaults(), ...readLegacyPrefs() })
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

export const useDesktopStore = defineStore('utools-desktop', {
  state: (): DesktopState => loadState(),

  getters: {
    /** 桌面图标(由目录 + 自定义网站实时推导,永远不会有过期快照) */
    items: (s): DesktopItem[] => {
      const sites = new Map(s.customSites.map((x) => [x.key, x]))
      const out: DesktopItem[] = []
      for (const key of s.desktopIds) {
        const e = CATALOG_MAP.get(key)
        if (e) {
          out.push({
            key, kind: e.kind, name: e.name, icon: e.icon, accent: e.accent,
            short: e.short, desc: e.desc, category: e.categoryLabel, tags: e.tags,
            isNew: e.isNew, isHot: e.isHot, needsLogin: e.needsLogin,
          })
          continue
        }
        const site = sites.get(key)
        if (site) {
          out.push({
            key, kind: 'site', name: site.name, icon: '', accent: site.accent,
            url: site.url, emoji: site.emoji, iconUrl: site.iconUrl, tags: site.tags,
          })
        }
      }
      return out
    },
    /** 兼容旧组件:desktop.dock */
    dock: (s): string[] => s.dockIds,
    /** 隐藏的应用目录条目(设置页「隐藏的应用」用) */
    hiddenItems: (s) => s.hiddenIds.map((k) => CATALOG_MAP.get(k)).filter((e) => e !== undefined),
    /** 最近打开(按打开时间倒序,已过滤下架条目) */
    recentItems: (s) => s.recentIds.map((k) => CATALOG_MAP.get(k)).filter((e) => e !== undefined),
    /** 桌面上的自定义网站 */
    sites: (s): CustomSite[] => s.customSites,
    /** 壁纸 CSS background */
    wallpaperStyle: (s): string => wallpaperCss(s.wallpaper.preset, s.wallpaper.custom),
    /** 图标网格尺寸 */
    iconPx: (s): number => (s.iconSize === 's' ? 44 : s.iconSize === 'l' ? 68 : 56),
    isOnDesktop: (s) => (key: string): boolean => s.desktopIds.includes(key),
    isHidden: (s) => (key: string): boolean => s.hiddenIds.includes(key),
    isDocked: (s) => (key: string): boolean => s.dockIds.includes(key),
    /** 存储位置:本项目纯本地,无云端同步 */
    storageLocation: (): string => '仅本地浏览器(localStorage)',
  },

  actions: {
    /** 完整快照持久化到单个 key */
    persist() {
      const snapshot: DesktopState = {
        version: DESKTOP_STATE_VERSION,
        mode: this.mode,
        desktopIds: [...this.desktopIds],
        hiddenIds: [...this.hiddenIds],
        dockIds: [...this.dockIds],
        customSites: [...this.customSites],
        recentIds: [...this.recentIds],
        storeView: this.storeView,
        wallpaper: this.wallpaper,
        iconSize: this.iconSize,
        iconStyle: this.iconStyle,
        glass: this.glass,
        showLabels: this.showLabels,
        doubleClickOpen: this.doubleClickOpen,
        showClock: this.showClock,
        showDock: this.showDock,
        doubleClickHide: this.doubleClickHide,
      }
      storage.set('desktop-state', snapshot)
    },

    setMode(mode: DesktopState['mode']) {
      this.mode = mode
      this.persist()
    },

    /** 商店「添加」:把目录条目放到桌面(同时从隐藏列表恢复) */
    addTool(key: string): void {
      if (!CATALOG_MAP.has(key)) return
      if (!this.desktopIds.includes(key)) this.desktopIds = [...this.desktopIds, key]
      this.hiddenIds = this.hiddenIds.filter((k) => k !== key)
      this.persist()
    },
    add(key: string): void { this.addTool(key) },

    /** 手动添加网站快捷方式 */
    addSite(
      name: string,
      url: string,
      extra: Partial<Omit<CustomSite, 'key' | 'name' | 'url' | 'createdAt'>> = {},
    ): string {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
      let key = 'site-' + Date.now().toString(36)
      while (this.desktopIds.includes(key) || this.customSites.some((s) => s.key === key)) key += 'x'
      const site: CustomSite = {
        key,
        name,
        url: normalized,
        icon: extra.icon ?? '',
        iconUrl: extra.iconUrl,
        emoji: extra.emoji,
        accent: extra.accent ?? '#667eea',
        tags: extra.tags ?? [],
        createdAt: Date.now(),
      }
      this.customSites = [...this.customSites, site]
      this.desktopIds = [...this.desktopIds, key]
      this.persist()
      return key
    },

    /** 编辑自定义网站 */
    editSite(key: string, patch: Partial<Omit<CustomSite, 'key' | 'createdAt'>>): void {
      const idx = this.customSites.findIndex((s) => s.key === key)
      if (idx < 0) return
      const next = { ...this.customSites[idx], ...patch }
      if (next.url && !/^https?:\/\//i.test(next.url)) next.url = `https://${next.url}`
      this.customSites = this.customSites.map((s, i) => (i === idx ? next : s))
      this.persist()
    },

    /** 隐藏应用(可恢复);自定义网站则是真正删除 */
    hide(key: string): void {
      if (isSiteKey(key)) return this.deleteSite(key)
      if (!CATALOG_MAP.has(key)) return
      this.desktopIds = this.desktopIds.filter((k) => k !== key)
      if (!this.hiddenIds.includes(key)) this.hiddenIds = [...this.hiddenIds, key]
      this.dockIds = this.dockIds.filter((k) => k !== key)
      this.persist()
    },
    /** v1 兼容:remove 现在等价于 hide */
    remove(key: string): void { this.hide(key) },

    /** 从「隐藏的应用」恢复到桌面 */
    restore(key: string): void {
      this.hiddenIds = this.hiddenIds.filter((k) => k !== key)
      if (CATALOG_MAP.has(key) && !this.desktopIds.includes(key)) this.desktopIds = [...this.desktopIds, key]
      this.persist()
    },
    restoreAll(): void {
      const back = this.hiddenIds.filter((k) => CATALOG_MAP.has(k))
      this.hiddenIds = []
      this.desktopIds = uniq([...this.desktopIds, ...back])
      this.persist()
    },

    /** 彻底删除自定义网站 */
    deleteSite(key: string): void {
      this.customSites = this.customSites.filter((s) => s.key !== key)
      this.desktopIds = this.desktopIds.filter((k) => k !== key)
      this.dockIds = this.dockIds.filter((k) => k !== key)
      this.hiddenIds = this.hiddenIds.filter((k) => k !== key)
      this.persist()
    },

    /** 拖拽排序 */
    move(from: number, to: number): void {
      const ids = [...this.desktopIds]
      if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return
      const [it] = ids.splice(from, 1)
      ids.splice(to, 0, it)
      this.desktopIds = ids
      this.persist()
    },

    toggleDock(key: string): void {
      this.dockIds = this.dockIds.includes(key) ? this.dockIds.filter((k) => k !== key) : [...this.dockIds, key]
      this.persist()
    },
    setDockIds(ids: string[]): void {
      this.dockIds = uniq(ids)
      this.persist()
    },

    setWallpaper(preset: WallpaperPreset, custom?: string): void {
      this.wallpaper = { preset, custom }
      this.persist()
    },
    setIconSize(size: DesktopState['iconSize']): void {
      this.iconSize = size
      this.persist()
    },
    setIconStyle(style: DesktopState['iconStyle']): void {
      this.iconStyle = style
      this.persist()
    },
    setGlass(v: boolean): void { this.glass = v; this.persist() },
    setShowLabels(v: boolean): void { this.showLabels = v; this.persist() },
    setDoubleClickOpen(v: boolean): void { this.doubleClickOpen = v; this.persist() },
    setShowClock(v: boolean): void { this.showClock = v; this.persist() },
    setShowDock(v: boolean): void { this.showDock = v; this.persist() },
    setDoubleClickHide(v: boolean): void { this.doubleClickHide = v; this.persist() },

    /** 记录最近打开(去重前移,最多 12 条) */
    pushRecent(key: string): void {
      if (!CATALOG_MAP.has(key)) return
      const next = [key, ...this.recentIds.filter((k) => k !== key)].slice(0, 12)
      if (next.length === this.recentIds.length && next.every((k, i) => k === this.recentIds[i])) return
      this.recentIds = next
      this.persist()
    },

    setStoreView(v: 'grid' | 'list'): void {
      this.storeView = v
      this.persist()
    },

    /** 当前 localStorage 占用字节数(设置页「存储位置」用) */
    storageUsageBytes(): number {
      let total = 0
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (!k || !k.startsWith('utools_')) continue
          total += k.length + (localStorage.getItem(k)?.length ?? 0)
        }
      } catch { /* 隐私模式 */ }
      return total * 2
    },

    /** 导出备份:结构对齐找Tab 的 {version, apps, dock_app_ids, preferences, all_tags} */
    exportConfig(): string {
      return JSON.stringify(
        {
          version: DESKTOP_STATE_VERSION,
          exportedAt: new Date().toISOString(),
          apps: this.desktopIds,
          hidden_app_ids: this.hiddenIds,
          dock_app_ids: this.dockIds,
          custom_sites: this.customSites,
          recent_app_ids: this.recentIds,
          preferences: {
            mode: this.mode,
            wallpaper: this.wallpaper,
            iconSize: this.iconSize,
            iconStyle: this.iconStyle,
            glass: this.glass,
            showLabels: this.showLabels,
            doubleClickOpen: this.doubleClickOpen,
            showClock: this.showClock,
            showDock: this.showDock,
            doubleClickHide: this.doubleClickHide,
            storeView: this.storeView,
          },
          all_tags: ALL_TAGS,
        },
        null,
        2,
      )
    },

    /** 导入备份:兼容 v1(items/dock/扁平偏好)与 v2(apps/preferences) */
    importConfig(json: string): boolean {
      try {
        const c = JSON.parse(json) as Record<string, unknown>
        if (!c || typeof c !== 'object') return false
        const prefs = (c.preferences && typeof c.preferences === 'object' ? c.preferences : c) as Record<string, unknown>

        const customSites: CustomSite[] = Array.isArray(c.custom_sites)
          ? (c.custom_sites as CustomSite[])
          : []

        let desktopIds: string[] = []
        if (Array.isArray(c.apps)) desktopIds = c.apps.filter((k): k is string => typeof k === 'string')
        else if (Array.isArray(c.items)) {
          const oldItems = c.items as DesktopItem[]
          for (const i of oldItems) {
            if (!i || typeof i.key !== 'string') continue
            desktopIds.push(i.key)
            if (i.kind === 'site' && isSiteKey(i.key)) {
              customSites.push({
                key: i.key, name: i.name, url: i.url || 'https://example.com',
                icon: i.emoji || i.iconUrl || '', iconUrl: i.iconUrl, emoji: i.emoji,
                accent: i.accent || '#667eea', tags: i.tags || [], createdAt: Date.now(),
              })
            }
          }
        } else return false

        const hiddenIds = Array.isArray(c.hidden_app_ids) || Array.isArray(c.hiddenIds)
          ? ((c.hidden_app_ids ?? c.hiddenIds) as unknown[]).filter((k): k is string => typeof k === 'string')
          : []
        const dockIds = Array.isArray(c.dock_app_ids) || Array.isArray(c.dock) || Array.isArray(c.dockIds)
          ? ((c.dock_app_ids ?? c.dock ?? c.dockIds) as unknown[]).filter((k): k is string => typeof k === 'string')
          : []
        const recentIds = Array.isArray(c.recent_app_ids) || Array.isArray(c.recentIds)
          ? ((c.recent_app_ids ?? c.recentIds) as unknown[]).filter((k): k is string => typeof k === 'string')
          : []

        const wp = prefs.wallpaper as DesktopPrefs['wallpaper'] | undefined
        const base = defaults()
        const next: DesktopState = {
          ...base,
          mode: prefs.mode === 'desktop' || prefs.mode === 'classic' ? prefs.mode : this.mode,
          desktopIds, hiddenIds, dockIds, customSites,
          recentIds,
          storeView: prefs.storeView === 'list' ? 'list' : 'grid',
          wallpaper: wp?.preset ? wp : this.wallpaper,
          iconSize: ['s', 'm', 'l'].includes(prefs.iconSize as string) ? prefs.iconSize as DesktopState['iconSize'] : this.iconSize,
          iconStyle: prefs.iconStyle === 'square' ? 'square' : 'rounded',
        }
        for (const k of ['glass', 'showLabels', 'doubleClickOpen', 'showClock', 'showDock', 'doubleClickHide'] as const) {
          if (typeof prefs[k] === 'boolean') next[k] = prefs[k] as boolean
        }
        const cleaned = sanitize(next)
        this.version = cleaned.version
        this.mode = cleaned.mode
        this.desktopIds = cleaned.desktopIds
        this.hiddenIds = cleaned.hiddenIds
        this.dockIds = cleaned.dockIds
        this.customSites = cleaned.customSites
        this.recentIds = cleaned.recentIds
        this.storeView = cleaned.storeView
        this.wallpaper = cleaned.wallpaper
        this.iconSize = cleaned.iconSize
        this.iconStyle = cleaned.iconStyle
        this.glass = cleaned.glass
        this.showLabels = cleaned.showLabels
        this.doubleClickOpen = cleaned.doubleClickOpen
        this.showClock = cleaned.showClock
        this.showDock = cleaned.showDock
        this.doubleClickHide = cleaned.doubleClickHide
        this.persist()
        return true
      } catch {
        return false
      }
    },

    /** 重置布局(保留模式、壁纸与自定义网站) */
    resetLayout(): void {
      this.desktopIds = uniq([...DEFAULT_DESKTOP_IDS, ...this.customSites.map((s) => s.key)])
      this.hiddenIds = []
      this.dockIds = [...DEFAULT_DOCK_IDS]
      this.persist()
    },
  },
})
