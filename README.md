# uTools 在线工具箱

基于 **Vue 3 + TypeScript + Vite + Element Plus** 构建的免费在线工具站,采用「找Tab」式桌面形态:壁纸桌面 + 圆角图标网格 + 系统 Dock + 应用商店,内置 **106 个应用**(77 个桌面应用 + 29 个路由工具)。深色模式、命令面板(⌘/Ctrl + K)、收藏与应用安装均已内置,所有数据仅保存在本机。

## 使用

```bash
npm install
npm run dev        # 启动开发服务器(http://localhost:5199)
npm run build      # 类型检查 + 生产构建
npm run type-check # 仅类型检查
npm run preview    # 预览构建产物
```

> 桌面模式是默认首页;也可通过 `?p=store` / `?p=settings` / `?p=add-app` 直接打开应用商店 / 设置 / 添加 App(使用 query 深链接,不新增路由)。

## 功能总览

### 桌面形态

- **桌面**:壁纸(内置预设)、时钟、中央拼音搜索、图标网格、系统 Dock、右键菜单、双击空白隐藏图标;桌面默认展示 34 个应用,其余从商店「添加」。
- **应用商店**:106 个应用按 8 个分类浏览与搜索,支持「添加」到桌面与「打开」;手动添加任意网站(自定义图标 / 地址)。
- **设置**:外观与壁纸、隐藏应用管理、桌面布局、数据导出 / 导入(JSON 本地备份,无后端)。
- **窗口**:应用以浮层窗口打开(可拖动 / 关闭),路由工具与桌面应用共用统一图标组件。

### 分类计数

| 分类 | 数量 | 示例 |
| ---- | ---- | ---- |
| 效率工具 | 21 | 番茄钟、剪贴板、习惯打卡、四象限笔记、防休眠、算术题生成器 |
| 开发工具 | 29 | JSON 查看器、哈希、CURL 格式化、JWT 解析、HTTP 状态码、浏览器环境检测、WebSocket 测试、端口速查、Whois 查询 |
| 设计资源 | 12 | 图片水印、九宫格切图、随机头像、印章生成器、代码美化截图、字帖生成器 |
| 生活实用 | 24 | 天气、日历、白噪音、节拍器、摸鱼日历、手速测试 |
| 文本工具 | 3 | 文本统计、文本对比、文本行处理 |
| 图片工具 | 12 | 图片压缩、图片裁切、格式转换、拼接、GIF、二维码 |
| 数据文件 | 4 | CSV 查看器、JSON / CSV 转换、进制转换 |
| 局域网 | 1 | 局域网文件直传 |

29 个路由工具(JSON 查看器、编解码、哈希、API 测试器、Markdown 编辑器、图片批量处理等)保持原有分类与页面形态。

翻译功能基于 MyMemory 免费接口(无需 Key,单次 ≤500 字符);WebSocket 测试默认连接公开回显服务。

## 技术要点

- **统一目录**:`src/config/appCatalog.ts` 合并 `tools.ts`(有路由的工具)与 `desktopApps.ts`(浮层窗口应用),导出 `CATALOG` / `CATALOG_MAP` / `STORE_CATEGORIES` / `searchCatalog`;新应用按批次登记在 `RELEASE_BATCHES`,由注册表派生,不要另建目录。
- **桌面状态**:Pinia store `src/stores/desktop.ts`,单键 `utools_desktop-state`(含版本迁移、隐藏应用、自定义站点、导出 / 导入);工具收藏为 `useAppStore`。
- **整页面板**:`StorePage.vue` / `AddAppPage.vue` / `SettingsPage.vue` 均为整页(非抽屉),深链接通过 vue-router `query` 的 `?p=` 切换。
- **关键 API**:qrcode、jsqr、exifr、gifenc、papaparse、diff、sql-formatter、cron-parser + cronstrue、marked、highlight.js、heic2any(按需动态加载);新增应用大量使用 Canvas / Web Audio / Wake Lock / WebSocket 等浏览器原生能力,无额外依赖。
- **构建优化**:manualChunks 拆分 element-plus(vendor-ui)、marked / highlight.js(vendor-markdown)、jimp 等(vendor)。

## 目录结构

```
src/
  main.ts / App.vue            # 入口 + 布局
  components/                  # 通用组件(ToolPage / CommandPalette 等)
  components/desktop/          # DesktopHome / StorePage / SettingsPage / AddAppPage / AppWindow / AppIcon
  config/tools.ts              # 路由工具注册表
  config/desktopApps.ts        # 桌面应用注册表
  config/appCatalog.ts         # 统一目录 + 商店分类 + 发布批次 + 热门排序
  config/wallpapers.ts         # 壁纸预设
  router/index.ts              # 动态路由映射 + 面板 query 深链接
  stores/app.ts                # 工具收藏 / 深色模式
  stores/desktop.ts            # 桌面状态 v2
  views/apps/                  # 桌面应用视图(浮层窗口内渲染)
  views/                       # 29 个路由工具视图 + Home
```

## 隐私

所有工具默认在浏览器本地运行,数据仅存 localStorage;导出的 JSON 备份完全由用户掌握。唯一的外部依赖:翻译(MyMemory)、WebSocket 测试(用户指定地址)、天气 / IP 归属地 / 一言等联网工具,均在界面中明确标注。
