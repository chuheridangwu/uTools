/**
 * 统一应用目录(单一数据源 / P0)
 *
 * 把两套注册表合并成一份「应用」:
 *   - src/config/tools.ts       有完整路由页面的站内工具(kind = tool)
 *   - src/config/desktopApps.ts 以窗口浮层打开的桌面应用(kind = app)
 *
 * 找Tab 式元数据在这里一次性补齐:统一分类、标签、拼音检索别名、
 * 最新上架 / 最受欢迎 / 徽标 / 计数,桌面状态层只保存「用户选了哪些」。
 *
 * 范围约定(按需求):
 *   - 不做:电台随身听、游戏中心、3D 魔方、公众号排版(见 EXCLUDED_KEYS)
 *   - 应用商店不提供「游戏」「阅读」两个分类
 *   - uTools 自有的分类(文本 / 图片 / 数据文件 / 局域网)按我们自己的方式保留
 */
import type { Component } from 'vue'
import { pinyin } from 'pinyin-pro'
import { TOOLS } from '@/config/tools'
import { DESKTOP_APPS } from '@/config/desktopApps'

/* ------------------------------------------------------------------ *
 * 排除清单与分类
 * ------------------------------------------------------------------ */

/** 明确不做的应用。组件文件保留,但不进入目录 / 商店 / 默认桌面。 */
export const EXCLUDED_KEYS = new Set<string>([
  'radio-player',   // 电台随身听
  'wechat-format',  // 公众号排版
  'game-center',    // 游戏中心
  'game-hub',
  'rubiks-cube',    // 3D 魔方
  'magic-cube',
])

export interface StoreCategory {
  key: string
  label: string
  /** true = 找Tab 原生的分类;false = uTools 自有、按其自身方式保留 */
  fromZhaotab: boolean
}

/**
 * 商店分类:前 4 个沿用找Tab,后面是我们自己多出来的分类。
 * 刻意不含「游戏」「阅读」。
 */
export const STORE_CATEGORIES: StoreCategory[] = [
  { key: 'all', label: '全部', fromZhaotab: true },
  { key: 'efficiency', label: '效率工具', fromZhaotab: true },
  { key: 'dev', label: '开发工具', fromZhaotab: true },
  { key: 'design', label: '设计资源', fromZhaotab: true },
  { key: 'life', label: '生活实用', fromZhaotab: true },
  { key: 'text', label: '文本工具', fromZhaotab: false },
  { key: 'image', label: '图片工具', fromZhaotab: false },
  { key: 'data', label: '数据文件', fromZhaotab: false },
  { key: 'lan', label: '局域网', fromZhaotab: false },
]

/** 找Tab 数据模型里的 all_tags,去掉游戏 / 阅读,补上我们自己的标签 */
export const ALL_TAGS = [
  '全部', '效率', '开发', '设计', '生活', '图片', '文本',
  '数据', '网络', 'AI', '工具', '资讯', '音乐',
] as const

/** 工具分类 key → 商店分类 key(同名,保留我们自己的分类) */
const TOOL_CATEGORY_MAP: Record<string, string> = {
  dev: 'dev', text: 'text', image: 'image', data: 'data', lan: 'lan', life: 'life',
}

/** 桌面应用的中文分类 → 商店分类 key */
const APP_CATEGORY_MAP: Record<string, string> = {
  效率工具: 'efficiency',
  开发工具: 'dev',
  设计资源: 'design',
  生活实用: 'life',
  // uTools 自有分类:找Tab 没有,按我们自己的方式保留
  文本工具: 'text',
  图片工具: 'image',
  数据文件: 'data',
  局域网: 'lan',
}

/* ------------------------------------------------------------------ *
 * 目录条目
 * ------------------------------------------------------------------ */

export type CatalogKind = 'tool' | 'app'

export interface CatalogEntry {
  key: string
  kind: CatalogKind
  name: string
  short: string
  desc: string
  icon: string          // Element Plus 图标名
  accent: string
  category: string      // STORE_CATEGORIES 的 key
  categoryLabel: string
  nativeCategory: string
  tags: string[]
  keywords: string[]
  aliases: string[]     // 全拼 / 首字母 / 简写
  isNew: boolean        // 「新」徽标
  isHot: boolean        // 「最热」徽标
  popularity: number    // 越大越靠前
  releasedAt: number    // 批次序号,越大越新
  needsLogin: boolean
  path?: string         // 工具路由
  comp?: () => Promise<Component> // 应用窗口组件
  /** 预拼好的检索文本(已归一化),避免每次搜索重复计算 */
  searchText: string
}

/** 检索归一化:去空白与常见分隔符,统一小写 */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[\s/·、，,._\-—()（）]/g, '')
}

