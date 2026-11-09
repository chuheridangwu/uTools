/**
 * 桌面应用注册表(非路由工具,以「应用窗口」形态在桌面模式打开)
 * 与 src/config/tools.ts 的角色区分:
 *  - tools.ts:有完整页面路由的「工具」
 *  - desktopApps.ts:桌面模式下以浮层窗口打开的「应用」(找Tab 式 App)
 */
import type { Component } from 'vue'

export interface DesktopAppMeta {
  key: string
  name: string
  short: string
  desc: string
  icon: string        // Element Plus 图标名
  accent: string
  category: '效率工具' | '开发工具' | '生活实用'
  comp: () => Promise<Component>
}

export const DESKTOP_APPS: DesktopAppMeta[] = [
  {
    key: 'noise-mixer',
    name: '白噪音混音台',
    short: '雨风海浪篝火,实时合成',
    desc: '15 种环境声音全部由 Web Audio 实时合成,独立音量与左右声像,内置安眠/静读/专注场景与睡眠定时,适合专注与放松。',
    icon: 'Headset',
    accent: '#14b8a6',
    category: '生活实用',
    comp: () => import('@/views/apps/NoiseMixer.vue') as unknown as Promise<Component>,
  },
  {
    key: 'nginx-config',
    name: 'Nginx 配置生成器',
    short: '勾选生成 Nginx 配置',
    desc: '按需勾选功能,实时生成带中文注释的 Nginx 配置:静态站、反向代理、HTTPS 跳转、Gzip、缓存、WebSocket、跨域、限流与安全响应头,可复制或下载。',
    icon: 'Setting',
    accent: '#10b981',
    category: '开发工具',
    comp: () => import('@/views/apps/NginxConfig.vue') as unknown as Promise<Component>,
  },
  {
    key: 'wechat-format',
    name: '公众号排版',
    short: 'Markdown 转公众号样式',
    desc: '用 Markdown 写文章,实时预览排版效果,多套主题可选,代码块自动高亮;一键复制带内联样式的正文,直接粘贴到公众号后台。',
    icon: 'Document',
    accent: '#ec4899',
    category: '效率工具',
    comp: () => import('@/views/apps/WechatFormat.vue') as unknown as Promise<Component>,
  },
  {
    key: 'clipboard',
    name: '智能剪贴板',
    short: '复制历史分类与搜索',
    desc: '粘贴保存常用文本,自动识别链接/代码并分类,支持搜索、置顶与一键复制;数据仅存本机浏览器。',
    icon: 'CopyDocument',
    accent: '#f59e0b',
    category: '效率工具',
    comp: () => import('@/views/apps/ClipboardBoard.vue') as unknown as Promise<Component>,
  },
]

export const APP_MAP: Map<string, DesktopAppMeta> = new Map(DESKTOP_APPS.map((a) => [a.key, a]))
