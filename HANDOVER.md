# HANDOVER 交接文档

项目最后状态(交接时点):`npm run type-check` 0 错误,`npm run build` 通过,dev server(http://localhost:5199)可正常起服并返回首页 200。远程仓库已配置:https://github.com/chuheridangwu/uTools.git(分支 `main`)。

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
- 视频播放器:新增播放列表显示/隐藏按钮(见完成清单对应条目),`vue-tsc` 0 错误后已提交推送(commit `05949e8`)。
- 配置远程仓库 `origin`(GitHub HTTPS),推送链路已验证可用。
- 起草并否决了 fswatch + launchd 自动提交方案:`brew install fswatch` 执行中途被用户打断,**未安装成功、未写入任何 LaunchAgent**;如后续发现 `~/Library/LaunchAgents/` 有残留 plist 应删除。

**踩过的坑:**
- 无新坑。注意工具使用细节:编辑之前未在本次会话读过的文件时,`find/replace` 必须基于精确原文,或直接 `read` 后再改,否则会匹配失败。
- **git 推 GitHub 连不上(端口 443 超时 / HTTP2 framing layer 错误)**:本机走系统代理(Clash 系,`127.0.0.1:7897`),但 git CLI 不读 macOS 系统代理设置。解决:`git -c http.proxy=http://127.0.0.1:7897 push origin main`。以后凡 push 失败先试这个;不要把 proxy 写死进 git config(代理软件没开会反而断链)。

**用户决策(尚未做):**
- 用户决定**不**部署任何自动提交的永久机制,改为「AI 每次修改后手动 commit+push」,约定见第 0 节。