/** 生成名字的拼音别名:全拼、首字母、中英混排全拼、中英混排首字母 */
function pinyinAliases(name: string): string[] {
  const zh = name.replace(/[^\u4e00-\u9fa5]/g, '')
  const opts = { toneType: 'none' as const, type: 'array' as const, nonZh: 'consecutive' as const }
  const mixedFull = pinyin(name, opts).join('')
  const mixedFirst = pinyin(name, { ...opts, pattern: 'first' as const }).join('')
  const zhFull = zh ? pinyin(zh, opts).join('') : ''
  const zhFirst = zh ? pinyin(zh, { ...opts, pattern: 'first' as const }).join('') : ''
  return [...new Set(
    [mixedFull, mixedFirst, zhFull, zhFirst]
      .map((v) => normalizeSearch(v))
      .filter(Boolean),
  )]
}

/** 最近四批新增应用(按时间从旧到新),用于「最新上架」 */
const RELEASE_BATCHES: string[][] = [
  ['text-to-speech', 'ascii-art', 'id-card-parser', 'password-strength', 'workday-calendar'],
  ['roman-numerals', 'date-calculator', 'loan-calculator', 'random-tool', 'habit-tracker'],
  ['nine-grid-cut', 'text-cipher', 'split-bill', 'biorhythm', 'image-to-base64'],
  ['metronome', 'url-parser', 'jwt-decoder', 'text-line-tools', 'svg-pattern'],
  ['byte-converter', 'ascii-table', 'http-status', 'curl-formatter', 'json-csv'],
  ['image-compress', 'image-crop', 'random-avatar', 'seal-generator', 'code-screenshot'],
  ['browser-env-detect', 'websocket-test', 'html-editor', 'quadrant-notes', 'no-sleep'],
]

const RELEASE_INDEX = new Map<string, number>()
RELEASE_BATCHES.forEach((batch, i) => batch.forEach((k) => RELEASE_INDEX.set(k, i)))

/** 热门排序(越靠前越热),其余 popularity = 0 */
const HOT_LIST = [
  'json-viewer', 'qrcode-tool', 'translator', 'clipboard', 'pomodoro',
  'image-converter', 'todo-list', 'calculator', 'password-generator',
  'hash-generator', 'color-tool', 'world-clock', 'noise-mixer',
  'markdown-editor', 'timestamp', 'unit-converter', 'regex-tester',
  'encode-decode', 'api-tester', 'diff-tool',
]
const HOT_INDEX = new Map<string, number>(HOT_LIST.map((k, i) => [k, HOT_LIST.length - i]))

/** 需要登录 / 依赖第三方服务的应用(找Tab 里对应「需登录」徽标) */
const LOGIN_REQUIRED = new Set<string>(['weather', 'ip-lookup', 'currency-exchange', 'translator', 'speed-test'])

/** 分类 → 标签 */
function tagsOf(category: string, keywords: string[]): string[] {
  const base: Record<string, string[]> = {
    efficiency: ['效率', '工具'],
    dev: ['开发', '工具'],
    design: ['设计', '图片'],
    life: ['生活'],
    text: ['文本', '效率'],
    image: ['图片', '设计'],
    data: ['数据', '工具'],
    lan: ['网络', '工具'],
  }
  const extra: string[] = []
  const joined = keywords.join(' ').toLowerCase()
  if (/ai|智能/.test(joined)) extra.push('AI')
  if (/音乐|音频|声音|听/.test(joined)) extra.push('音乐')
  if (/新闻|资讯|天气/.test(joined)) extra.push('资讯')
  return [...new Set([...(base[category] ?? ['工具']), ...extra])]
}

/* ------------------------------------------------------------------ *
 * 构建目录(工具在前、应用在后,展示时由商店自己排序)
 * ------------------------------------------------------------------ */

