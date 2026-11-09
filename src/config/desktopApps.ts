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
  {
    key: 'radio-player',
    name: '电台随身听',
    short: '精选公共电台直播',
    desc: '收录 SomaFM、Radio Paradise、SRG SSR 等公共电台直播流,涵盖氛围、爵士、古典、独立流行等风格,点击即听并支持收藏。',
    icon: 'Headset',
    accent: '#e11d48',
    category: '生活实用',
    comp: () => import('@/views/apps/RadioPlayer.vue') as unknown as Promise<Component>,
  },
  {
    key: 'todo-list',
    name: '待办清单',
    short: '轻量任务管理与勾选',
    desc: '添加、勾选、删除待办,标记重要事项并清除已完成;支持全部/待办/已完成筛选,数据仅存本机浏览器。',
    icon: 'List',
    accent: '#10b981',
    category: '效率工具',
    comp: () => import('@/views/apps/TodoList.vue') as unknown as Promise<Component>,
  },
  {
    key: 'calculator',
    name: '科学计算器',
    short: '表达式计算与历史记录',
    desc: '自带表达式解析器(非 eval),支持四则运算、乘方、取模、括号、阶乘、三角函数与对数,可切换角度/弧度并保留历史。',
    icon: 'ScaleToOriginal',
    accent: '#0ea5e9',
    category: '效率工具',
    comp: () => import('@/views/apps/SciCalculator.vue') as unknown as Promise<Component>,
  },
  {
    key: 'unit-converter',
    name: '单位换算',
    short: '长度重量温度等互转',
    desc: '覆盖长度、重量、面积、体积、温度、速度、存储、时间八大类常用单位,支持左右互换与实时换算,精度可控。',
    icon: 'Sort',
    accent: '#f59e0b',
    category: '生活实用',
    comp: () => import('@/views/apps/UnitConverter.vue') as unknown as Promise<Component>,
  },
  {
    key: 'breath-training',
    name: '呼吸训练',
    short: '4-7-8 等引导呼吸',
    desc: '提供 4-7-8 助眠、箱式呼吸与放松呼吸三种节律,跟随圆环缩放进行引导,可开启提示音并统计轮数,帮助放松与专注。',
    icon: 'Sunny',
    accent: '#6366f1',
    category: '生活实用',
    comp: () => import('@/views/apps/BreathTraining.vue') as unknown as Promise<Component>,
  },
  {
    key: 'password-generator',
    name: '密码生成器',
    short: '强随机密码与口令短语',
    desc: '基于 Web Crypto 生成强随机密码,可自定义长度与字符集、排除易混淆字符、批量生成并评估强度;另提供易记的口令短语模式。',
    icon: 'Key',
    accent: '#0ea5e9',
    category: '效率工具',
    comp: () => import('@/views/apps/PasswordGenerator.vue') as unknown as Promise<Component>,
  },
  {
    key: 'expense-tracker',
    name: '记账本',
    short: '收支记录与分类统计',
    desc: '记录收入与支出,按月份查看结余,并以条形图汇总各分类占比;支持删除与备注,数据仅存本机浏览器。',
    icon: 'Wallet',
    accent: '#f59e0b',
    category: '生活实用',
    comp: () => import('@/views/apps/ExpenseTracker.vue') as unknown as Promise<Component>,
  },
  {
    key: 'typing-test',
    name: '打字练习',
    short: '测速与正确率统计',
    desc: '提供英文段落与代码片段,逐字符高亮对错,实时统计 CPM / WPM 与正确率,是练习指法与提升速度的小工具。',
    icon: 'EditPen',
    accent: '#6366f1',
    category: '生活实用',
    comp: () => import('@/views/apps/TypingTest.vue') as unknown as Promise<Component>,
  },
  {
    key: 'drawing-board',
    name: '画板',
    short: '随手涂鸦与导出 PNG',
    desc: '基于 Canvas 的简易画板:画笔、橡皮、调色与粗细调节,支持撤销、清空与导出 PNG,适合快速画示意图。',
    icon: 'Brush',
    accent: '#ec4899',
    category: '生活实用',
    comp: () => import('@/views/apps/DrawingBoard.vue') as unknown as Promise<Component>,
  },
  {
    key: 'wheel-picker',
    name: '随机转盘',
    short: '选项抽取与决策',
    desc: '把每行一个的选项画成转盘,点击随机旋转并停在某一项,用于决策、抽奖与点名,并保留最近抽取记录。',
    icon: 'Aim',
    accent: '#14b8a6',
    category: '生活实用',
    comp: () => import('@/views/apps/WheelPicker.vue') as unknown as Promise<Component>,
  },
]

export const APP_MAP: Map<string, DesktopAppMeta> = new Map(DESKTOP_APPS.map((a) => [a.key, a]))
