# uTools 在线工具箱

基于 **Vue 3 + TypeScript + Vite + Element Plus** 的免费在线工具站,采用「找Tab」式桌面形态:壁纸桌面 + 圆角图标网格 + 系统 Dock + 应用商店。内置 **111 个应用**(31 个路由工具 + 80 个桌面应用),覆盖开发、效率、设计、生活、图片、文本、数据文件、局域网八类。

数据默认只保存在浏览器本地(localStorage),除[下文列出的联网工具](#联网工具与隐私)外,所有处理都在浏览器内完成;可选接入 Supabase 做多端云同步。

> 项目没有单独的计划文件:**交接说明、未完成项与下一步计划统一维护在 [HANDOVER.md](./HANDOVER.md)**(第 0 节速览、第 6 节未完成项、第 9 节下次接手推荐动作)。

## 快速开始

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5199(已开启局域网访问)
npm run build      # 类型检查 + 生产构建,产物在 dist/
npm run type-check # 仅类型检查(vue-tsc --noEmit)
npm run preview    # 本地预览构建产物
```

Node 版本要求 `^20.19.0 || >=22.12.0`(Vite 7 的要求)。项目没有自动化测试,改动后的校验方式是 `type-check` + `build`,再到浏览器里实际操作一遍。

## 功能总览

### 桌面形态

- **桌面(默认首页)**:壁纸(11 组内置:6 组渐变 + 5 张内联 SVG,也可上传自定义)、顶部系统栏、时钟、中央拼音搜索、圆角图标网格、底部 Dock、右键菜单、双击空白隐藏图标;图标大小 / 风格 / 玻璃质感 / 标签等偏好可调。默认桌面放 15 个应用,其余从商店「添加」。
- **应用商店**(`/?p=store`):全部应用按 8 个分类浏览,分「最新上架 / 最受欢迎 / 全部应用」三个分区;支持拼音全拼、首字母与别名搜索,结果按「最近打开 / 最匹配 / 相关结果」分组;网格 / 列表视图切换(持久化)。
- **设置**(`/?p=settings`):壁纸、首页形态、图标风格与大小、外观与交互、Dock、隐藏应用管理(可恢复)、云同步账户、JSON 备份导出 / 导入、本地数据用量、重置布局。
- **添加 App**(`/?p=add-app`):手动添加任意网站(自定义图标 / 地址)。页面里提供一段书签小工具代码,在任意网页点一下即带着网址跳回本站添加(`/?add=<网址>&name=<标题>`)。
- **两种打开方式**:工作区 / 画布 / 阅读类的 16 个应用以独立路径整页打开(左上角浮动返回按钮,浏览器后退回到来源页);其余应用在可拖动的圆角浮层窗口中打开。
- **经典列表模式**:在「设置 → 首页形态 → 经典列表」可切回侧边栏 + 卡片的传统布局,只列 31 个路由工具。
- **快捷键**:`Ctrl/⌘ + K` 在桌面模式下聚焦搜索框,在经典列表模式下打开命令面板。
- 支持深色模式。

整页打开的 16 个应用及其路径:

| 应用 | 路径 | 应用 | 路径 |
| --- | --- | --- | --- |
| JSON 查看器 | `/json-viewer` | 本地媒体浏览器 | `/local-media` |
| JSON 生成器 | `/json-generator` | 本地漫画阅读器 | `/local-manga` |
| 长图拼接 | `/image-stitch` | Office 文档预览 | `/office-viewer` |
| Markdown 编辑器 | `/markdown-editor` | PDF 工具箱 | `/pdf-toolkit` |
| 文本对比 | `/diff-tool` | 证件照制作 | `/id-photo` |
| CSV 查看器 | `/csv-viewer` | PDF 转图片 | `/app/pdf-to-image` |
| SVG 编辑器 | `/app/svg-editor` | HTML 编辑器 | `/app/html-editor` |
| 画板 | `/app/drawing-board` | 四象限笔记 | `/app/quadrant-notes` |

### 应用目录(111 个)

「路由工具 / 桌面应用」指该分类中两类应用的数量。

| 分类 | 数量 | 路由工具 / 桌面应用 | 应用 |
| --- | --- | --- | --- |
| 效率工具 | 21 | 0 / 21 | 智能剪贴板、两步验证码、世界时钟、番茄钟、待办清单、科学计算器、密码生成器、秒表与计时器、金额大写转换、文本统计、表情符号、日历、文字转语音、罗马数字转换、日期计算器、习惯打卡、文本行处理、字节换算、四象限笔记、防休眠、算术题生成器 |
| 开发工具 | 29 | 12 / 17 | JSON 查看器、JSON 生成器、代码生成器、时间戳转换、文本对比、SQL 格式化、Cron 解析、正则测试器、UUID 生成器、编码解码、哈希生成器、API 测试器、Nginx 配置生成器、进制转换器、摩斯密码、IP 归属地查询、密码强度检测、文本加密、URL 参数解析、JWT 解析、ASCII 码表、HTTP 状态码查询、CURL 格式化、浏览器环境检测、WebSocket 在线测试、HTML 编辑器、IMEI 校验与生成、端口速查、Whois 查询 |
| 设计资源 | 13 | 0 / 13 | CSS 渐变生成器、阴影 / 圆角生成器、配色方案、颜色工具、图片转字符画、九宫格切图、图片转 Base64、SVG 图案生成器、随机头像生成、印章生成器、代码美化截图、字帖生成器、SVG 编辑器 |
| 生活实用 | 24 | 0 / 24 | 白噪音混音台、网络测速、乐器体验馆、单位换算、呼吸训练、记账本、打字练习、画板、随机转盘、便签墙、纪念日倒计时、健康计算器、屏幕与键盘检测、汇率换算、天气查询、一言卡片、身份证解析、摸鱼日历、贷款计算器、随机工具、AA 分账、生物钟、节拍器、手速测试 |
| 文本工具 | 3 | 3 / 0 | 文本统计、Markdown 编辑器、翻译工具 |
| 图片工具 | 13 | 10 / 3 | 图片格式转换、图片批量处理、图片水印、长图拼接、图片转 PDF、GIF 制作、EXIF 查看、颜色工具、二维码生成、证件照制作、图片压缩、图片裁切、PDF 转图片 |
| 数据文件 | 7 | 5 / 2 | 本地媒体浏览器、本地漫画阅读器、CSV 查看器、Office 文档预览、PDF 工具箱、JSON / CSV 转换、在线解压 |
| 局域网 | 1 | 1 / 0 | 局域网文件直传 |

### 云同步(可选)

不配置 Supabase 时,站点完全等价于纯本地模式。配置后可在「设置 → 账户管理 → 登录 · 云同步」输入邮箱并「发送登录链接」,在同一浏览器里点击邮件中的链接(魔法链接)即自动登录,不需要密码和验证码:

1. 复制 `.env.example` 为 `.env`,填入 Supabase 项目的 URL 与 anon key(值不要加引号;`.env` 不入库,线上在 Cloudflare Pages 的环境变量里配置同名变量)。
2. Supabase 项目需要有 `app_state` 表(开启 RLS,每个用户只能读写自己的行),并在 Authentication 里启用邮箱登录(Magic Link)。建表 SQL 没有入库,字段以 `src/stores/sync.ts` 的 `AppStateRow` 为准:`scope`、`data`(jsonb)、`schema_version`、`updated_at`、`deleted`。

同步行为:

- localStorage 始终是运行时数据源,云端只做备份与多端同步。登录 / 启动时全量拉取;本地写入后防抖 2 秒推送;离线时的待推队列落在本机,联网后补推。
- 同一范围内冲突时按 `updated_at`「最后写入胜」,不做逐条合并;拉取时跳过带删除标记的行。
- 首批同步 4 个范围,在 `src/config/syncScopes.ts` 里声明(新应用接入加一行即可):桌面布局与偏好、待办清单、便签墙、记账本。两步验证码等敏感数据不同步。

### 联网工具与隐私

绝大多数工具离线可用。会访问第三方的只有下面这些,其中天气、IP 归属地、汇率、测速、翻译在商店里带「需联网」徽标,其余在界面内有明确提示:

| 工具 | 访问的服务 | 说明 |
| --- | --- | --- |
| 翻译工具 | LibreTranslate 公开镜像(`translate.disroot.org`、`libretranslate.com`)→ MyMemory | 前者失败自动降级到后者;超过 490 字符按句分段发送 |
| 天气查询 | `open-meteo.com` | 城市搜索与天气预报 |
| IP 归属地查询 | `ipwho.is` | 查询本机或指定 IP |
| 汇率换算 | `open.er-api.com` | 汇率 |
| 网络测速 | `speed.cloudflare.com` | 上下行测速 |
| 一言卡片 | `v1.hitokoto.cn` | 获取一句话 |
| Whois 查询 | `rdap.org` | 域名 / IP 注册信息 |
| 局域网文件直传 | `broker.emqx.io`(MQTT 信令)+ Google / Cloudflare STUN | 只交换信令,文件走 WebRTC 点对点,不经服务器中转 |
| API 测试器、WebSocket 在线测试 | 用户指定的地址 | 默认分别是 `httpbin.org`、`ws.postman-echo.com` |
| EXIF 查看 | 高德地图、Google 地图 | 仅在点击「高德地图打开 / Google Maps」链接时跳转 |
| 云同步 | Supabase | 仅在配置并登录后 |

另有几处间接的外部请求:Markdown 编辑器导出的 HTML 文件引用 `cdn.jsdelivr.net` 上的代码高亮样式(只影响导出文件),工具栏「图片」按钮插入的示例地址指向 `picsum.photos`(预览时才加载);添加自定义网站时若填写了图标地址,浏览器会向该地址请求图标。

## 技术要点

- **统一目录**:`src/config/appCatalog.ts` 把 `tools.ts`(有路由的「工具」,`kind = tool`)与 `desktopApps.ts`(桌面「应用」,`kind = app`)合并成 `CATALOG`。商店、桌面、搜索只认这一份,不要另建目录。同文件里的 `RELEASE_BATCHES` 决定「最新上架」排序,`HOT_LIST` 决定「最受欢迎」,`LOGIN_REQUIRED` 是商店卡片「需联网」徽标的名单,`EXCLUDED_KEYS` 是明确不做、不进目录的应用。
- **目录是静态的,状态只存「用户选了哪些 key」**:桌面状态在 Pinia store `src/stores/desktop.ts`,单键 `utools_desktop-state`(带版本号与 v1 迁移),应用分「已添加 / 已隐藏(可恢复)/ 未添加(仅商店可见)」三态。新增应用后老用户刷新即可在商店看到。
- **路由**:`src/router/index.ts` 由 `tools.ts` 自动生成,视图用 `import.meta.glob` 懒加载;整页打开且没有路由的桌面应用挂在 `/app/<key>`;商店 / 设置 / 添加 App 是整页面板,用 `?p=` query 切换。
- **本地存储**:`src/utils/common.ts` 的 `storage` 封装统一加 `utools_` 前缀,并在写入后派发 `utools:ls-mutated` 事件供云同步引擎监听。
- **Element Plus 按需引入**:`unplugin-vue-components` + `unplugin-element-plus`,模板里的 `<el-*>` 与 `ElMessage` 自动按组件引入样式。
- **分包**:首屏只加载 `vendor-core`(vue / vue-router / pinia / pinyin-pro)与入口 chunk(合计约 0.94MB,gzip 约 0.35MB);`marked` / `highlight.js`(`vendor-markdown`)、`heic2any`、pdf.js、`mqtt` 等重库都跟随各自的懒加载页面。`vite.config.ts` 里的 `onlyExplicitManualChunks: true` 必须保留,否则 1MB 的 `vendor-markdown` 会被拖回首屏。
- **PDF**:`pdfjs-dist` 负责解析与渲染(worker 入口 `src/pdfWorker.ts` 先装 `utils/pdfPolyfills.ts` 的垫片以兼容 Safari 18.x),`pdf-lib` 负责 PDF 工具箱的文档重写。

## 目录结构

```
uTools/
├── index.html
├── vite.config.ts / tsconfig.json / package.json
├── .env.example               # Supabase 两个变量(复制为 .env,.env 不入库)
├── README.md                  # 本文件:使用与架构
├── HANDOVER.md                # 交接说明:速览 / 未完成项 / 踩坑清单 / 时间线
└── src/
    ├── main.ts / App.vue      # 入口;App.vue 按模式渲染:整页二级页 / 桌面 / 经典列表
    ├── router/index.ts        # 由 tools.ts 生成路由 + /app/<key> 整页应用路由
    ├── config/
    │   ├── tools.ts           # 31 个路由工具注册表
    │   ├── desktopApps.ts     # 82 条桌面应用注册表(2 条被排除)
    │   ├── appCatalog.ts      # 统一目录:合并两套注册表
    │   ├── wallpapers.ts      # 壁纸预设
    │   ├── collageLayouts.ts  # 长图拼接的 135 个布局模板
    │   └── syncScopes.ts      # 云同步范围声明
    ├── stores/
    │   ├── desktop.ts         # 桌面状态
    │   ├── app.ts             # 深色模式 + 工具收藏
    │   └── sync.ts            # 云同步引擎
    ├── services/supabase.ts   # Supabase 客户端(动态加载,未配置时返回 null)
    ├── components/
    │   ├── ToolPage.vue       # 路由工具页通用外壳
    │   ├── Sidebar.vue / ToolCard.vue / CommandPalette.vue   # 经典列表模式
    │   └── desktop/           # DesktopHome / StorePage / SettingsPage / AddAppPage / AppWindow / AppIcon
    ├── utils/                 # common(存储 / 下载 / 复制)/ image / collage / zip / pdfPolyfills
    ├── pdfWorker.ts           # pdf.js worker 入口
    ├── styles/                # index.css / desktop-pages.css
    ├── types/                 # tool.ts / components.d.ts(自动生成)
    └── views/
        ├── Home.vue + 31 个路由工具视图
        └── apps/              # 82 个桌面应用视图
```

## 新增一个应用

1. 写视图。路由工具放 `src/views/YourTool.vue`,并在 `config/tools.ts` 追加一条 `ToolMeta`(路由自动生成);桌面应用放 `src/views/apps/YourApp.vue`,并在 `config/desktopApps.ts` 注册。纯前端优先,不轻易引入新依赖。
2. 在 `config/appCatalog.ts` 里补元数据:`RELEASE_BATCHES` 追加一批(漏了就不会出现在「最新上架」);需要整页打开的加入 `FULLSCREEN_APPS`;用了新分类的,要同时扩展 `desktopApps.ts` 的 `category` 联合类型和 `appCatalog.ts` 的 `APP_CATEGORY_MAP`。
3. `npm run type-check` → `npm run build`(`build` 必须跑,模板编译问题只在构建阶段暴露)→ 在浏览器里从商店找到卡片、打开并实际操作一遍。
4. 提交,并同步 `HANDOVER.md` 第 3 节的数量与第 8 节的时间线。

更细的约定与踩坑清单见 [HANDOVER.md](./HANDOVER.md) 第 1、4、7 节。

## 部署

`npm run build` 产出纯静态文件(`dist/`),可部署到任意静态托管。当前线上部署在 Cloudflare Pages,推送 GitHub 仓库 `chuheridangwu/uTools` 的 `main` 分支后自动构建;要启用云同步,在 Pages 项目的环境变量里配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。

## 已知限制

- **云同步目前只有「桌面布局与偏好」会自动推送**:待办 / 便签 / 记账三个应用直接写 localStorage,不经过 `storage.set`,不会触发同步队列。属于已知缺陷,修复方案涉及首次登录时的冲突策略,待定后再改(见 HANDOVER 第 6 节 C)。
- **局域网文件直传**的在线名单来自公共 MQTT 大厅(全球可见,不是真正的局域网发现);没有 TURN 中继,跨网络或对称 NAT 下可能连不上;6 位配对码可被猜测,不要用来给陌生人传敏感文件。
- **证件照制作**的去背景基于纯色背景建模,复杂背景需要用擦除 / 恢复画笔手动修整。
- **Excel 解析依赖 `xlsx`(SheetJS 0.18.5)** 有官方未修复的安全告警;目前只用于在本地解析用户自己的文件。
