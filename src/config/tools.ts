/**
 * 工具注册表(单一数据源)
 *
 * 新增工具步骤:
 *  1. 在 src/views/ 下创建页面组件,文件名为短横线 key 的 PascalCase 形式
 *     (例如 json-viewer → src/views/JsonViewer.vue,懒加载由 router 自动 import.meta.glob 完成)
 *  2. 在下方 TOOLS 数组里追加一条 ToolMeta
 *  3. 完成 —— 首页卡片/侧边栏/命令面板/路由全部自动生效
 */
import type { ToolCategory, ToolMeta } from '@/types/tool'

/** 分类定义,顺序即侧边栏展示顺序 */
export const CATEGORIES: ToolCategory[] = [
  { key: 'dev', label: '开发工具', icon: 'Monitor', desc: 'JSON、代码、正则、API 等开发常用' },
  { key: 'text', label: '文本工具', icon: 'EditPen', desc: '编辑、对比、翻译与写作' },
  { key: 'image', label: '图片工具', icon: 'Picture', desc: '转换、压缩、水印与二维码' },
  { key: 'data', label: '数据文件', icon: 'Files', desc: 'CSV 等数据文件查看与转换' },
]

/** 全部工具注册(共 27 个) */
export const TOOLS: ToolMeta[] = [
  // ────────────────────────── 开发工具 ──────────────────────────
  {
    key: 'json-viewer', path: '/json-viewer', name: 'JSON 查看器', icon: 'DataBoard',
    category: 'dev', accent: '#6366f1',
    short: '格式化 / 压缩 / 校验 / 树形浏览', keywords: ['json', '格式化', '压缩', '校验', 'tree'],
    desc: '输入或粘贴 JSON,一键格式化、压缩并校验合法性,支持树形浏览、错误定位与结构统计。',
  },
  {
    key: 'json-generator', path: '/json-generator', name: 'JSON 生成器', icon: 'MagicStick',
    category: 'dev', accent: '#8b5cf6', isNew: true,
    short: '按字段模板批量生成模拟数据', keywords: ['json', 'mock', '假数据', '生成', '模拟'],
    desc: '自定义字段模板(姓名/邮箱/UUID/数字区间等),按条数批量生成测试 JSON 数据并导出。',
  },
  {
    key: 'code-generator', path: '/code-generator', name: '代码生成器', icon: 'Document',
    category: 'dev', accent: '#06b6d4',
    short: 'JSON → TS / Vue / Python / SQL / MD', keywords: ['typescript', 'interface', 'python', 'sql', '代码生成', '模板'],
    desc: '以 JSON 样例或字段定义为输入,一键生成 TypeScript 接口、Vue3 组件、Python 类、SQL 建表与 Markdown 表格。',
  },
  {
    key: 'timestamp', path: '/timestamp', name: '时间戳转换', icon: 'Timer',
    category: 'dev', accent: '#0ea5e9',
    short: '秒/毫秒时间戳与日期互转', keywords: ['时间戳', 'timestamp', '日期', 'utc', 'now'],
    desc: '时间戳与日期时间互转,实时显示当前秒/毫秒戳,支持本地时间与 UTC 双视图及换算历史。',
  },
  {
    key: 'diff-tool', path: '/diff-tool', name: '文本对比', icon: 'DocumentCopy',
    category: 'dev', accent: '#f59e0b',
    short: '并排/合并视图逐行对比差异', keywords: ['diff', '对比', '差异', '文本比较'],
    desc: '粘贴两段文本,以并排或合并视图逐行高亮新增/删除/变更内容,并统计差异行数。',
  },
  {
    key: 'sql-formatter', path: '/sql-formatter', name: 'SQL 格式化', icon: 'Coin',
    category: 'dev', accent: '#10b981',
    short: '多方言 SQL 美化与压缩', keywords: ['sql', '格式化', '美化', 'mysql', 'postgres'],
    desc: '对 SQL 语句进行缩进排版与关键字大小写标准化,支持 MySQL / PostgreSQL / SQLite / TSQL 等方言。',
  },
  {
    key: 'cron-parser', path: '/cron-parser', name: 'Cron 解析', icon: 'Clock',
    category: 'dev', accent: '#ec4899',
    short: '中文释义 + 未来执行时间推演', keywords: ['cron', '定时', '表达式', 'crontab'],
    desc: '解析 Cron 表达式,给出中文人类可读描述,并推演未来若干次执行时间；内置常用模板。',
  },
  {
    key: 'regex-tester', path: '/regex-tester', name: '正则测试器', icon: 'Search',
    category: 'dev', accent: '#f43f5e',
    short: '实时匹配、分组与高亮预览', keywords: ['regex', '正则', 'regexp', '匹配'],
    desc: '输入正则与样本文本,实时展示匹配结果、编号分组与原文高亮,支持多标志位与正则速查表。',
  },
  {
    key: 'uuid-generator', path: '/uuid-generator', name: 'UUID 生成器', icon: 'Fingerprint',
    category: 'dev', accent: '#a855f7',
    short: '批量生成 UUID v4,多种格式', keywords: ['uuid', 'guid', 'id', '随机'],
    desc: '批量生成 UUID v4,支持大写、去连字符等格式选项,一键复制或导出为文本文件。',
  },
  {
    key: 'encode-decode', path: '/encode-decode', name: '编码解码', icon: 'Switch',
    category: 'dev', accent: '#14b8a6',
    short: 'Base64 / URL / Hex / Unicode', keywords: ['base64', 'url', 'hex', 'unicode', '编码', '解码', 'escape'],
    desc: '文本与 Base64(UTF-8 安全)、URL、十六进制、Unicode 转义之间互相转换,即时双向预览。',
  },
  {
    key: 'hash-generator', path: '/hash-generator', name: '哈希生成器', icon: 'Key',
    category: 'dev', accent: '#06b6d4',
    short: 'MD5 / SHA 系列 / HMAC', keywords: ['hash', 'md5', 'sha1', 'sha256', 'sha512', 'hmac', '摘要'],
    desc: '计算文本的 MD5、SHA-1/256/512 摘要,支持 HMAC-SHA256 加盐,结果一键复制。',
  },
  {
    key: 'api-tester', path: '/api-tester', name: 'API 测试器', icon: 'Connection',
    category: 'dev', accent: '#3b82f6',
    short: '轻量 HTTP 调试台(Time/Status)', keywords: ['http', '接口', 'api', 'postman', '测试'],
    desc: '浏览器内直接发送 GET/POST 等请求,自定义请求头与 Body,查看状态码、耗时与响应体。',
  },

  // ────────────────────────── 文本工具 ──────────────────────────
  {
    key: 'text-counter', path: '/text-counter', name: '文本统计', icon: 'Notebook',
    category: 'text', accent: '#10b981',
    short: '字数/词数/行数/UTF-8 字节数', keywords: ['字数', '统计', '文本', 'counter', '字符'],
    desc: '统计字符、中英文词数、行数、段落数与 UTF-8 字节数,附常用文本清理操作。',
  },
  {
    key: 'markdown-editor', path: '/markdown-editor', name: 'Markdown 编辑器', icon: 'EditPen',
    category: 'text', accent: '#8b5cf6',
    short: '左侧编写右侧实时预览', keywords: ['markdown', 'md', '编辑器', '预览'],
    desc: 'Markdown 实时渲染编辑器,带工具栏与代码高亮,可导出 .md 或完整 HTML 文件。',
  },
  {
    key: 'translator', path: '/translator', name: '翻译工具', icon: 'ChatLineSquare',
    category: 'text', accent: '#0ea5e9',
    short: '多语言互译(MyMemory 引擎)', keywords: ['翻译', 'translate', 'english', '中英'],
    desc: '基于 MyMemory 免费翻译接口的多语言互译,支持语种自动检测与语向互换。',
  },

  // ────────────────────────── 图片工具 ──────────────────────────
  {
    key: 'image-converter', path: '/image-converter', name: '图片格式转换', icon: 'Picture',
    category: 'image', accent: '#6366f1',
    short: 'PNG / JPEG / WebP 互转 + 缩放', keywords: ['图片', '转换', 'png', 'jpg', 'webp', '格式'],
    desc: '浏览器本地完成 PNG / JPEG / WebP 互转,可调质量与目标尺寸,支持批量导出。',
  },
  {
    key: 'image-batch-process', path: '/image-batch-process', name: '图片批量处理', icon: 'PictureFilled',
    category: 'image', accent: '#8b5cf6', isNew: true,
    short: '统一缩放/压缩/改格式后逐个下载', keywords: ['批量', '压缩', '缩放', 'resize', '处理'],
    desc: '对一批图片统一执行比例缩放、质量压缩与格式转换,逐个预览体积收益后一键全部下载。',
  },
  {
    key: 'image-watermark', path: '/image-watermark', name: '图片水印', icon: 'Brush',
    category: 'image', accent: '#0ea5e9',
    short: '文字水印:位置/旋转/平铺', keywords: ['水印', 'watermark', '版权', 'logo'],
    desc: '为图片叠加文字水印,支持九宫格定位、透明度、旋转与全局平铺两种模式,导出当日实时预览。',
  },
  {
    key: 'image-stitch', path: '/image-stitch', name: '长图拼接', icon: 'Plus',
    category: 'image', accent: '#f59e0b',
    short: '横向/纵向无缝拼接多图', keywords: ['拼接', '长图', 'stitch', '合并'],
    desc: '按顺序将多张图片横向或纵向拼接为一张长图,可设置间距、对齐方式与背景色。',
  },
  {
    key: 'image-to-pdf', path: '/image-to-pdf', name: '图片转 PDF', icon: 'Document',
    category: 'image', accent: '#ef4444',
    short: '多图按序合成 PDF 文件', keywords: ['pdf', '图片转pdf', '文档'],
    desc: '将若干图片按顺序合成为多页 PDF,自动适配页面尺寸,支持质量与背景设置。',
  },
  {
    key: 'gif-maker', path: '/gif-maker', name: 'GIF 制作', icon: 'VideoPlay',
    category: 'image', accent: '#ec4899',
    short: '多张图片合成动图', keywords: ['gif', '动图', '帧', '动画'],
    desc: '把多张图片按帧顺序合成 GIF 动图,可调帧率与尺寸,使用 gifenc 引擎本地编码。',
  },
  {
    key: 'exif-viewer', path: '/exif-viewer', name: 'EXIF 查看', icon: 'InfoFilled',
    category: 'image', accent: '#14b8a6',
    short: '读取照片拍摄参数与 GPS', keywords: ['exif', '照片', '相机', 'gps', '元数据'],
    desc: '读取 JPG/HEIC 照片中的 EXIF 元数据:相机型号、曝光时间、ISO、焦距与 GPS 经纬度等。',
  },
  {
    key: 'color-tool', path: '/color-tool', name: '颜色工具', icon: 'SoldOut',
    category: 'image', accent: '#a855f7',
    short: '取色 / 换算 / 深浅梯度 / 对比度', keywords: ['颜色', '取色', 'color', 'hex', 'rgb', 'hsl'],
    desc: '系统吸管或图片取色,展示 HEX/RGB/HSL/CMYK 换算与深浅色阶,并校验 WCAG 文本对比度。',
  },
  {
    key: 'qrcode-tool', path: '/qrcode-tool', name: '二维码生成', icon: 'PictureRounded',
    category: 'image', accent: '#06b6d4',
    short: '文本/网址 → 二维码 PNG/SVG', keywords: ['二维码', 'qrcode', '生成', '二维码图片'],
    desc: '把文本或网址生成二维码,可自定义尺寸、前景/背景色、纠错级别并嵌入中心 Logo。',
  },
  {
    key: 'qr-decode', path: '/qr-decode', name: '二维码解码', icon: 'Aim',
    category: 'image', accent: '#f97316',
    short: '拖入图片解析二维码内容', keywords: ['二维码', '解码', '扫描', 'qr'],
    desc: '上传或粘贴含二维码的图片,本地解析出二维码内容,自动识别网址与文本。',
  },

  // ────────────────────────── 数据文件 ──────────────────────────
  {
    key: 'local-media', path: '/local-media', name: '本地媒体浏览器', icon: 'FolderOpened',
    category: 'data', accent: '#0ea5e9', isNew: true,
    short: '浏览本地照片与视频(含 HEIC)', keywords: ['本地', '照片', '视频', 'heic', '相册', 'photo', 'video'],
    desc: '选择本地文件夹,在浏览器内(不上传)浏览照片与视频:自动缩略图、面包屑导航、搜索筛选,支持 JPEG/PNG/WebP/HEIC/HEIF 照片与连续视频播放。',
  },
  {
    key: 'local-manga', path: '/local-manga', name: '本地漫画阅读器', icon: 'Reading',
    category: 'data', accent: '#f43f5e', isNew: true,
    short: '按话翻阅本地漫画图片', keywords: ['漫画', '阅读器', 'manga', '本地', '翻页', '章节'],
    desc: '选择包含「话」子文件夹的根目录,纵向连续翻阅图片;左右按钮或键盘 ←/→ 切换上一话/下一话,支持 jpg/png/gif/webp/avif/heic 等,文件不上传。',
  },
  {
    key: 'csv-viewer', path: '/csv-viewer', name: 'CSV 查看器', icon: 'Grid',
    category: 'data', accent: '#10b981',
    short: '表格化查看/搜索/导出 JSON', keywords: ['csv', '表格', 'excel', '数据'],
    desc: '上传或粘贴 CSV,自动分隔并生成可搜索、分页的表格视图,支持导出 JSON 或 CSV。',
  },
]

/** 所有工具快捷映射,key → meta */
export const TOOL_MAP: Map<string, ToolMeta> = new Map(TOOLS.map((t) => [t.key, t]))

/**
 * 检索命令面板与首页搜索用的统一入口:
 * 依次按 name / short / keywords / 分类做大小写不敏感的包含匹配。
 */
export function searchTools(query: string): ToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return TOOLS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.short.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q)) ||
      (CATEGORIES.find((c) => c.key === t.category)?.label ?? '').includes(q),
  )
}