function buildCatalog(): CatalogEntry[] {
  const toolEntries: CatalogEntry[] = TOOLS.filter((t) => !EXCLUDED_KEYS.has(t.key)).map((t) => {
    const category = TOOL_CATEGORY_MAP[t.category] ?? 'efficiency'
    const aliases = pinyinAliases(t.name)
    const entry: CatalogEntry = {
      key: t.key,
      kind: 'tool',
      name: t.name,
      short: t.short,
      desc: t.desc,
      icon: t.icon,
      accent: t.accent,
      category,
      categoryLabel: STORE_CATEGORIES.find((c) => c.key === category)?.label ?? '效率工具',
      nativeCategory: t.category,
      tags: tagsOf(category, t.keywords),
      keywords: t.keywords,
      aliases,
      isNew: Boolean(t.isNew) || (RELEASE_INDEX.get(t.key) ?? -1) >= 2,
      isHot: (HOT_INDEX.get(t.key) ?? 0) >= HOT_LIST.length - 11,
      popularity: HOT_INDEX.get(t.key) ?? 0,
      releasedAt: RELEASE_INDEX.get(t.key) ?? 0,
      needsLogin: LOGIN_REQUIRED.has(t.key),
      path: t.path,
      searchText: '',
    }
    return entry
  })

  const appEntries: CatalogEntry[] = DESKTOP_APPS.filter((a) => !EXCLUDED_KEYS.has(a.key)).map((a) => {
    const category = APP_CATEGORY_MAP[a.category] ?? 'efficiency'
    const aliases = pinyinAliases(a.name)
    const entry: CatalogEntry = {
      key: a.key,
      kind: 'app',
      name: a.name,
      short: a.short,
      desc: a.desc,
      icon: a.icon,
      accent: a.accent,
      category,
      categoryLabel: STORE_CATEGORIES.find((c) => c.key === category)?.label ?? '效率工具',
      nativeCategory: a.category,
      tags: tagsOf(category, [a.short, a.desc]),
      keywords: [a.short],
      aliases,
      isNew: (RELEASE_INDEX.get(a.key) ?? -1) >= 2,
      isHot: (HOT_INDEX.get(a.key) ?? 0) >= HOT_LIST.length - 11,
      popularity: HOT_INDEX.get(a.key) ?? 0,
      releasedAt: RELEASE_INDEX.get(a.key) ?? 0,
      needsLogin: LOGIN_REQUIRED.has(a.key),
      comp: a.comp,
      searchText: '',
    }
    return entry
  })

  const all = [...appEntries, ...toolEntries]
  for (const e of all) {
    e.searchText = [e.name, e.short, e.desc, e.categoryLabel, e.key, ...e.keywords, ...e.tags, ...e.aliases]
      .map(normalizeSearch)
      .join('|')
  }
  return all
}

export const CATALOG: CatalogEntry[] = buildCatalog()
export const CATALOG_MAP: Map<string, CatalogEntry> = new Map(CATALOG.map((e) => [e.key, e]))

/** 默认桌面图标:仿照找Tab 的精选首屏,其余应用仍可在商店里一键添加 */
export const DEFAULT_DESKTOP_IDS: string[] = [
  // 效率 / 常用
  'clipboard', 'pomodoro', 'todo-list', 'calculator', 'world-clock',
  'unit-converter', 'password-generator', 'habit-tracker', 'sticky-notes',
  'stopwatch-timer', 'countdown-days', 'emoji-picker', 'calendar-view',
  // 开发
  'jwt-decoder', 'url-parser', 'base-converter', 'morse-code',
  'json-viewer', 'timestamp', 'regex-tester', 'encode-decode', 'qrcode-tool',
  // 设计
  'gradient-generator', 'palette-generator', 'shadow-generator',
  'nine-grid-cut', 'image-to-base64', 'svg-pattern', 'color-tool',
  // 生活 / 网络
  'noise-mixer', 'weather', 'metronome', 'drawing-board', 'lan-transfer',
].filter((k) => CATALOG_MAP.has(k))

export const DEFAULT_DOCK_IDS: string[] = ['clipboard', 'noise-mixer', 'lan-transfer', 'qrcode-tool']
  .filter((k) => CATALOG_MAP.has(k))

/* ------------------------------------------------------------------ *
 * 查询辅助
 * ------------------------------------------------------------------ */

/** 拼音 / 关键词 / 名称 / 描述 / 标签 的统一匹配 */
export function matchCatalog(entry: CatalogEntry, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true
  return entry.searchText.includes(q)
}

/** 按关键词过滤(支持拼音全拼与首字母,如 chakanqi / ckq / json) */
export function searchCatalog(query: string, list: CatalogEntry[] = CATALOG): CatalogEntry[] {
  if (!normalizeSearch(query)) return list
  return list.filter((e) => matchCatalog(e, query))
}

/** 分类过滤 */
export function catalogByCategory(category: string, list: CatalogEntry[] = CATALOG): CatalogEntry[] {
  if (!category || category === 'all') return list
  return list.filter((e) => e.category === category)
}

/** 各分类的数量(用于商店分类计数) */
export function categoryCounts(list: CatalogEntry[] = CATALOG): Record<string, number> {
  const counts: Record<string, number> = { all: list.length }
  for (const c of STORE_CATEGORIES) {
    if (c.key !== 'all') counts[c.key] = list.filter((e) => e.category === c.key).length
  }
  return counts
}

/** 最新上架:按批次倒序,同批次按目录顺序 */
export function newestEntries(list: CatalogEntry[] = CATALOG): CatalogEntry[] {
  return [...list].sort((a, b) => b.releasedAt - a.releasedAt).filter((e) => e.releasedAt > 0)
}

/** 最受欢迎:按 popularity 倒序 */
export function hottestEntries(list: CatalogEntry[] = CATALOG): CatalogEntry[] {
  return [...list].filter((e) => e.popularity > 0).sort((a, b) => b.popularity - a.popularity)
}
