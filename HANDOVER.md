# HANDOVER 交接文档

项目最后状态(交接时点):`npm run type-check` 0 错误,`npm run build` 通过,dev server(http://localhost:5199)可正常起服并返回首页 200。远程仓库已配置:https://github.com/chuheridangwu/uTools.git(分支 `main`)。

## 当前状态(2026-11-10,接手时以本节为准)

> 第 1~6 节记录的是工具站早期(2026-10-29 前后)状态;项目此后新增了「桌面模式 / 应用商店」,以下为最新事实。

- **双形态**:`src/config/tools.ts` 是有路由的「工具」注册表;`src/config/desktopApps.ts` 是无路由、以浮层窗口打开的「桌面应用」注册表(分类固定为 效率工具 / 开发工具 / 设计资源 / 生活实用)。桌面状态在 `src/stores/desktop.ts`(localStorage 前缀 `utools_desktop-`),窗口组件 `src/components/desktop/AppWindow.vue`,应用视图统一放 `src/views/apps/*.vue`,由注册表里的 `comp` 动态 import。
- **当前应用数:统一目录 `CATALOG` 95 个(66 桌面应用 + 29 工具)**;桌面默认展示 34 个,其余在应用商店里「添加」。自 2026-11-09 起按「每批 5 个应用」的节奏扩充,每批流程:`npm run type-check` → `npm run build` → commit → push。
- **2026-11-10 起主线任务改为「完整模仿找Tab(https://www.zhaotab.com/)」**,不再只是按批加应用;详见第 8 节。**接手时优先看第 9 节「任务看板」**,那里是最新且唯一的进度事实来源。
- **第 0 节硬性约定仍然有效**。push 报 `HTTP2 framing layer` 或 443 超时时,直接用 `git -c http.proxy=http://127.0.0.1:7897 push origin main`(本机 Clash 系代理),不要写死进 git config。
- **必须跑 `npm run build`,不能只跑 type-check**:`vue-tsc --noEmit` 不做模板 codegen,模板编译错误只会在 `vite build` 阶段暴露(详见第 7 节的踩坑)。

## 0. 接手后每次必做事项(硬性约定)

- **每次修改完成后,必须自动执行三步,不要等用户提醒:**
  1. `git add <本次改动的文件>`
  2. `git commit -m "<描述本次修改的信息>"`(中文一句话,格式如 `feat: …` / `fix: …`)
  3. `git push origin main`
- 提交前用 `npm run type-check`(即 `vue-tsc --noEmit`)确认 0 错误再提交。
- **不要**配置 fswatch/watchexec 等文件监听自动提交机制,用户已明确拒绝(2026-10-29);提交动作由 AI 会话在每次修改后手动执行。

## 1. 完成清单

- 基础设施:package.json、vite.config.ts、tsconfig.json、index.html、src/env.d.ts、public/favicon.svg。
- 核心:`src/types/tool.ts`、`src/config/tools.ts`(27 工具注册表)、`src/router/index.ts`(import.meta.glob 动态映射)、`src/stores/app.ts`、`src/styles/index.css`、`src/main.ts`、`src/App.vue`。
- 组件:Sidebar、CommandPalette(⌘/Ctrl+K)、ToolCard、ToolPage、JsonTreeNode。
- utils:`common.ts`(copyText/downloadBlob/downloadText/formatSize=**formatBytes 别名**/baseName/pad2/toNumber/storage)、`image.ts`(loadImage/calcTargetSize/drawImageTo/canvasToBlob/renameWithExt)。
- 视图:27 个工具 + Home 全部完成并通过类型检查。
- **本地媒体浏览器 `LocalMedia.vue`**(key `local-media`,data 分类):移植 `../local_video.html`(父目录同名文件)并扩展照片支持。
  - 照片:JPEG/JPG/PNG/WebP/HEIC/HEIF;HEIC/HEIF 用 `heic2any` 前端转码(动态 import,独立 chunk 约 1.35MB,仅遇到 HEIC 时加载)。
  - 视频:canvas 截帧缩略图 + 连续播放列表(范围=当前目录及子目录)+ 播完自动下一集。
  - 交互:面包屑导航、当前目录搜索、类型筛选/排序、照片大图(←/→ 切换、Esc 关闭)、全屏播放器。
  - 所有文件仅通过 Object URL 在内存访问,卸载时统一 revoke,不上传。
  - **已踩坑(务必注意)**:`onPick` 中必须先把 `input.files` 快照成数组再清空 `input.value`,否则 Blink 会一并清空该 FileList,导致读不到任何文件(表现为“选择文件夹后什么都不显示”)。
- **视频播放列表显示/隐藏按钮**(2026-10-29,commit `05949e8`):
  - `LocalMedia.vue` 视频播放器底栏新增「隐藏列表 / 显示列表」切换按钮,状态 `showPlaylist = ref(true)`。
  - 播放列表 `<aside>` 用 `v-show`(非 `v-if`)切换,不重建 DOM、不丢缩略图状态;隐藏后 `.video-wrap` 因 `flex: 1` 自动占满全宽。
  - 图标 `Fold` / `Expand`(从 `@element-plus/icons-vue` 引入);状态跨自动连播保留,不随 `playIndex` 重置。
- **音频播放器**(2026-10-29,同日会话):
  - `LocalMedia.vue` 新增 `AUDIO_EXTS = ['mp3', 'm4a']`,`MediaItem.kind` 扩展为 `'image' | 'video' | 'audio'`(视频为 `video`)。
  - 独立音频播放器 overlay(不与视频复用):`openAudio/playAudioIndex/nextAudio/closeAudio`,状态 `audioOpen/audioIndex/audioPlaylist/audioUrl/audioError/showAudioPlaylist`;支持自动连播下一首、Esc 关闭、隐藏/显示列表、下载。
  - 交互规则:`kindFilter` 加「音频」计数筛选;按类型排序优先级 照片→音频→视频(`kindRank`);打开音频会 `closePlayer()`、打开视频会 `closeAudio()`、`onPick` 两者都关;音频 `prepareThumb` 直接标记 `done` 无缩略图(卡片与列表用 `Headset` 图标占位)。
  - 音频播放列表范围与视频一致:当前目录及子目录(`audiosUnder`)。
- **已移除功能**:便签、书签管理、程序员计算器三个工具(含视图、注册表条目、life 分类),以及“最近使用”特性(store recents/visitTool、侧边栏与首页区块、路由 afterEach 记录)。

## 2. 本次会话关键修复(供回溯)

- `vite.config.ts` 首行残留中文说明注释(带 `:$` 特殊字符)导致 TS1127 → 整行删除。
- `ApiTester.vue` / `CsvViewer.vue`:两条 `const` 语句合并一行(`('GET')const url`)→ 拆行。
- `CodeGenerator.vue`:模板内联箭头函数中嵌双引号转义导致语法错 → 抽出 `fillSample()`。
- 11 个视图的 `el-upload :on-change` 内联箭头在模板里不可写 TS 注解 → 统一抽为 `const onUploadChange = (f: UploadFile) => ...`,并 `import type { UploadFile } from 'element-plus'`。
- `downloadBlob` 参数改为 `Blob | string`(兼容);调用点若参数顺序颠倒(文件名在前)已逐个换回 `(blob, filename)`。
- `common.ts` 新增 `export const formatBytes = formatSize`。
- `BookmarkManager.vue` / `ImageBatchProcess.vue` / `ImageConverter.vue`:模板中不能直接用全局 `URL` 构造器(会被解析为组件实例属性)→ 新增脚本内 helper(`hostOf` / `objUrlOf`)。
- `CronParser.vue`:cron-parser v5 无 `parseExpression` 命名导出 → 用 `CronExpressionParser.parse(expr, { currentDate })`;`CronDate` 无 `.format()` → `dayjs(it.next().toDate()).format(...)`。
- `DiffTool.vue`:`buildAligned(changes: Change[])` 参数遮蔽同名 ref,内部误用 `changes.value` → 去掉 `.value`。
- `ExifViewer.vue`:exifr options 去掉 `ifd0: true`(FormatOptions 类型不接受 boolean)。
- `GifMaker.vue`:frames 数据类型定为 `Uint8Array`(writeFrame 参数要求);gifenc 模块在 `env.d.ts` 手写 declare。
- `JsonTreeNode.vue`:`props.depth` 可选 → `(props.depth ?? 0) < 1`。
- `StickyNotes.vue` / `BookmarkManager.vue`:弹窗标题表达式中 `editing.id` 空值告警 → `editing?.id`。

## 3. 历史 bug(更早会话)

- JsonGenerator 的 strsJoin 问题已不存在(grep 无匹配,视为已修复)。
- Timestamp.vue 的 `funciton` 拼写、模板 filter `{{ now / 1000 | 0 }}`、按钮回调错误变量等已在早期修复并通过类型检查。
- marked v18 的 `setOptions({highlight})` 已废弃 → 用 `marked.use({ renderer: { code(token) { const { text, lang } = token } } })`。

## 4. 版本固定(依赖 API 事实)

| 依赖 | 要点 |
| --- | --- |
| cron-parser ^5.10.2 | 仅 `CronExpressionParser.parse`;`next()` 返回 CronDate,用 `.toDate()` |
| cronstrue ^3.38.0 | `import cronstrue from 'cronstrue/i18n'` + `{ locale: 'zh_CN' }` |
| marked ^18.1.1 | renderer.code 收到 token 对象 |
| gifenc ^1.0.3 | `GIFEncoder() / quantize / applyPalette`;`writeFrame(Uint8Array, w, h, { palette, delay })` |
| element-plus ^2.14.7 | dark css-vars 已在 styles/index.css 引入 |
| exifr ^7.1.3 | GPS 在 `data.latitude/longitude` |
| heic2any ^0.0.4 | `heic2any({ blob, toType: 'image/jpeg', quality })` 返回 `Blob \| Blob[]`;仅 Chromium/Firefox 可用(Safari 可原生解码) |

## 5. 待办 / 注意事项

- ~~GitHub 推送未执行~~ **已完成**(2026-10-29):remote `origin` = https://github.com/chuheridangwu/uTools.git,推送用 `git push origin main`(HTTPS 凭据已可用)。
- 构建警告:vendor-ui(942 KB)与 vendor(1.9 MB,含 jimp)超过 1 MB 提示;如需优化可对 jimp 相关视图按需动态 import 或降级。
- 快捷键:⌘/Ctrl + K 命令面板;dark 模式、收藏持久化(localStorage 前缀 `utools_`)。
- 翻译:MyMemory 不支持 auto 语种,当前用 CJK 占比启发式检测;单次请求 ≤500 字符。
- EyeDropper(屏幕取色)仅 Chromium 系浏览器支持,ColorTool 已做能力判断。
- dev 端口固定 5199(`server.host: true`)。

## 6. 会话记录(2026-10-29)

**已做:**
- **本地漫画阅读器 `LocalManga.vue`**(key `local-manga`,data 分类,`manga.html` 移植):
  - 交互与原版一致:选择含「话」子文件夹的根目录 → 纵向连续翻阅图片、左右浮动按钮/键盘 ←→ 切话、字段为一话一文件夹。
  - 与原版差异(站内一致性考虑):(1) 用 `input[webkitdirectory]` 取代 `showDirectoryPicker`(Safari 不支持后者);(2) 排序统一 `naturalCompare`;(3) HEIC/HEIF 单页用 heic2any 本地转码(动态 import + 信号量限制并发 2);(4) 新增章节 `el-select` 直达跳转;(5) 切话时 revoke 上一话全部 Object URL。
  - 章节定义:根目录一级子文件夹;子文件夹内图片含更深层级(`startsWith` 匹配);根目录直接散落的图片不入话(与原版一致)。
  - 验证:`vue-tsc` 0 错误、build 通过、dev server http://localhost:5199/local-manga 渲染正常(浏览器实测)。
- **局域网文件直传 `LanTransfer.vue`**(key `lan-transfer`,dev 分类,依赖新增 `mqtt@^5.js`)(2026-11-09):
  - UX 对标找Tab「局域网文件共享」(用户提供截图):随机动物昵称(重名自动加序号)、在线设备大厅、点连接 → 对方 ElMessageBox 接受/拒绝(拒绝时发起端提示)、接受后进入双面板(发送:点击/拖拽选择;接收:进度+保存),双方可同时收发,另有文本互传。
  - 架构:在线名单 + 配对信令(invite/accept/reject/offer/answer/ice)走公共 MQTT `wss://broker.emqx.io:8084/mqtt`(主题 `utools/lanx/lobby/v1` 与 `utools/lanx/sig/v1/<id>`),**文件数据本体走 WebRTC DataChannel 点对点不经服务器**;MQTT 动态 import(lazy chunk)。
  - 手动配对兜底(切换按钮):复制粘贴压缩 SDP 码(CompressionStream deflate-raw 前缀 LT1/LT0)+ 二维码,用于 MQTT 不可达场景;两套模式复用同一传输协议(meta→64KB chunks→done/ack,bufferedAmount 背压 4MB/2MB)。
  - **重要环境事实(踩坑)**:OpenCode 内置 Review 浏览器**没有可用的 WebRTC 能力**(本机最小化环回测试中 localDescription 无任何 candidate,ICE 恒为 new)——自动化测不了真实连接,只有 UI/信令流程可测(已测:大厅互见、邀请弹窗、接受信令)。**真实连通性必须由用户在真 Chrome/手机上验证;写进文档避免下次会话误判为代码 bug 而浪费时间**。
  - README 的「纯前端工具」约束:lan-transfer 使用了第三方公共 MQTT 中继用于握手,文件内容不走中继——desc 里已注明。
  - 2026-11-09 补充:大厅顶部新增「本页网址二维码」(`location.origin + pathname`,`renderQr` 生成),手机扫码直接打开本页;本地 dev 时指向 localhost,部署后自动为正式域名。
  - 2026-11-09 补充:新增独立分类 `lan`「局域网」(`ToolCategoryKey` 扩展 + CATEGORIES 尾部),lan-transfer 从 dev 迁入;分类是单一数据源,首页 tab/侧边栏/命令面板自动生效。**用户再次强调:每次修改后必须主动 commit + push(见第 0 节)**。
- 视频播放器:新增播放列表显示/隐藏按钮(见完成清单对应条目),`vue-tsc` 0 错误后已提交推送(commit `05949e8`)。
- 配置远程仓库 `origin`(GitHub HTTPS),推送链路已验证可用。
- 起草并否决了 fswatch + launchd 自动提交方案:`brew install fswatch` 执行中途被用户打断,**未安装成功、未写入任何 LaunchAgent**;如后续发现 `~/Library/LaunchAgents/` 有残留 plist 应删除。

**踩过的坑:**
- **文件名排序与 Finder 不一致**:`localeCompare(x, 'zh-Hans-CN')` 默认数字按字典序(1,10,100,2),Folders 里的剧集如 `10 - …`、`100 - …` 全排在 "1" 开头。已在 `LocalMedia.vue` 增加 `naturalCompare()`(`{ numeric: true }`),替换全部 5 处比较(子文件夹、网格名称排序、视频/音频播放列表路径排序)——**以后新增排序一律用 `naturalCompare`,不要再直接写 localeCompare**。
- 注意工具使用细节:编辑之前未在本次会话读过的文件时,`find/replace` 必须基于精确原文,或直接 `read` 后再改,否则会匹配失败。
- **git 推 GitHub 连不上(端口 443 超时 / HTTP2 framing layer 错误)**:本机走系统代理(Clash 系,`127.0.0.1:7897`),但 git CLI 不读 macOS 系统代理设置。解决:`git -c http.proxy=http://127.0.0.1:7897 push origin main`。以后凡 push 失败先试这个;不要把 proxy 写死进 git config(代理软件没开会反而断链)。

**用户决策(尚未做):**
- 用户决定**不**部署任何自动提交的永久机制,改为「AI 每次修改后手动 commit+push」,约定见第 0 节。
- 「手机在线收听有声书」需求**已放弃**(2026-10-29,当晚讨论过 R2 上传 / 转码压缩 / Audiobookshelf 自托管等方案,均未实施,本地媒体工具保持纯前端内存播放,不再讨论)。

## 7. 会话记录(2026-11-10)

**已做:**
- 接手时工作区有 5 个「已写完但未提交」的应用(九宫格切图、文本加密、AA 分账、生物钟、图片转 Base64)及注册表改动。type-check 通过但 build 失败,修复两处模板问题后构建通过,提交 `e947574` 并推送。
- 按既有节奏继续新增第二批 5 个应用,提交 `2783321` 并推送:
  - `Metronome.vue` 节拍器:Web Audio lookahead 调度器(提前 120ms 排音)、拍号 / 八分~十六分细分 / 小节重音 / 音色 / 音量 / Tap Tempo,卸载时关闭 AudioContext。
  - `UrlParser.vue` URL 参数解析:拆解 query(自动解码、保留同名多值)、复制查询串或 JSON、一键载入构建器;构建模式可编辑键值对并切换空格编码为 `+` 或 `%20`。
  - `JwtDecoder.vue` JWT 解析:Base64URL 解码 Header/Payload、iat/nbf/exp 时间换算与过期状态、示例 Token;明确标注「只解码不校验签名」。
  - `TextLineTools.vue` 文本行处理:修剪 / 去空行 / 过滤 / 去重 / 大小写 / 自然排序 / 反转 / 编号 / 前后缀的固定顺序流水线,实时预览、导出 txt。
  - `SvgPattern.vue` SVG 图案生成器:圆点 / 网格 / 斜线 / 棋盘 / 波浪五种 `<pattern>` 平铺,配色与尺寸可调,复制 SVG / CSS 背景或下载 .svg。
- 五个应用均为纯前端、无新增依赖,构建后各自产出独立 lazy chunk。

**踩坑(重要,务必记住):**
- **Vue 模板里 `v-if` 和 `<template v-else>` 之间不能夹其他元素**。若在两者之间插入 `<input type="file" hidden>` 之类的元素,`@vue/compiler-core` codegen 阶段会崩 `Cannot read properties of undefined (reading 'type')` / `Codegen node is missing for element/if/for node`;而 `vue-tsc --noEmit` 仍是 0 错误,只有 `vite build` 会失败。修法:把中间元素移到 `v-if` 之前,让 `v-else` 紧邻 `v-if`(中间只留 HTML 注释是安全的)。本次已修 `ImageToBase64.vue` 与 `NineGridCut.vue`。
- 快速定位同类问题:用 `node -e` 调 `@vue/compiler-sfc` 的 `compileTemplate()` 批量扫 `src/views/apps/*.vue`,几秒即可找出所有编译崩溃的文件。

**待办 / 注意:**
- `README.md` 仍是早期版本(只写 27 个工具、未提桌面模式与应用商店),需要对外说明时再更新。
- 构建仍有 vendor(2.2MB)/ vendor-markdown(1.0MB)/ vendor-ui(943KB)/ heic2any(1.35MB)超 1MB 的提示,属既有情况,非本次引入。
- 桌面模式图标名来自 `@element-plus/icons-vue`,注册表里写字符串名;新增应用前确认图标名在包内存在(如 `headphones` 不存在,应为 `Headset`)。

## 8. 会话记录(2026-11-10,模仿找Tab 主线)

**用户目标与范围约定(务必遵守):**
- 目标不是继续按批加应用,而是**完整模仿 `https://www.zhaotab.com/`**:主题、应用商店里的各种应用、「把商店应用添加到桌面」、设置里的功能;游戏除外。
- **明确不做**:`电台随身听`、`游戏中心`、`3D魔方`、`公众号排版`;商店分类 `游戏`、`阅读` 也不做。
- 找Tab 没有、而 uTools 已有的功能/分类**一律保留**(`文本工具`/`图片工具`/`数据文件`/`局域网` 等),只是样式按找Tab 做;若某功能只有 uTools 有,按 uTools 自己的方式实现。
- 样式尽量照着找Tab 做,内页功能样式也一样;云端同步以「仅本地 + 导出/导入 JSON 备份」等价实现,**不接后端**(交接时与用户确认的两条工作假设:桌面模式设为默认首页、账户/云同步做本地等价)。

**架构变化:**
- `src/config/appCatalog.ts`:唯一目录源,合并 `tools.ts` + `desktopApps.ts`,过滤排除项,生成分类/标签/别名/拼音检索(`pinyin-pro`)/新旧与热度;`CATALOG`、`CATALOG_MAP`、`DEFAULT_DESKTOP_IDS`、`STORE_CATEGORIES`、`ALL_TAGS`、`searchCatalog()` 等都从这里出。新应用**只改两个注册表**,不要另建目录。
- `src/config/wallpapers.ts`:6 组渐变 + 5 张内联 SVG 风景壁纸(无外链 CDN),`WALLPAPER_GROUPS` 供设置页分组展示。
- `src/stores/desktop.ts`:状态 v2,单个 localStorage key `utools_desktop-state`;只存用户选择(`desktopIds`/`hiddenIds`/`dockIds`/`customSites`/偏好),`items` 由目录实时派生;带 v1 多 key 迁移、隐藏代替删除、自定义网站增删改、导入导出备份、本地存储用量。
- 内页改为**整页**(不再是 drawer):`StorePage.vue` / `AddAppPage.vue` / `SettingsPage.vue`,共用 `src/styles/desktop-pages.css`(在 `main.ts` 引入);旧的 `StoreDrawer.vue` / `SettingsDrawer.vue` 已删除。
- 面板与 URL 同步:`?p=store` / `?p=settings` / `?p=add-app`,书签小工具 `?add=<网址>&name=<标题>`;用 vue-router `query`(不新增路由记录,避免和工具路由冲突),浏览器前进/后退可切换,Esc 返回桌面。
- `AppIcon.vue` 统一渲染圆角图标:外链图标 → emoji → Element Plus 图标 → 名称首字;外链加载失败会回退,不会留空白图标。

**已完成批次:** P0 `e5648b3`(目录 + 状态 v2)、P1 `8c03f48`(桌面主题/默认首页)、P2–P4 `d95f732`(商店/添加 App/设置整页 + 深链接 + 右键菜单配色修复)。
**验证方式:** `npm run build` 通过;headless Chrome 截图四个页面;CDP 交互检查 9/9 通过(点击开商店、URL 同步、添加应用落盘、返回按钮、Dock 开设置、隐藏应用分组、Esc 返回)。

> 本节为当日会话的过程记录。**后续进度、剩余任务与踩坑清单一律以第 9 节「任务看板」为准**,不要在这里追加待办。

## 9. 任务看板(2026-11-10 14:30 更新 · 接手时先看这一节)

### 9.1 要完成的任务(总目标与验收口径)

用户原话的意图:**完整模仿 `https://www.zhaotab.com/`**,不只是换主题,而是包含
(1) 找Tab 式主题(壁纸桌面、圆角图标、顶部系统栏、中央搜索、底部 Dock、毛玻璃);
(2) 应用商店里的各种应用;
(3) 「把商店应用添加到桌面」的能力;
(4) 设置里的各项功能;
(5) 内页功能与样式也尽量照着做。游戏除外。

**用户明确的范围约定(不要擅自改动):**
- **不做**:`电台随身听`、`游戏中心`、`3D魔方`、`公众号排版`;商店分类 `游戏`、`阅读` 也不做。
- 找Tab 没有、uTools 已有的功能/分类**一律保留**(`文本工具`/`图片工具`/`数据文件`/`局域网` 等),只是样式向找Tab 靠拢。
- 若某功能只有 uTools 有、找Tab 没有,按 uTools 自己的方式实现。
- 两条已确认的工作假设:**桌面模式设为默认首页**;**账户/云同步以「仅本地 + 导出/导入 JSON」等价实现,不接后端**。

**验收口径:** `npm run type-check` 0 错误 + `npm run build` 通过 + 每个功能在浏览器里可操作 + 每次改动 commit/push(第 0 节硬性约定)。

### 9.2 已完成(全部已 push 到 `origin/main`)

| 阶段 | commit | 内容 |
| --- | --- | --- |
| 前置 | `e947574` / `2783321` | 两批共 10 个桌面应用(主线转向前按旧节奏做的,保留) |
| 前置 | `05c58fc` | 交接文档补桌面模式现状与模板踩坑 |
| P0 | `e5648b3` | `appCatalog.ts` 统一目录(85 条)、`wallpapers.ts` 壁纸预设、`desktop.ts` 状态 v2(版本迁移/隐藏/自定义站点/备份) |
| P1 | `8c03f48` | 桌面模式设为默认首页;壁纸桌面 + 系统栏 + 时钟 + 中央拼音搜索 + 圆角图标网格 + Dock + 右键菜单 + 双击隐藏;`AppIcon.vue` |
| P2–P4 | `d95f732` | 商店 / 添加 App / 设置三个**整页**(删除旧 drawer)、`desktop-pages.css`、URL 深链接、书签小工具、右键菜单配色修复、图标加载失败回退 |
| P5-1 | `d785ccc` | 5 个非游戏应用:字节换算、ASCII 码表、HTTP 状态码查询、CURL 格式化、JSON / CSV 转换 |
| P5-2 | `118e7b2` | 5 个非游戏应用:图片压缩、图片裁切、随机头像生成、印章生成器、代码美化截图 |

**当前精确状态(已实测,P5-2 后):**
- `CATALOG` = **95** 条(66 桌面应用 + 29 工具),默认桌面 34 个,商店卡片 95 张;新分类计数:图片工具 12、设计资源 11、全部 95。排除项泄漏 0。
- `npm run type-check` 0 错误,`npm run build` 通过(EXIT=0),仅有既有的 >1MB chunk 警告。
- P5-2 五个应用已逐个在浏览器实测:图片压缩(文件注入 → 完成 → JPEG 省 99%)、图片裁切(1:1 → 16:9 取景框、圆形输出)、随机头像(种子/风格/6 变体)、印章生成器(文字/五角星/手绘感重绘)、代码美化截图(着色/行号/主题/导出无报错)。
- 四个页面(桌面 / `?p=store` / `?p=settings` / `?p=add-app`)headless Chrome 截图渲染正常。
- CDP 交互检查 **9/9 通过**:点击开商店、`?p=store` 同步、商店「添加」落盘(35→36)、返回按钮关页并清 query、Dock 开设置、隐藏应用分组渲染、Esc 返回桌面。
- 本地预览服务 `npx vite preview --port 5188 --host 127.0.0.1`(dev 端口仍是 5199)。

### 9.3 未完成(按优先级)

**A. P5 剩余批次 —— 补齐找Tab 的非游戏应用,每批 5 个,逐批 build + commit + push**

| 批次 | 应用 | 状态 |
| --- | --- | --- |
| P5-2 | 图片压缩、图片裁切、随机头像生成、印章生成器、代码美化截图 | ✅ 已完成(`118e7b2`) |
| P5-3 | 浏览器环境检测、WebSocket 在线测试、HTML 编辑器、四象限笔记、防休眠 | 未开始(下一批) |
| P5-4 | IMEI 校验生成、手速测试、字帖生成器、算术题生成器、端口速查 / 检测 | 未开始 |

> 找Tab 全量 126 个应用名可从 `zhaotab-home.html` 的 `<noscript>` 链接清单提取(原临时文件在 `/tmp`,已把候选名单固化在本文档,不必依赖 `/tmp`)。以上候选均已排除游戏与阅读。

**B. 需要用户拍板才能做的(不建议自作主张)**
- 依赖重型库 / 第三方服务 / ML 的:图片去背景、Whois 查询、PDF 裁剪、在线解压文件、随机图片(外链图源)、完整 SVG 编辑器(已有「SVG 图案生成器」近似覆盖)。可降级为「外部网站快捷方式」或跳过,**做之前先问用户**。
- 找Tab 有、我们暂时没做的细节:搜索结果分组(站内 / 站外 / 最近使用 / 最匹配 / 已隐藏)、「最近打开」记录、列表 / 网格视图切换、真正的浏览器插件(目前只做了书签小工具)。
- 登录 / 云端同步:按 9.1 的约定不做后端,目前以「仅本地 + JSON 备份」等价实现;若用户改口需要真同步,再单独立项。

**C. 工程债(非主线,可延后)**
- `README.md` 仍是早期版本(只写 27 个工具,未提桌面模式 / 应用商店 / 95 个应用),对外说明前必须更新。
- 构建大 chunk 警告:vendor(2.55MB)/ vendor-markdown(1.02MB)/ vendor-ui(943KB)/ heic2any(1.35MB),属既有情况。
- `LanTransfer.vue` 的真实 WebRTC 连通性仍需在真 Chrome + 手机上验证(内置 Review 浏览器无 WebRTC 能力,自动化测不了,见第 6 节)。

### 9.4 踩过的坑(按「下次最容易再踩」排序,务必先看)

1. **必须跑 `npm run build`,不能只跑 type-check**。`vue-tsc --noEmit` 不做 Vue 模板 codegen,模板编译崩溃只在 `vite build` 暴露。批量定位:`node -e` 调 `@vue/compiler-sfc` 的 `compileTemplate()` 扫 `src/views/apps/*.vue`。
2. **`v-if` 与 `<template v-else>` 之间不能夹任何元素**(连 `<input hidden>` 也不行),否则 codegen 报 `Cannot read properties of undefined (reading 'type')` / `Codegen node is missing`。修法:把中间元素移到 `v-if` 之前;中间只留 HTML 注释是安全的。已修 `ImageToBase64.vue`、`NineGridCut.vue`。
3. **新增应用必须同时改两处 + 追加发布批次**:① `desktopApps.ts` 注册表;② `appCatalog.ts` 的 `RELEASE_BATCHES` 追加一批(key 数组),否则 `isNew`/`releasedAt` 为 0,「最新上架」里看不到新应用。`CATALOG` 由注册表派生,**不要另建目录**。
4. **`desktopApps.ts` 的 `category` 是字面量联合类型**。用 `数据文件`/`图片工具`/`文本工具`/`局域网` 等 uTools 自有分类时,要同时扩展该联合类型**和** `appCatalog.ts` 的 `APP_CATEGORY_MAP`,否则类型检查失败 / 分类落到默认 `效率工具`。
5. **`teleport to="body"` 的元素拿不到 `.desktop` 上的 CSS 变量**。右键菜单 `.ctx` 原来用 `var(--fg)` / `var(--glass-bg)` / `var(--shadow)`,实际全 undefined 导致文字不可读;必须在 `.ctx` 自己身上定义并在 `html.dark` 下覆盖。
6. **面板深链接只能用 vue-router 的 `query`,不能新增路由记录**:`App.vue` 在桌面模式下根本不渲染 `<router-view>`,且路由是 `createWebHistory`,`/store` 这类路径会「No match found」。用 `?p=store` + `computed` 的 get/set 调 `router.replace({query})`。**不要用 `window.history.replaceState` 直接改 URL**,会让 vue-router 内部状态与地址栏脱钩(书签小工具原来就踩了这个)。
7. **headless Chrome 截图会挂死**:给 `--user-data-dir=<新目录>` + `--no-proxy-server` 组合会让进程卡住 18 分钟以上。可复用的可靠写法是不带这两个参数、`http://localhost:<port>/`、`--virtual-time-budget=6000`,并用 Python `subprocess.run(..., timeout=75)` 兜底。**macOS 没有 `timeout` 命令**,别写 `timeout 90 chrome ...`。
8. **运行时校验目录时 esbuild 会因 `.vue` 动态 import 报 `No loader is configured for ".vue" files`**。解法:加一个 esbuild 插件把 `.vue` 解析到 stub 命名空间返回 `export default {}`;或干脆用正则从两个注册表源文件里抽 `name:` 做粗校验。Pinia store 的运行时测试则要把 `pinia`/`vue`/`vue-demi` 标 `external`,否则两实例冲突报 `getActivePinia()`。
9. **`AppIcon.vue` 外链 favicon 会失效**:只把 `<img>` 隐藏会留空白图标。现在用 `imgFailed` + `watch(iconUrl)` 回退到 emoji → Element Plus 图标 → 名称首字。`AddAppPage.vue` 还会用 `new Image()` 预检 URL,加载不成功就不写入配置。
10. **CURL 格式化的两个序列化坑**:生成多行 curl 时 JSON body 必须压成单行,否则单引号内换行会破坏命令;生成 `fetch()` 时 JSON body 用 `JSON.stringify(对象字面量)`,普通文本 body 直接用字符串字面量,不能二次 `JSON.stringify` 加引号。
11. **`el-select allow-create` 的自定义值要能被归一化**:字节换算里用户可能输入 `MB` / `MiB` / `M`,`normUnit()` 必须先剥 `iB` 再匹配 `[KMGTP]`,否则显示对了但换算结果是 NaN。
12. **图标名要验**:`@element-plus/icons-vue` 里写字符串名,新增应用前用 `node -e "...'Headset' in require('@element-plus/icons-vue')"` 确认(`headphones` 不存在,应为 `Headset`)。
13. **Git 推 GitHub 连不上**(443 超时 / `HTTP2 framing layer`):`git -c http.proxy=http://127.0.0.1:7897 push origin main`,不要写死进 git config。
14. **每次改完立即 commit + push**(第 0 节),不要等用户提醒;提交信息用中文一句话 `feat: …` / `fix: …` / `docs: …`。
15. **Vue 3 响应式坑:push 进 `ref([])` 的对象,之后必须经响应式数组的代理访问和改**。先 `const it = {...}; items.value.push(it); compress(it)` 后,`it` 是 raw 对象,对它的赋值(即使压缩已完成)不会触发界面更新——表现为 UI 永远停在「压缩中」。修法:push 后取回响应式代理再操作(`const target = items.value.find(x => x.id === it.id)`),或在 `addItem` 里直接 `compress(items.value[items.value.length - 1])`。已修 `ImageCompress.vue`。同理,computed 里读取模块级 `let` 变量(如 `ImageCrop.vue` 的 `imgMeta`)不建立依赖,必须改用 `ref`。
16. **`<input hidden>` 等元素夹在 `v-if` / `v-else` 之间就是坑 #2 的现场**:P5-2 的 `ImageCrop.vue` 又踩了一次,写模板时先放隐藏 input,再写 `v-if` 块。

### 9.5 接手后的推荐动作

1. `npm run type-check` && `npm run build`,确认基线干净;`git status -sb` 应为空、`HEAD` = `origin/main`。
2. 从 9.3 的 P5-2 开始,每批 5 个:写 `src/views/apps/*.vue` → 改两个注册表 → `npm run build` → commit → push。
3. 每批结束把 9.2 的表格、CATALOG 数量和 9.3 的勾选状态同步更新到本文档,并一起提交。
4. 遇到 B 类「需要拍板」的项,先问用户再动手。
