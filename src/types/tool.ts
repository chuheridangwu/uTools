/**
 * 工具类型定义
 * 全站所有功能工具共用的一份数据结构,由 src/config/tools.ts 统一注册,
 * 首页/侧边栏/命令面板均从该注册表读取,保证单一数据来源。
 */

/** 工具分类 key */
export type ToolCategoryKey = 'dev' | 'text' | 'image' | 'data' | 'life'

/** 工具分类信息 */
export interface ToolCategory {
  key: ToolCategoryKey
  label: string
  icon: string        // Element Plus 图标组件名
  desc: string
}

/** 单个工具的元信息 */
export interface ToolMeta {
  key: string            // 唯一标识,同时用作路由 name
  path: string           // 路由路径,如 /json-viewer
  name: string           // 展示名称
  short: string          // 简短说明(卡片一行)
  desc: string           // 详细说明(工具页顶部)
  icon: string           // Element Plus 图标组件名
  category: ToolCategoryKey
  keywords: string[]     // 命令面板/搜索关键词
  accent: string         // 卡片主题色(渐变左侧色条)
  isNew?: boolean        // 是否新功能徽标
}
