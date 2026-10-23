# uTools 在线工具箱

基于 **Vue 3 + TypeScript + Vite + Element Plus** 构建的免费在线工具站,聚合 29 个常用工具,涵盖开发、文本、图片、数据处理与生活便捷化场景。深色模式、命令面板(⌘/Ctrl + K)、工具收藏与最近使用均已内置。

## 使用

```bash
npm install
npm run dev        # 启动开发服务器(http://localhost:5199)
npm run build      # 类型检查 + 生产构建
npm run type-check # 仅类型检查
npm run preview    # 预览构建产物
```

## 功能总览(29 个工具)

| 分类 | 工具 |
| ---- | ---- |
| 开发 | JSON 查看器、JSON 生成器、代码生成器、UUID 生成器、编解码工具、哈希生成器、API 测试器、程序员计算器 |
| 文本 | 字数统计、正则测试、时间戳转换、Markdown 编辑器、文本对比、SQL 格式化、Cron 解析 |
| 图片 | 图片格式转换、图片批量处理、图片水印、图片拼接、图片转 PDF、GIF 制作、图片 EXIF 查看、二维码生成、二维码识别、屏幕取色(Chromium EyeDropper) |
| 数据 | CSV 查看器、书签管理器 |
| 生活 | 便签本、翻译 |

翻译功能基于 MyMemory 免费接口(无需 Key,单次 ≤500 字符)。

## 技术要点

- **架构**:`src/config/tools.ts` 为唯一工具注册表(29 工具 × 5 分类);路由通过 `import.meta.glob('../views/*.vue')` + 文件名 kebab→Pascal 约定自动懒加载映射;Sidebar / Home / CommandPalette 全部从 tools.ts 渲染。
- **状态**:Pinia store `useAppStore`——dark、favorites、recents(localStorage key 前缀 `utools_`)。
- **通用辅助**:`src/utils/common.ts`(copyText / downloadBlob / downloadText / formatSize / baseName / storage);图片工具统一走 `src/utils/image.ts`(loadImage / calcTargetSize / drawImageTo / canvasToBlob / renameWithExt)。
- **关键 API**:qrcode、jsqr、exifr、gifenc(GIFEncoder)、papaparse、diff、sql-formatter、cron-parser + cronstrue(zh_CN)、marked v18(自定义 `renderer.code` token 结构)、highlight.js。
- **构建优化**:manualChunks 将 element-plus(vendor-ui)、marked/highlight.js(vendor-markdown)、jimp 等(vendor)分包。

## 目录结构

```
src/
  main.ts / App.vue        # 入口 + 布局
  components/              # Sidebar / CommandPalette / ToolCard / ToolPage / JsonTreeNode
  config/tools.ts          # 工具注册表(单一数据源)
  router/index.ts          # 动态路由映射
  stores/app.ts            # Pinia 全局状态
  styles/index.css         # 主题变量 + dark 模式
  utils/                   # common.ts(下载/复制/存储)、image.ts(图片处理)
  views/                   # 29 个工具视图 + Home,全部为单 <script setup lang="ts">
```

浏览器内全部本地运行(数据仅存 localStorage);唯一网络依赖为 API 测试、翻译(MyMemory)与书签站点图标(favicon.im)。
