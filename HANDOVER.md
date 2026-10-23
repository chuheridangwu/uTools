# HANDOVER 交接文档

项目最后状态(交接时点):`npm run type-check` 0 错误,`npm run build` 通过,dev server(http://localhost:5199)可正常起服并返回首页 200。

## 1. 完成清单

- 基础设施:package.json、vite.config.ts、tsconfig.json、index.html、src/env.d.ts、public/favicon.svg。
- 核心:`src/types/tool.ts`、`src/config/tools.ts`(29 工具注册表)、`src/router/index.ts`(import.meta.glob 动态映射)、`src/stores/app.ts`、`src/styles/index.css`、`src/main.ts`、`src/App.vue`。
- 组件:Sidebar、CommandPalette(⌘/Ctrl+K)、ToolCard、ToolPage、JsonTreeNode。
- utils:`common.ts`(copyText/downloadBlob/downloadText/formatSize=**formatBytes 别名**/baseName/pad2/toNumber/storage)、`image.ts`(loadImage/calcTargetSize/drawImageTo/canvasToBlob/renameWithExt)。
- 视图:29 个工具 + Home 全部完成并通过类型检查。

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

## 5. 待办 / 注意事项

- **GitHub 推送未执行**:`gh` CLI 在本机不可用,需用户提供远程仓库地址后 `git remote add origin ... && git push -u origin main`(或确认走 HTTPS 凭据)。
- 构建警告:vendor-ui(942 KB)与 vendor(1.9 MB,含 jimp)超过 1 MB 提示;如需优化可对 jimp 相关视图按需动态 import 或降级。
- 快捷键:⌘/Ctrl + K 命令面板;dark 模式、收藏、最近使用持久化(localStorage 前缀 `utools_`)。
- 翻译:MyMemory 不支持 auto 语种,当前用 CJK 占比启发式检测;单次请求 ≤500 字符。
- EyeDropper(屏幕取色)仅 Chromium 系浏览器支持,ColorTool 已做能力判断。
- dev 端口固定 5199(`server.host: true`)。
