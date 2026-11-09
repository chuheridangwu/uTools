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
  {
    key: 'totp-auth',
    name: '两步验证码',
    short: '本地生成 TOTP 验证码',
    desc: '基于 RFC 6238 的 TOTP:粘贴 base32 密钥或 otpauth:// 链接即可添加账户,实时生成 6/7/8 位验证码并支持一键复制;密钥仅存本机,全部本地计算。',
    icon: 'Key',
    accent: '#22c55e',
    category: '效率工具',
    comp: () => import('@/views/apps/TotpAuth.vue') as unknown as Promise<Component>,
  },
  {
    key: 'speed-test',
    name: '网络测速',
    short: '延迟 / 下载 / 上传速率',
    desc: '通过 Cloudflare 公共端点测量网络延迟与抖动、下载与上传带宽,结果以 Mbps 展示并给出评级;适合快速判断当前网络状况。',
    icon: 'Odometer',
    accent: '#0ea5e9',
    category: '生活实用',
    comp: () => import('@/views/apps/SpeedTest.vue') as unknown as Promise<Component>,
  },
  {
    key: 'instrument',
    name: '乐器体验馆',
    short: '两八度键盘多种音色',
    desc: '两八度虚拟键盘,钢琴 / 吉他 / 八音盒 / 电子琴 / 管风琴五种音色全部由 Web Audio 实时合成;支持鼠标点按与电脑键盘演奏。',
    icon: 'Headset',
    accent: '#8b5cf6',
    category: '生活实用',
    comp: () => import('@/views/apps/InstrumentStudio.vue') as unknown as Promise<Component>,
  },
  {
    key: 'world-clock',
    name: '世界时钟',
    short: '多城市时间与昼夜',
    desc: '添加任意城市,查看当地时间、日期、与本地的时差及昼夜状态,常用于跨时区协作与联系海外同事。',
    icon: 'Clock',
    accent: '#14b8a6',
    category: '效率工具',
    comp: () => import('@/views/apps/WorldClock.vue') as unknown as Promise<Component>,
  },
  {
    key: 'pomodoro',
    name: '番茄钟',
    short: '专注与休息循环计时',
    desc: '工作 / 短休 / 长休三段循环,时长与长休间隔可自定义,到点合成提示音,并统计今日完成的番茄数;适合专注工作与学习。',
    icon: 'Timer',
    accent: '#ef4444',
    category: '效率工具',
    comp: () => import('@/views/apps/PomodoroTimer.vue') as unknown as Promise<Component>,
  },
]

export const APP_MAP: Map<string, DesktopAppMeta> = new Map(DESKTOP_APPS.map((a) => [a.key, a]))
