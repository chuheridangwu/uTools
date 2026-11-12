# HANDOVER 交接文档 · uTools 在线工具箱

> 最后更新:**2026-11-12** · 代码基线 `04c14e7` · 工作区干净 · `type-check` 0 错误 · `build` 通过。
> **接手请先读第 0 节与第 5 节**,历史细节按需查第 8 节。

---

## 0. 30 秒速览

- **这是什么**:Vue 3 + TypeScript + Vite + Element Plus,「找Tab(https://www.zhaotab.com/)」风格的桌面化在线工具箱。
- **两个形态**:有路由的「工具」(`config/tools.ts`,28 个,走 `<router-view>`)与无路由的「桌面应用」(`config/desktopApps.ts`,81 条注册、**2 条排除** → 79 个,以浮层 `AppWindow` 打开)。
- **统一目录**:`config/appCatalog.ts` 把两者合并成 `CATALOG`(**107 条**),商店、桌面、搜索、命令面板全部只认这一份。
- **默认首页是桌面模式**:壁纸 + 系统栏 + 时钟 + 中央拼音搜索 + 圆角图标网格 + Dock + 右键菜单。商店 / 设置 / 添加 App 是**整页**,靠 `?p=store|settings|add-app` 深链接切换。
- **没有后端**:所有数据在 localStorage,「云同步」等价实现为导出 / 导入 JSON。
- **不做**:游戏中心、3D 魔方、电台随身听、公众号排版;商店分类「游戏」「阅读」也不做(见 `EXCLUDED_KEYS`)。

---

## 1. 硬性约定(每次改动都必须做,不要等用户提醒)

1. `npm run type-check` → **0 错误**;
2. `npm run build` → **必须跑**,`vue-tsc` 不做模板 codegen,模板编译崩溃只在 build 阶段暴露;
3. `git add` → `git commit -m "<中文一句话>"`(`feat: …` / `fix: …` / `docs: …`)→ `git push origin main`;
4. **汇报 commit hash**(用户明确要求每次显式给出)。

其他长期约定:
- **不要**装 fswatch / watchexec / launchd 之类的自动提交机制(用户 2026-10-29 明确拒绝)。
- **不要**自作主张接重型库、第三方服务或 ML 模型;这类项先问用户(第 6 节 B 类)。
- 「手机在线收听有声书」需求**已放弃**,不要重提。

推送相关(本机网络常抖动):
```bash
# 优先直推;超时/HTTP2 报错时重试,必要时显式 HTTP/1.1
for i in 1 2 3 4 5 6; do
  git -c http.version=HTTP/1.1 push origin main && break
  sleep 8
done
git rev-parse HEAD origin/main   # 两者相等才算推送成功
```
> 本机 Clash 代理 `127.0.0.1:7897` **经常没有监听**,此时 `git -c http.proxy=…` 会直接失败,直推 + 重试才是可用路径。**永远不要把 proxy 写进 git config**。

---

## 2. 快速开始

```bash
npm install
npm run dev        # http://localhost:5199(端口固定,server.host: true)
npm run build      # type-check + 生产构建
npm run type-check # 仅 vue-tsc --noEmit
npm run preview    # 预览产物(曾用 npx vite preview --port 5188)
```

页面入口:`/`(桌面) · `/?p=store` · `/?p=settings` · `/?p=add-app` · `/?add=<网址>&name=<标题>`(书签小工具)。

---

## 3. 当前状态(实测事实,2026-11-11)

### 3.1 数量与分类

| 指标 | 数值 |
| --- | --- |
| `CATALOG` 总数 | **107** |
| 桌面应用 / 路由工具 | 79 / 28(注册表 81 条,排除电台随身听、公众号排版) |
| 默认桌面图标 | 34 个(其余在商店「添加」) |
| 商店卡片 | 107 张 |

分类计数(浏览器实测,与 README 一致):
`全部 107 · 效率工具 21 · 开发工具 28 · 设计资源 13 · 生活实用 24 · 文本工具 3 · 图片工具 11 · 数据文件 5 · 局域网 1`
排除项泄漏 **0**。

### 3.2 构建 / 校验

- `npm run type-check` → 0 错误。
- `npm run build` → 通过(EXIT=0)。

**分包现状(2026-11-11 Element Plus 按需引入后,commit `8984563`)**:

| chunk | 大小 | 是否首屏加载 |
| --- | --- | --- |
| `index`(业务代码 + 按需 UI) | 486KB | ✅ |
| `vendor-core`(vue/router/pinia/pinyin-pro) | 419KB | ✅ |
| `_commonjsHelpers` | 755B | ✅ |
| `index.css`(按需样式 + base) | 95KB | ✅ |
| `vendor-markdown`(marked / highlight.js) | 1.03MB | 懒加载 |
| `heic2any` | 1.35MB | 懒加载 |
| `ImageToPdf`(含 jsPDF) | 392KB | 懒加载 |
| `CronParser`(cron-parser + cronstrue) | 307KB | 懒加载 |
| `mqtt` | 338KB | 懒加载 |

> 首屏 JS 由旧策略的 **3.4MB → 1.5MB → 0.9MB**(`index.html` 只 preload `index` / `vendor-core` / `_commonjsHelpers` + 1 个 CSS)。旧 `manualChunks` 把所有 node_modules 塞进单个 `vendor`,导致 jspdf / mqtt / papaparse 这些只被懒加载视图使用的库也被首屏预加载。**新增第三方库时不要再回到「统一 vendor」写法**。
>
> Element Plus 已改为按需引入(`unplugin-vue-components` + `unplugin-element-plus`),不再有 `vendor-ui`;`manualChunks` 必须保留 `onlyExplicitManualChunks: true`,否则入口会静态引用手动 chunk 里的 CJS helper,把 1MB 的 `vendor-markdown` 拖进首屏(踩过一次)。

### 3.3 最近一次交付

**工作区类应用全屏窗口打开**(`appCatalog.ts` 的 `FULLSCREEN_APPS` + `AppWindow.vue` 全屏形态,共 12 个应用),首页与其他应用浮层不变,详见第 8 节 2026-11-12 条目。

**商店打开应用后「返回」回到商店,对齐找Tab 行为**(见第 8 节 2026-11-12 条目):`StorePage.openNow` 不再关闭商店、`panel` 改 `push` 留历史栈、Esc 先关应用窗口。

**JSON 查看器对齐 json.cn/jsononline**(`04c14e7`,`src/views/JsonViewer.vue` 重写,删除不再使用的 `src/components/JsonTreeNode.vue`),零新增依赖。
- **布局**:左侧输入框(带行号、等宽对齐)+ 中间可拖动分隔条(22%–78%)+ 右侧格式化结果(带行号),整体高度 `clamp(420px, 66vh, 760px)`,与参考站比例一致(默认 41.67% / 58.33%)。
- **结果区左上角工具条**(用户明确要求的「多个功能」):压缩 / 转XML / 显示行号 / 清空 / 保存 / 复制 / 折叠 / 示例 / 保留转义(勾选框)/ 全屏,按钮图标用 Element Plus 图标,`title` 悬停提示,激活态换色。
- **语法着色**(逐值核对参考站计算样式):键 `#92278f`、字符串 `#3ab54a`、数字 `#25aae2`、布尔 `#f98280`、null `#f1592a`、链接 `#61d2d6`,统一 `font-weight:700`、14px / 行高 22px。
- **折叠**:对象/数组前有方框图标(展开红色减号、折叠蓝色加号),折叠后显示 `Object{...}` / `Array[n]`;「折叠」按钮可一键折叠/展开全部。
- **键值可编辑**:键与值都是 `contenteditable`,编辑后 350ms 防抖把 DOM 文本还原成 JSON 回写到左侧输入框(与参考站行为一致)。
- **链接与图片预览**(用户明确要求):字符串里的 `http(s)` 自动变链接;图片扩展名(`png/jpg/jpeg/gif/webp/svg/bmp/avif/ico`)或 `data:image/` 的地址点击弹出 260px 小图卡片(内含「打开原图」),点空白处或 Esc 关闭。
- **其它功能**:压缩(单行紧凑,可切回)、转 XML(`<?xml version…?>` + `<root>` + 2 空格缩进,数组用 `<item>`)、保存(下载 `format.<时间戳>.json`)、复制(先展开全部再复制)、示例、全屏(`position:fixed` 覆盖视口,Esc 退出)、保留转义(默认开,等价于把 `\u003e` / `\n` 保持字面量)、XML 输入自动转 JSON、错误信息红字显示、超大整数(≥16 位)用占位符保护不丢精度。
- **实测**(dev server + 真实 DOM 操作):
  - 着色:`getComputedStyle` 六类 token 颜色与参考站完全一致;
  - 大整数:示例里 `305667554401374209 / 103248655202358790 / 123456789012345679` 原样显示(未变成 `…200`);
  - 折叠:单节点折叠后 `Object{...}` 可见、body `display:none`;一键折叠 5/5、再点展开 0/5;
  - 行号:输入 13 行、输出 31 行,两侧行高均 22px,首行偏移 10px 对齐,滚动时 `translateY(-scrollTop)` 同步;
  - 压缩 → 1 行;转 XML → 正确头与根节点;保存的文件用 Python `json.loads` 校验通过(4 空格缩进、无首尾空行);复制提示成功;
  - 图片预览:点击图片链接弹出 260×221 卡片,图片 `naturalWidth=400` 正常加载,点击别处自动关闭;
  - 编辑同步:改一个字符串值后左侧文本变成 `{\n    "a": 1,\n    ...`,无多余空行;
  - 错误:`{ "a": 1, }` → 红字 `SyntaxError: Expected double-quoted property name…`,修正后立即恢复;
  - 深色模式:`html.dark` 下容器 `#171c23`、行号槽 `#1f252d`;全屏 `position:fixed` 覆盖 1537×1227,Esc 退出;
  - `type-check` 0 错误、`build` 通过(`JsonViewer` 14.02KB / gzip 5.50KB,CSS 6.36KB)。
- **踩坑**:结果区是 `innerHTML` 动态生成的,拿不到 Vue scoped 的 `data-v` 属性 → 所有 token 样式必须写成 `.jv-target :deep(.jv-key)` 之类,否则颜色完全不生效(首轮实测颜色全是继承色)。

上一次:`9c1d309`:**长图拼接完整实现「布局拼图」功能**(135 布局 / 比例 / 边框 / 水印 / 导出)。
- **左栏**:135 个布局模板(按图片数 2–16 分组,缩略图用 CSS Grid span 还原格子形状),外加「竖向长图 / 横向长图」两种特殊布局(保留原有长图拼接能力,长图模式下加图会自动增行)。
- **中栏**:工具栏(文字 / 箭头 / 方框 / 圆圈 / 随机 / 清除)+ 画布。单元格支持点击上传、拖入整块区域、拖动平移(按溢出量归一化)、方向键微调(Shift 加速)、Delete 清空、双击复位;叠加元素可拖动、可删除、文字可直接编辑。
- **右栏**:画布比例 14 个预设(1:1、16:9、9:16、16:10、4:3、3:4、2:3 6寸、3:2 6寸横、5:7 7寸、7:5 7寸横、4:5 8寸、5:4 8寸横、210:297 A4、297:210 A4横)+ 自定义比例;边框(上右下左分别设)、间距、圆角、背景色、背景图;水印(文字 / 字号 / 透明度 / 旋转 / 稀疏-中等-密集 / 平铺或 5 个单点位置);导出质量(高清 JPG / 标准 JPG / 无损 PNG)、复制到剪贴板、下载。
- **几何一致性**:预览与导出共用同一套「设计坐标」函数(`DESIGN_BASE = 460`,与参考站同基准),`computeRects` 复刻 CSS Grid「行优先 + 稀疏」自动排布(模板全是 span-only),`coverRect` 做 cover 裁剪 + 平移,`roundRectPath` 做圆角,`drawWatermark` 画黑色半透明文字(alpha = 透明度)。预览用绝对定位单元格而非 CSS Grid,避免与导出算法分歧。
- **导出尺寸**:长边固定 2400(标准 JPG 1600),按比例算另一边 —— 与参考站实测一致(1:1 导出 2400×2400)。
- **实测**(dev server + 真实 DOM 操作):
  - 135 个布局**逐一点击**校验:单元格数量 = 标题数字、两两无重叠、无越界,**135/135 通过**;
  - 布局/比例/样式:16:9 → 512×288、边框 20/25/30/35 + 间距 30 + 圆角 24 的格子位置与 `borderRadius` 正确、自定义 3:1 → 512×171;
  - 交互:拖入 2 张图后按 cover 铺满(239×239 显示、超出居中裁切)、拖动 40px → 图片偏移 40px、方向键 3px、双击复位、随机不报错、切布局按索引保留图片、背景图生效、重置设置恢复默认;
  - 导出像素(用 `sips` 转 PNG + 纯 Python zlib 解码校验):4 格 1:1 → **2400×2400**、边框纯白、两格渐变色与间隙位置正确;16 格 16:9 → **2400×1350**,16 个色块中心像素全部匹配、边框与横纵间隙纯白;PNG 提示 `尺寸 2400 × 1350 px`、标准 JPG `1600 × 900 px`;叠加文字进导出(99.6% 白底 + 0.33% 红字)。
  - `type-check` 0 错误、`build` 通过(`ImageStitch` 32.34KB / gzip 11.21KB,CSS 9.94KB)。
- **说明**:参考站的水印是**黑色**文字(透明度即 alpha),本实现一致;工具栏「随机」实现为**打乱已填图片的槽位**(不是随机换布局)。

上一次:`36d2112`:**长图拼接改为「好拼」风格三栏布局**(仅界面,功能与旧版一致)。
- 界面参考 `img.ops-coffee.com/photo/`(好拼):左栏「拼图设置」(拼接方向 / 选择图片)+「图片顺序」列表,中栏画布工具条 + 预览区,右栏「样式调整」(间距 / 限宽 / 对齐 / 背景色)与「导出设置」(下载长图)。
- 设计令牌照抄好拼:主色 `#0052cc`、激活底色 `#e9f2ff`、画布底 `#f4f5f7`、面板 `#fff`、边框 `#dfe1e6`、文字 `#172b4d` / `#42526e` / `#6b7f99`、工具条 `#f8f9fa` + `#dee2e6` 圆角 12;深色模式用 `html.dark .st-app` 映射另一套变量。
- 功能项一个没少:竖向 / 横向、间距 0–100、竖向限宽 240–3000、横向对齐、背景色、多选上传、**拖拽导入**、上移 / 下移 / 单张移除 / 清空、实时预览(显示 `宽 × 高 px`)、导出 PNG。
- 顺手修掉两个旧问题:① 缩略图原来复用 `it.img.src`,而 `loadImage()` 在 `onload` 里已 `revokeObjectURL`,新建 `<img>` 加载会失败 → 改为每张单独 `URL.createObjectURL(f)` 并在移除 / 清空 / 卸载时释放;② 旧 `watch([items.value, …])` 拿的是数组快照,`items.value = []` 之后失去响应 → 改为显式 `render()` + 只对设置项 `watch`。
- 加载改为**串行** `await`,保证拼接顺序 = 用户选择顺序(旧实现 `forEach(async …)` 会按解码完成先后乱序)。
- 实测(dev server + 真实 DOM 操作,3 张 300×200 / 200×300 / 400×150 的图):竖向默认 400×1037、横向 745×150、间距改 30 → 785×150、背景改黑后间隙像素 `#000000`、上移后首像素由红变绿且顺序变 B/A/C、移除第 3 张 → 463×200、清空后画布隐藏 + 占位出现 + 下载禁用;`type-check` 0 错误、`build` 通过(`ImageStitch` 7.86KB / gzip 3.29KB)。
- 踩坑:scoped 样式里写 `:global(html.dark) .st-app` 会被编译成裸 `html.dark{…}`,把 `.st-app` 丢掉、等于给 `<html>` 设背景和边框 → 必须写成 `html.dark .st-app`(与 `DesktopHome.vue` 的 `html.dark .ctx` 一致)。

上一次:`b44ba7d`:**默认桌面清单按用户指定调整 + 二维码生成/解析合并**。
- 默认桌面(`config/appCatalog.ts` 的 `DEFAULT_DESKTOP_IDS`)改为用户指定的 15 项与顺序:本地媒体浏览器、局域网文件直传、JSON 查看器、颜色工具、便签墙、二维码生成、时间戳转换、翻译工具、IP 归属地查询、待办清单、URL 参数解析、编码解码、配色方案、JSON 生成器、本地漫画阅读器(均以 `CATALOG_MAP.has()` 过滤,键名逐个核对存在且唯一)。
  - 注意:只影响首次打开/重置布局;已有本地状态(`utools_desktop-state`)不会被覆盖,老用户可在「设置 → 重置布局」拿到新默认。
- **二维码生成 + 解析合并为一个应用**(`src/views/QrcodeTool.vue`,路由 `/qrcode-tool`,名称仍为「二维码生成」,内含「生成二维码 / 解析二维码」两个 tab):
  - 删除独立应用 `qr-decode`(`tools.ts` 条目 + `src/views/QrDecode.vue`),目录总数 108 → **107**(79 桌面 + **28** 路由),图片工具 12 → 11;
  - 生成参数对齐草料 `cli.im/text/other`:内容类型模板(文本/网址/电话/短信/邮件/WiFi)、码制(仅 QR,界面上标注汉信码/PDF417/Data Matrix 不支持)、容错率(L 7% / M 15% / Q 25% / H 30%)、尺寸(300/400/600/自定义 128–1024)、码边距(0–10 个色块,直接作为 `qrcode` 的 `margin`)、前景/背景色、中心图片与大小(有图自动 H 级);
  - 下载新增 **SVG**(矢量,不含中心图片,会提示),PNG 仍按当前设置重新生成后导出;
  - 解析沿用 jsQR + 3 级放大重试,新增「打开链接」(仅 http/https 时可用);
  - 依赖未新增:仍只用 `qrcode` 与 `jsqr`(原本就有的懒加载依赖)。
- 校验:`type-check` 0 错误、`build` 通过(`QrcodeTool` 159.64KB / gzip 58.02KB,含 jsqr+qrcode);dev server 下 `/qrcode-tool` 返回 200、模板与 `appCatalog` 模块均正常编译,默认清单顺序已从编译产物核对。
- 说明:用户提供的参数截图本机无法读取(模型不支持图片输入),参数以 `cli.im/text/other` 页面上可见的项为准;若截图还有额外参数需要补,告知即可。

上一次:`fd313bd`:**修复 CI 构建失败(vue-tsc 模板类型误判)**。详见第 8 节。
- 现象:GitHub 推送后 Cloudflare Pages 构建失败,`vue-tsc --noEmit` 在 `src/views/apps/TotpAuth.vue` 第 242/247/250/253/256/263/266/274 行报 `TS2339: Property 'value' does not exist on type '{ visible, label, issuer, secret, digits, period, algo, uri }'`;本地同样命令却 0 错误。
- 定位过程:
  - 先确认不是我们的代码逻辑问题:本地/干净克隆 `1d0e68c` 均通过;远程 main 已被新提交 `1725481 重置package-lock.json` 覆盖(由另一侧推送),该提交把 `element-plus` 从 2.14.7 提到 **2.14.8**、`vue` 3.5.44→3.5.45、`vue-tsc`/`@vue/language-core` 3.3.13→3.3.14。
  - 在 `/tmp` 干净克隆 `1725481` + `npm ci` 后**稳定复现**全部 8 个错误;把 `vue-tsc` 退回 3.3.13 仍报错,排除 vue-tsc 版本。
  - 用最小用例二分:`el-dialog` + `el-form-item` + `<el-input placeholder="otpauth://totp/...?secret=...">` 三者组合才触发;把 placeholder 换成不含 `://` 的字符串即消失。结论:**vue-tsc 3.3.14 处理模板里含 `://` 的静态属性值时,会把它当类型解析,连带把同一节点的 `v-model` 目标误判为 ref**,报 `Property 'value' does not exist`。这是上游类型解析缺陷,不是业务 bug。
- 修复(commit `fd313bd`):`TotpAuth.vue` 把该 placeholder 提为常量 `URI_PLACEHOLDER` 并用 `:placeholder="URI_PLACEHOLDER"` 绑定,保留原提示文案;附注释说明原因,防止以后改回内联写法。
- 验证:本地 `type-check` 0 错误、`build` 通过;干净克隆 `fd313bd` + `npm ci` 后 `npm run build` 通过(等价 CI 环境)。
- 遗留风险:仓库里还有 6 处 `placeholder` 含 `://`(`AddAppPage.vue` ×2、`QrcodeTool.vue`、`ApiTester.vue`、`UrlParser.vue`、`WebSocketTest.vue`),当前不触发报错,但若以后被包进 `el-dialog` / `el-form-item` 或上游类型再收紧,可能复现同样问题。

上一次:`eabe8ca`:**局域网直传手动配对码改为 6 位数字房间**。详见下方。
- 移除整条「复制粘贴 SDP 配对码」链路(`packCode` / `unpackCode`、配对码二维码、邀请码 / 应答码输入框与对应 CSS)。
- 新流程:任一方点「随机生成并加入」得到 6 位数字(100000–999999,`crypto.getRandomValues`),另一方输入同一数字点「加入房间」;双方在公共 MQTT 主题 `utools/lanx/room/v1/<6 位码>` 内交换 `join` / `offer` / `answer` / `ice`,文件仍走 WebRTC DataChannel。
- 角色自动判定:比较双方 `myId` 字典序,小的一方发 `offer`,避免 glare;**不需要区分谁是发起方**。
- 可靠性:房间内每 2.5 秒重发 `join`,未收到 answer 时重发 offer、未连上时重发 answer;发 SDP 前 `waitIceGather(p, 2500)` 让 SDP 自带候选;`roomOffering` / `roomAnswering` 防止并发重复协商。
- 生命周期:`startNegotiateWatchdog` 超时与 `iceConnectionState=failed` 都会 `resetPairing()`(退订房间、停定时器、关 PC)并展示原因;`disconnect()` 统一 `leaveRoom()`;MQTT 重连时自动补订阅当前房间;大厅邀请在配对模式下自动 reject,避免弹窗打断。
- **能力变化**:该模式依赖公共 MQTT(与在线大厅同一条通道),不再具备「信令不可达时离线兜底」的能力;页面文案与 `config/tools.ts` 描述已同步改写。
- 已知限制:6 位码只有约 100 万组合,且房间主题在公共 broker 上可被猜测/碰撞;房间只容纳一对设备,第三个加入者会被忽略。不要在配对码模式下给陌生人传敏感文件。
- 实测:Node 脚本验证房间主题双向收发正常(`broker.emqx.io` 会回显自身消息,页面用 `from === myId` 过滤);`type-check` 0 错误、`build` 通过(`LanTransfer` 24.59KB / gzip 9.11KB)。真实 P2P 连通性仍需真机验证。

上一次:`7a0619e`:**局域网直传「接受后无反馈」定位与修复**(信令正常、ICE 候选为 0)。详见第 8 节。
- 商店:最近打开横条、搜索分组(最近打开 / 最匹配 / 相关结果)+ 结果统计、网格↔列表(`storeView` 持久化)。
- 桌面:搜索框聚焦且为空 → 「最近打开」分组;输入关键词 → 「搜索结果」分组;点命中即打开并 `pushRecent`(去重前移,上限 12)。
- 实测:商店切换视图后刷新仍为列表;最近打开 2 条;搜「图片」→ 最匹配 12 + 相关 14 = 「26 个结果 · 2 组」;桌面聚焦 → 「最近打开 2」,输入「端口」→ 「搜索结果 1」,打开窗口后 `recentIds` 顺序正确维护。

---

## 4. 架构与文件地图

```
src/
  main.ts / App.vue              # 入口;桌面模式下 App.vue 不渲染 <router-view>
  config/
    tools.ts                     # 28 个「有路由的工具」注册表
    desktopApps.ts               # 81 条「浮层应用」注册表(2 条被排除)
    appCatalog.ts                # ★ 唯一目录源:CATALOG / CATALOG_MAP / STORE_CATEGORIES /
                                 #   DEFAULT_DESKTOP_IDS / RELEASE_BATCHES / searchCatalog
    wallpapers.ts                # 6 组渐变 + 5 张内联 SVG 壁纸(无外链)
  stores/
    app.ts                       # 深色模式 + 工具收藏(localStorage 前缀 utools_)
    desktop.ts                   # ★ 桌面状态 v2:单键 utools_desktop-state
  components/desktop/
    DesktopHome.vue              # 桌面:壁纸/系统栏/时钟/搜索/图标网格/Dock/右键菜单
    StorePage.vue                # 应用商店整页(分类 + 搜索分组 + 最近 + 视图切换)
    SettingsPage.vue             # 设置整页(外观/隐藏应用/布局/备份)
    AddAppPage.vue               # 手动添加网站
    AppWindow.vue                # 浮层窗口(teleport to body)
    AppIcon.vue                  # 统一图标:favicon → emoji → EP 图标 → 首字
  router/index.ts                # import.meta.glob 动态路由 + ?p= query 深链接
  styles/desktop-pages.css       # 整页共用样式(--zt-* 变量,亮/暗两套)
  views/apps/*.vue               # 桌面应用视图
  views/*.vue                    # 28 个路由工具视图 + Home
```

关键设计(改动前必读):
- **目录是静态的,状态只存「用户选了哪些 key」**。所以新增应用后,老用户刷新就能在商店看到,不会出现一次性快照永不过期的问题。
- **目录三态**:已添加 `desktopIds` / 已隐藏 `hiddenIds`(可恢复)/ 未添加(仅商店可见)。
- **`items` 由目录实时派生**,不要在 store 里缓存应用元数据。
- 深链接只用 vue-router 的 `query`,**不新增路由记录**(桌面模式下没有 `<router-view>`,路径式路由会 No match)。

### 4.1 新增一个应用的 SOP(照做即可)

1. 写 `src/views/apps/YourApp.vue`(纯前端优先,不引新依赖);
2. `config/desktopApps.ts` 注册表追加条目(`key/name/short/desc/icon/accent/category/comp`);
3. `config/appCatalog.ts` 的 `RELEASE_BATCHES` **追加一批 key 数组**——漏了这步 `isNew`/`releasedAt` 为 0,「最新上架」看不到;
4. 若用新分类,同时扩展 `desktopApps.ts` 的 `category` 联合类型**和** `appCatalog.ts` 的 `APP_CATEGORY_MAP`;
5. `npm run type-check` → `npm run build` → 浏览器实测(打开商店 → 找到卡片 → 打开 → 真实操作一遍);
6. commit + push,并同步本文件第 3 节的数量与第 8 节时间线。

---

## 5. 已完成功能清单

**桌面(默认首页)**:壁纸(渐变 / 内联 SVG)、顶部系统栏、时钟、中央搜索(拼音,`pinyin-pro`)、圆角图标网格、分页、底部 Dock(4 个系统入口 + 用户固定应用)、右键菜单、双击空白隐藏图标、图标尺寸 / 风格 / 玻璃质感 / 显示标签等偏好、聚焦显示「最近打开」。

**应用商店(整页)**:107 个应用、8 个分类计数、最新上架 / 最受欢迎 / 全部应用、拼音与别名搜索、搜索分组与结果统计、最近打开横条、网格 / 列表切换(持久化)、「添加 / 已添加」与「打开」、手动添加任意网站。

**设置(整页)**:外观与壁纸、隐藏应用管理(可恢复)、桌面布局与交互偏好、自定义站点、本地数据用量、导出 / 导入 JSON 备份。

**窗口**:应用以浮层窗口打开,可拖动、可关闭,加载态占位;路由工具与桌面应用共用 `AppIcon`。工作区 / 画布 / 阅读类应用(见 `appCatalog.ts` 的 `FULLSCREEN_APPS`,共 12 个:漫画阅读器、本地媒体、JSON 生成器/查看器、长图拼接、Markdown 编辑器、文本对比、CSV 查看器、SVG 编辑器、HTML 编辑器、画板、四象限笔记)以**全屏窗口**打开(铺满视口、直角、放开 ToolPage 1200px 限宽),其余应用保持 1100px 圆角浮层。

**107 个应用**:覆盖效率 / 开发 / 设计 / 生活 / 文本 / 图片 / 数据文件 / 局域网八类。每个 P5 批次应用都做过浏览器实测(文件注入、WebSocket 回显、canvas 渲染与导出、持久化、算法正确性等),详见第 8 节。

> **长图拼接(`/image-stitch`)已升级为完整「布局拼图」**:135 个布局模板 + 14 种画布比例 + 边框/间距/圆角/背景/水印 + 高清 JPG/PNG 导出 + 剪贴板,同时保留竖向/横向长图模式。详见 3.3。
>
> **JSON 查看器(`/json-viewer`)已对齐 json.cn/jsononline**:双栏 + 行号 + 可拖动分隔条,结果区工具条(压缩/转XML/行号/清空/保存/复制/折叠/示例/保留转义/全屏)、语法着色、折叠、键值直接编辑、网址自动变链接、**图片地址点击看小图**。详见 3.3。

---

## 6. 未完成项

### A. 以前的主线:按找Tab 补齐应用 —— ✅ 已结束
P5-1~P5-4 共 20 个应用全部完成。找Tab 非游戏应用已基本覆盖。

### B. 曾待拍板的应用 —— ❌ 用户已明确「都不需要做」(2026-11-12)
> **不要再提议、不要开工。** 保留清单只为解释历史讨论,不代表待办。

| 项 | 当初的评估 |
| --- | --- |
| 图片去背景 | 需 ML 模型或第三方 API,体积 / 隐私成本高 |
| PDF 裁剪 | 可引入 `pdf-lib` 纯前端做,约 +150KB |
| 随机图片 | 需外链图源,稳定性不可控 |
| 浏览器插件 | 目前只有书签小工具(`?add=`) |
| 真云同步 | 与「数据只存本机」的约定冲突 |

已完成(勿重复开发):`whois-lookup`(RDAP 直连)、`unzip-tool`(原生 DecompressionStream,零依赖)、`svg-editor`(零依赖矢量编辑),见第 8 节。

### C. 工程债(可延后)
- ~~大 chunk 警告~~ ✅ 已优化(2026-11-11,`663740f`):改为按需分包,首屏 JS 3.4MB → 1.5MB;`vendor-markdown` / `heic2any` / `ImageToPdf` / `CronParser` / `mqtt` 等只在用到时加载。
- ~~Element Plus 全量引入~~ ✅ 已完成(2026-11-11,`8984563`):按需引入 + `onlyExplicitManualChunks`,首屏 1.5MB → 0.9MB,`vendor-ui` 消失,详见第 8 节。
- 仍 >1MB 的只剩 `vendor-markdown`(marked / highlight.js)与 `heic2any`,都只在打开对应应用时加载,暂不处理。
- `package.json` 里的 `jimp` **已无任何源码引用**(`grep -rn jimp src` 为空),属历史残留;移除前确认没有动态引用即可(本次未动,避免无谓 lockfile 变更)。
- `LanTransfer.vue` 的**真实 WebRTC 连通性仍未人工验证**:内置 Review 浏览器没有可用 WebRTC(`localDescription` 无 candidate,ICE 恒 `new`),自动化只测过 UI / 信令流程。**需在真 Chrome + 手机验证,不要误判为代码 bug**。2026-11-12 起「手动配对」已改为 6 位数字房间,其信令同样只做过 MQTT 层面的收发验证。

---

## 7. 踩坑清单(按「下次最容易再踩」排序)

1. **必须跑 `npm run build`**,只跑 type-check 会漏掉模板 codegen 崩溃。批量定位:`node -e` 调 `@vue/compiler-sfc` 的 `compileTemplate()` 扫 `src/views/apps/*.vue`。
2. **`v-if` 与 `<template v-else>` 之间不能夹任何元素**(连 `<input hidden>` 也不行),否则 codegen 报 `Cannot read properties of undefined (reading 'type')` / `Codegen node is missing`。修法:把中间元素移到 `v-if` 之前;中间只留 HTML 注释是安全的。已修 `ImageToBase64`、`NineGridCut`、`ImageCrop`(这个坑已经踩过三次)。
3. **新增应用必须改两处 + 追加 `RELEASE_BATCHES`**(见 4.1)。`CATALOG` 由注册表派生,**不要另建目录**。
4. **`category` 是字面量联合类型**。用 `数据文件`/`图片工具`/`文本工具`/`局域网` 时,`desktopApps.ts` 的联合类型与 `appCatalog.ts` 的 `APP_CATEGORY_MAP` **都要加**。
5. **Vue 3 响应式**:push 进 `ref([])` 的 raw 对象后续赋值不触发更新(表现为永远「压缩中」)→ 必须取回响应式代理再改;computed 读模块级 `let` 变量不建立依赖 → 改 `ref`。已修 `ImageCompress.vue`、`ImageCrop.vue`。
6. **`teleport to="body"` 拿不到 `.desktop` 上的 CSS 变量**:右键菜单 `.ctx` 必须在自身定义 `--fg` / `--glass-bg` / `--shadow` 并在 `html.dark` 覆盖。
7. **深链接只能用 `query`**,不要 `window.history.replaceState`(会让 router 状态与地址栏脱钩),也不要新增路径式路由。面板切换(桌面↔商店/设置/添加)用 **`router.push({query})`** 留历史栈,对齐找Tab 的 /store 真实路由(浏览器返回能回到商店);书签小工具 `?add=` 收敛地址与路径深链接打开应用仍用 **`replace`**(不应产生多余历史项)。
8. **`AppIcon.vue` 外链 favicon 会失效**:用 `imgFailed` + `watch(iconUrl)` 回退到 emoji → EP 图标 → 首字;`AddAppPage` 会 `new Image()` 预检 URL。
9. **图标名要验**:注册表里写的是字符串名,新增前 `node -e "...'X' in require('@element-plus/icons-vue')"`(`headphones` 不存在 → `Headset`;没有 `Left` → 用 `ArrowLeft`)。
10. **`el-radio-group` 的 `@change` 显式标注类型**:模板内联 `(v) => …` 会让参数隐式 `any` 过不了 type-check → 抽成 `(v: string | number | boolean)` 的命名函数。
11. **`el-select allow-create` 的自定义值要归一化**(字节换算里 `MB`/`MiB`/`M` 都得认),否则显示对、算出 NaN。
12. **CURL 格式化**:多行 curl 的 JSON body 必须压成单行;`fetch()` 的 JSON body 用 `JSON.stringify(对象)`,别二次 stringify。
13. **本地 HTML 预览 iframe 沙箱**:只给 `allow-scripts` 会让 frame 变不透明来源,父页面 `contentWindow.document` 抛 `SecurityError`;本地编辑器用 `allow-scripts allow-same-origin`。
14. **选文件的 `input.files` 必须快照成数组再清空 `input.value`**,否则 Blink 会连带清空 FileList(表现为「选了文件夹什么都没显示」)。已在 `LocalMedia.vue`、`ImageStitch.vue`(`onFileChange` 里 `Array.from(input.files)` 再 `input.value = ''`)各踩一次。
15. **排序一律用 `naturalCompare`**(`localeCompare` 加 `{numeric:true}`),不要直接 `localeCompare`,否则 `10 - …` 会排在 `1 - …` 前面。
16. **依赖 API 事实**:cron-parser v5 只有 `CronExpressionParser.parse` 且 `next()` 要 `.toDate()`;cronstrue 用 `cronstrue/i18n` + `zh_CN`;marked v18 的 renderer 收到 token 对象;gifenc `writeFrame(Uint8Array, w, h, {palette, delay})`;exifr 去掉 `ifd0: true`。
17. **自动化验证假象**:后台标签页里 `<transition>` 的 leave 收不到 `transitionend`,`.win-overlay` 会残留 `win-leave-active` 且 `opacity:0` —— 不是 bug,判关闭请看 class / opacity 或直接 reload,别去改 `AppWindow.vue`。
18. **Code Mode 的 `browser.evaluate` 里没有 `setTimeout`**:延时必须在**页面脚本内部**声明 `const sleep = ms => new Promise(r => setTimeout(r, ms))`;导航(`location.href` / `reload`)必须单独一次 eval;`input.focus()` 对已聚焦元素不再触发 `focus`,验证下拉用 `dispatchEvent(new FocusEvent('focus'))`。
19. **headless Chrome 截图会挂死**:`--user-data-dir=<新目录>` + `--no-proxy-server` 组合会卡十几分钟;可靠写法是不带这两个参数、`localhost:<port>`、`--virtual-time-budget=6000`,并用 `subprocess.run(..., timeout=75)` 兜底。**macOS 没有 `timeout` 命令**。
20. **运行时校验目录时 esbuild 遇到 `.vue` 动态 import 会报 `No loader is configured for ".vue"`**:加 stub 插件,或直接正则抽注册表 `name:`;Pinia 运行时测试要把 `pinia`/`vue`/`vue-demi` 标 external。
21. **`manualChunks` 不要把全部 `node_modules` 归到一个 `vendor`**:只被懒加载视图使用的重库(jsPDF、mqtt、papaparse、cron-parser)会被塞进首屏 chunk 一起预加载。正确做法:只为首屏必需的运行时(vue / vue-router / pinia / pinyin-pro)建 `vendor-core`,其余 `return undefined` 让 Rollup 跟随按需 chunk;改完看 `dist/index.html` 的 preload 列表验证。
22. **scoped 样式里深色覆盖不要写 `:global(html.dark) .xxx`**:Vue 会把它编译成裸 `html.dark{…}`,把后面的选择器整个丢掉 —— 等于直接给 `<html>` 元素设背景/边框,污染全局。正确写法是 `html.dark .xxx`(编译成 `html.dark .xxx[data-v-x]`),参考 `DesktopHome.vue` 的 `html.dark .ctx`。验证方法:`grep -o "html\.dark[^{]*{" dist/assets/xxx.css` 看 `.xxx` 是否还在。
23. **`innerHTML` 动态生成的节点拿不到 scoped 的 `data-v` 属性**:样式全部失效、只剩继承色(表现为「语法高亮不生效」)。必须写成 `.父容器 :deep(.子元素)`;`::before` / `::after` 也一样要放进 `:deep()` 里。已在 `JsonViewer.vue` 踩过。
24. **`v-if` / `v-else-if` 切换出来的元素,在同一个 tick 里 `ref` 还是 `null`**:解析完立刻 `renderTarget()` 会拿到旧 DOM 或 null(表现为「点了示例结果区是空的」)。要 `void nextTick(renderTarget)`。

---

## 8. 历史时间线(压缩版,查旧 commit 时用)

### 早期(2026-10-29 ~ 11-09)· 纯工具站
- 27 个路由工具 + Home/Sidebar/CommandPalette;`utils/common.ts`、`utils/image.ts` 成型。
- 本地媒体浏览器(`LocalMedia.vue`,HEIC 走 `heic2any` 动态加载)、本地漫画阅读器(`LocalManga.vue`,`webkitdirectory` + `naturalCompare`)、局域网直传(`LanTransfer.vue`,MQTT 信令 + WebRTC DataChannel,并新增 `lan`「局域网」分类)。
- 移除过:便签、书签管理、程序员计算器,以及旧的「最近使用」特性(现在的「最近打开」是 11-11 新做的,不要混淆)。
- 起草并否决了 fswatch + launchd 自动提交方案;**如发现 `~/Library/LaunchAgents/` 有残留 plist 应删除**。

### 2026-11-10 上午 · 按旧节奏扩应用
- `e947574`:修两处模板问题(九宫格切图、图片转 Base64 的 `v-if`/`v-else` 夹 `<input hidden>`),提交此前未提交的 5 个应用。
- `2783321`:节拍器、URL 参数解析、JWT 解析、文本行处理、SVG 图案生成器。

### 2026-11-10 起 · 主线转向「完整模仿找Tab」
- 范围约定见第 0 节与 README;游戏与阅读类整体排除。
- `e5648b3` P0:统一目录 + 状态 v2 + 壁纸预设。
- `8c03f48` P1:桌面模式设为默认首页(壁纸/系统栏/时钟/搜索/网格/Dock/右键菜单),新增 `AppIcon.vue`。
- `d95f732` P2–P4:商店 / 添加 App / 设置三个整页,删除旧 drawer;`?p=` 深链接;书签小工具;修 `teleport` 的 CSS 变量问题。
- P5-1 `d785ccc`:字节换算、ASCII 码表、HTTP 状态码、CURL 格式化、JSON/CSV 转换。
- P5-2 `118e7b2`:图片压缩、图片裁切、随机头像、印章生成器、代码美化截图(修了 raw 对象不响应、computed 读 `let` 两个响应式坑)。
- P5-3 `8d00ff1`:浏览器环境检测、WebSocket 测试、HTML 编辑器、四象限笔记、防休眠(Wake Lock 被拒 → 音频回退)。
- P5-4 `a229bc0`:IMEI 校验生成(卢恩算法)、手速测试、字帖生成器、算术题生成器、端口速查。
- 文档 `e63c1f3` + README 重写 `c3012b2`(桌面形态 / 105 应用 / 8 类计数,与实测一致)。
- `42898e2` + `d43fae7`:B 类选定项——最近打开 / 搜索分组 / 网格列表切换(详见 3.3)。
- `e5fcab1`:交接文档重写为速览式结构(第 0 节速览 / 4.1 新增应用 SOP / 20 条踩坑)。
- `663740f` + 文档:分包改为按需加载,首屏 JS 3.4MB → 1.5MB(详见 3.2);已实测桌面、商店 106 卡、图片转 PDF、哈希生成器(SHA-256 校验)、Cron 解析均正常且重库仅在打开时加载。

### 2026-11-11 · Whois 查询(B 类用户选定)
- `whois-lookup`「Whois 查询」(`src/views/apps/WhoisLookup.vue`,开发工具,图标 `Aim`):通过 `https://rdap.org/{domain|ip}/<查询值>` 自动路由到对应注册局,解析注册商 / 滥用邮箱 / 域名状态(中英映射)/ 注册与到期时间 / 剩余天数 / DNS / DNSSEC,保留原始 JSON 可复制,最近查询落本地(`utools_whois-recent-v1`);15s 超时与 404 / 429 / CORS 失败均有明确提示,并提供「在新标签页查看原始 RDAP」兜底。
- 实测:example.com(注册商 RESERVED-IANA、到期 2027-08-13、剩余 275 天、Cloudflare NS、DNSSEC 已签名、3 条状态中文)、不存在的域名(404 文案正确)、`8.8.8.8`(IP 网络 `NET-8-8-8-0-2` + 滥用邮箱)、`https://www.GitHub.com/foo?x=1`(归一化为 `github.com`)、非法输入格式提示。
- 已知限制:`.cn` 等少数后缀没有 RDAP,或注册局未开放 CORS,此时只能走「原始 RDAP」链接;查不到历史 Whois 与隐私字段。

### 2026-11-11 · 在线解压(零依赖)
- `unzip-tool`「在线解压」(`src/views/apps/UnzipTool.vue`,数据文件,图标 `Box`):纯前端解析 ZIP 中央目录,支持 store(0) 与 deflate(8);
  - 解压走浏览器原生 `DecompressionStream('deflate-raw')`,**不引入 fflate / JSZip 等任何依赖**;
  - 导出用内置「不压缩 ZIP 打包」实现(CRC32 + UTF-8 标志),把多个文件一次性交给浏览器,避免逐个下载被拦截;
  - 文件名编码:先严格 UTF-8,失败再 GBK(解决 macOS `zip` 写 UTF-8 却不置 0x800 标志导致的乱码);
  - 支持文本 / 图片预览、文件名筛选、单文件下载;加密包、ZIP64、rar / 7z 给出明确不支持提示。
- 实测(用 `zip` 生成含中文名、目录、store 与 deflate 混合的测试包):6 项全部识别、`中文.txt` 名称正确、5 个文件解压成功;文本预览与 1×1 PNG 预览正常;单文件下载 18 字节正确;导出 ZIP 经 Python `zipfile.testzip()` 校验通过,6 个条目 CRC 与内容字节完全一致;加密包提示「加密压缩包暂不支持」。

### 2026-11-11 · SVG 编辑器(零依赖,B 类自选)
- `svg-editor`「SVG 编辑器」(`src/views/apps/SvgEditor.vue`,设计资源,图标 `Edit`,commit `47876e0`):轻量矢量编辑,**不引入 fabric / konva 等任何图形库**,画布 960×640,直接渲染原生 `<svg>` 并绑指针事件。
  - 图形:矩形(含圆角)、椭圆、直线、文字;选中工具后在画布拖拽即绘制,点击不拖则给默认尺寸。
  - 交互:选择工具下拖动移动、选中框四角手柄缩放(文字按高度自动换算字号);图层列表支持选中 / 显隐 / 上移下移 / 复制 / 删除。
  - 样式:填充 / 描边色(可选「无」)、线宽、透明度、圆角、字号、加粗。
  - 历史:80 步撤销 / 重做(`Cmd/Ctrl+Z`、`Shift+Cmd+Z`);快捷键 V/R/O/L/T 切工具、Delete 删除、Esc 取消选中。
  - 导出:SVG 源码(含 `viewBox`)、2 倍 PNG(canvas 绘制)、复制源码;画布背景 透明 / 白 / 深,缩放 50%–200%。
  - 全部数据只在页面内存,刷新即清空,不上传服务器。
- 实测:商店卡片 108 张且能找到并打开 `SVG 编辑器`;矩形 / 椭圆 / 直线 / 文字四种图形均绘制成功(图层名依次出现);拖动 `100,100 → 150,150`,撤销回到 `100,100`、重做回到 `150,150`;四角缩放手柄 `120×90 → 220×180`;文字改为「你好 SVG」、加粗 `font-weight=700`、透明度 `0.4`;显隐切换、删除与撤销恢复均正常;清空走确认框,撤销可完整恢复 4 个图形;Delete 键删除选中图形生效;缩放滑块 90% 时画布宽度 864px;导出 `drawing.svg`(417 字节,含 rect / ellipse / line 合法标记)与 `drawing_2x.png`(1920×1280,66549 字节);控制台无报错。
- 开发中修正:`Circle` 图标在 `@element-plus/icons-vue` 中不存在(椭圆改用 `Aim`);`setPointerCapture` 包裹 try/catch,避免合成指针事件抛 `NotFoundError`;模板内联箭头回调改为具名处理函数;画布外套 `.canvas-wrap` 滚动容器,缩放按像素设宽。
- 已知限制:无贝塞尔路径、无渐变、无文字换行;不支持导入已有 SVG 二次编辑。

### 2026-11-11 · Element Plus 按需引入(工程优化)
- 背景:全量 `app.use(ElementPlus)` + `dist/index.css` 让首屏无条件加载 1.07MB `vendor-ui`;99 个文件从 `element-plus` 根包导入 `ElMessage`,无法靠改模板解决。
- 方案:`vite.config.ts` 引入 `unplugin-vue-components`(配 `ElementPlusResolver({ importStyle: 'css' })`,处理 `<el-*>` 与 `v-loading`)和 `unplugin-element-plus`(把 `import { ElMessage } from 'element-plus'` 自动改写为按组件导入 + 样式,99 个文件零改动)。
- `main.ts` 移除全量注册与全量 CSS,仅保留暗色变量;语言包迁移到 `App.vue`:
  ```html
  <el-config-provider :locale="zhCn"> ... </el-config-provider>
  ```
- 分包修正:`manualChunks` 不再强制 `vendor-ui`;同时补 `onlyExplicitManualChunks: true`。
  - 踩坑 1:只把 element-plus 设为 `undefined` 时,`vendor-ui` 仍是 1.07MB 且被首屏 preload。
  - 踩坑 2:再把 marked / highlight.js 也设为 `undefined` 后,两者被合并进入口,`index` 变成 1.03MB(更糟)。
  - 最终:保留 `vendor-markdown` 显式 chunk + `onlyExplicitManualChunks: true`,CJS 互操作 helper 不再被塞进该 chunk,首屏只 preload 入口 / `vendor-core` / 755B helper。
- 类型影响:自动生成的 `src/types/components.d.ts` 让 `el-*` 组件有了真实类型,暴露 6 处历史问题并已修复:
  - `ApiTester.vue` `pickColor` 返回 `danger/warning/primary/success/info`;
  - `CpsTest.vue`、`ImageCrop.vue`、`SvgEditor.vue` 的 radio / checkbox 回调补 `undefined` 与 `CheckboxValueType` 兼容;
  - `CodeGenerator.vue` 的 `:placeholder='{...}'` 改为普通字符串属性。
- 实测构建:`type-check` 0 错误、`build` 通过;首屏 chunk = `index` 486KB + `vendor-core` 419KB + `_commonjsHelpers` 755B + CSS 95KB(gzip 16KB);`vendor-markdown` 不再出现在 `index.html` 的 preload;预览页桌面、设置页(`.zt-page` / 卡片 / 导航)渲染正常,控制台无报错;`el-button` / `el-slider` 计算样式为 Element Plus 默认样式(24px 高、6px 轨道),说明按需样式已生效。
- 已知限制:首次打开某个应用时会额外请求该应用的 CSS(按需),弱网下可能出现极短的无样式瞬间;如果以后发现样式缺失,优先检查 resolver 是否覆盖了对应组件 / 指令。

### 2026-11-11 · 二维码生成:中心图片 + 手动生成(功能增强)
- `src/views/QrcodeTool.vue`(路由工具 `qrcode-tool`,`/qrcode-tool`,图片工具):
  - 新增中心图片:选择本地图片(限 `image/*`、≤8MB),以 dataURL 预览缩略图,`logoPercent` 控制图片占二维码宽度的 10%–35%;
  - 绘制方式:先用 `QRCode.toCanvas` 生成二维码,再在中心画「白色圆角底板」,将图片等比缩放后用 `arcTo` 圆角路径裁切绘制,保证不变形、不糊边;
  - 新增「生成二维码」按钮:点击才生成/刷新;首次进入自动生成一次;上传图片或移除图片时若已生成会自动刷新;修改其它设置后需手动点按钮;
  - 有中心图片时自动把容错等级提升到 `H`(L/M 时),避免遮挡导致识别失败;
  - 「下载 PNG」始终按当前设置重新生成后再导出(避免改动设置后导出旧图,内容为空时直接提示);「重置」恢复默认参数并重新生成;未生成时预览区显示占位文案。
- 校验:`npm run type-check` 0 错误、`npm run build` 通过;`QrcodeTool` 产物 6.92KB(gzip 3.01KB),按需 CSS 1.06KB。
- 已知限制:中心图片不支持在线裁剪 / 透明背景处理;图片过大时仅提示不自动压缩;生成仍依赖 `qrcode` 包的默认纠错与颜色参数。

### 2026-11-11 · 局域网直传:跨网信令可靠性(问题修复)
- 背景:用户反馈在非局域网下能看到对方、邀请也能弹出,但对方点「接受」后发起方收不到;实现里发现/信令走公共 MQTT(`broker.emqx.io`),文件走 WebRTC,`newPeer()` 只配置了 Google / Cloudflare 两个 STUN,**没有 TURN**。
- 原因判断:公共 MQTT 原先用默认 QoS 0,消息可能丢;重连窗口内发布的消息也会丢;且没有任何重发机制,accept 一丢双方就互等。
- 修复(`src/views/LanTransfer.vue`,commit `0f0f56a`):
  - 信令发布 / 订阅改为 QoS 1;
  - 邀请每 4 秒重发,直到收到 accept / reject;接受方每 3 秒重发 accept,直到收到 offer;offer 每 4 秒重发,直到收到 answer;
  - 重复邀请按「同设备重发」处理直接回 accept,不再误判为忙碌拒绝;15 秒内拒绝过的设备直接回 reject,避免反复弹窗;
  - ICE 候选在远端描述未就绪时缓存,`setRemoteDescription` 后 `flushPendingIce` 补加;
  - `connectTo` 先 `teardown()` 清理上次失败残留;`onopen` / `onclose` / `teardown` 统一清理定时器;
  - `iceConnectionState === 'failed'` 时提示「当前网络可能需要 TURN 中继,建议同一 WiFi 或手动配对」。
- 页面说明改为如实描述:在线名单是公共 MQTT 大厅(全球可见,并非真正局域网发现);跨网络无 TURN 时对称 NAT / 公司网络可能连不上,同一 WiFi 最稳。
- 校验:`type-check` 0 错误、`build` 通过(`LanTransfer` 24.01KB,gzip 9.08KB)。
- 仍未做:TURN 中继(需要第三方服务 / 自建服务器,按约定先问用户);真正的局域网 mDNS 发现。

### 2026-11-11 · 局域网直传:接受后无反馈的定位与修复(问题修复)
- 用户复测后仍反馈「接收方点确认,发送方收不到」。这次不再猜信令,直接用两个标签页读组件内部状态:
  - 双方 `signalingState` 都是 `stable`,本地 / 远端 SDP 均存在 → accept 与 offer/answer **都已送达**;
  - 但两份 SDP 里 `a=candidate` 都是 **0**,`addIceCandidate` 调用数也是 **0**,`iceConnectionState` 一直 `new` → 真正的卡点是 **ICE 候选没交换/没应用**;
  - 发起方 UI 只在 `channel.onopen` 清 `awaitingPeer`,所以「ICE 失败」被显示成「还在等对方接受」——这就是用户看到的「收不到接受」。
- 修复(`src/views/LanTransfer.vue`,commit `cb8159f`,后续补充 `4b15d30` / `7a0619e`):
  - 大厅模式在 `setLocalDescription` 后 `await waitIceGather(p, 2500)` 再发 offer / answer,让 SDP 自带候选;`waitIceGather` 增加超时参数(默认仍是 4000,手动配对模式不变);
  - 新增 `negotiating` 状态:接受后发起方文案从「正在等待 X 接受…」切换为「正在与 X 建立直连… (ice/conn)」,接收方显示同样面板;
  - 新增 20 秒协商看门狗 `startNegotiateWatchdog`:超时 `teardown()`、清 `awaitingPeer` / `incomingInvite`,双端展示常驻错误条「直连超时:当前网络可能无法穿透 NAT,建议同一 WiFi 或改用「手动配对码」」;
  - 失败提示条条件从「文案含拒绝」放宽为「未连接、非等待/协商、且 has 文案」,避免超时提示随面板消失;
  - `iceConnectionState === 'failed'` 时立即结束协商、清状态并展示错误条(不必等 20 秒);错误条限定 `mode === 'lobby'`,避免手动配对模式的「正在生成邀请码 / 等待应答码」被当成错误。
- 实测:接受后双端立即切到「正在建立直连… (new/new)」,20 秒后双端出现超时错误条且可重新发起;`npm run type-check` 0 错误,`build` 通过(24.81KB / gzip 9.29KB)。
- 验证限制:该自动化浏览器里连纯 host(不配 STUN)的 `RTCPeerConnection` 都采集不到候选(`complete` 但 0 个),所以本环境无法验证真实 P2P 连通性;跨网最终能否打通仍取决于双方 NAT,无 TURN 时对称 NAT / 公司网络必然失败。

### 2026-11-12 · 局域网直传:手动配对码改为 6 位数字房间(功能变更)
- 用户要求:「保持现状(TURN 不做),手动配对码改成随机 6 位数字,发起方和接收方输入同一个数字加入对方房间」。
- 删除:`packCode` / `unpackCode`(SDP 压缩编解码)、配对码二维码 `manualMyQr`、邀请码 / 应答码文本框与 `.code-row` / `.code-qr` / `.code-main` / `.code-actions` / `.choose` 样式。
- 新增房间协议(`src/views/LanTransfer.vue`,commit `eabe8ca`):
  - 房间主题 `utools/lanx/room/v1/<6 位码>`,与大厅共用同一个 MQTT 连接;消息 `{ t: 'join' | 'offer' | 'answer' | 'ice', from, fromName, platform, sdp?, candidate? }`;
  - `joinRoom()` 订阅房间并广播 `join`;`joinRandomRoom()` 用 `crypto.getRandomValues` 生成 100000–999999 后直接加入;
  - 角色:收到 `join` 后比较 `myId < msg.from`,小的一方 `prepareRoomPeer(true)` 并发 offer,另一方 `prepareRoomPeer(false)` 等 offer;双方都无需选择「我是发起方 / 接收方」;
  - 幂等与重发:每 2.5 秒重发 `join`;offerer 未收到 answer 时重发 offer,answerer 重发 answer;重复 offer 直接回发已生成的 answer;`roomOffering` / `roomAnswering` 防止并发协商;
  - 候选:发 offer / answer 前 `waitIceGather(p, 2500)`,同时继续用房间主题 trickle,远端描述未就绪时进 `pendingIce` 缓存;
  - 清理:`leaveRoom()` 停定时器 + 退订房间;`resetPairing()` = `leaveRoom()` + 必要时 `disconnect()`;`disconnect()` 现在统一先 `leaveRoom()`,避免断开后仍在旧房间发包;`switchMode()` / `onclose` 都改调 `resetPairing()`;
  - 重连:MQTT `connect` 回调里补订阅当前房间;
  - 互不干扰:配对模式收到大厅邀请直接回 `reject`,不弹窗。
- 行为变化(已同步到页面文案与 `config/tools.ts`):配对码依赖公共 MQTT,断网时不再能像旧「复制粘贴 SDP」那样离线兜底。
- 已知限制:6 位码空间约 100 万,公共 broker 上可被猜测/碰撞;房间只保留第一对设备,后来者被忽略;不适合给陌生人传敏感文件。
- 验证:Node + `mqtt` 脚本对随机房间主题做双客户端收发,双方都收到 `AAAA1111` 与 `BBBB2222`(自身回显由 `from === myId` 过滤);`type-check` 0 错误、`build` 通过(`LanTransfer` 24.59KB / gzip 9.11KB)。真实 WebRTC 连通性仍受环境限制无法在本机验证。

### 2026-11-12 · 修复 CI 构建失败(vue-tsc 对含 :// 的 placeholder 误判)
- 背景:推送后 Cloudflare Pages 构建失败,报 `src/views/apps/TotpAuth.vue` 8 处 `TS2339: Property 'value' does not exist on type '{...dialog...}'`;本地 `npm run type-check` 却是 0 错误。
- 定位:
  - 排查版本差异发现远程 main 已被新提交 `1725481 重置package-lock.json`(另一侧推送)覆盖,把 `element-plus` 2.14.7→**2.14.8**、`vue` 3.5.44→3.5.45、`vue-tsc`/`@vue/language-core` 3.3.13→3.3.14;本地 `node_modules` 已随之更新,但本地构建仍过(存在提升/缓存差异)。
  - `/tmp` 干净克隆 `1725481` + `npm ci` 复现 8 个错误;`vue-tsc@3.3.13` 仍报错 → 非 vue-tsc 单版本问题。
  - 最小用例二分到组合条件:`el-dialog` + `el-form-item` + `<el-input placeholder="otpauth://totp/...?secret=...">`;placeholder 换成不含 `://` 的字符串即消失(`https://example.com`、`x://y` 同样触发,`x:y`、`x/` 不触发)。
  - 结论:vue-tsc 在模板中对含 `://` 的静态属性值做了类似类型解析的处理,连带把同节点 `v-model` 目标误判为需要 `.value`,属上游解析缺陷。
- 修复 `fd313bd`:`TotpAuth.vue` 的该 placeholder 提为 `URI_PLACEHOLDER` 常量 + `:placeholder` 绑定,并加注释说明;不改文案。
- 验证:本地 type-check/build 通过;干净克隆 `fd313bd` + `npm ci` 的 `npm run build` 通过(等价 CI)。已推送,远程 `origin/main` = `fd313bd`。
- 备注:全仓库另有 6 处 `placeholder` 含 `://`,当前不报错;若后续出现同类报错,按同样方式改为绑定表达式即可。

### 2026-11-12 · 默认桌面清单调整 + 二维码生成/解析合并(功能变更)
- 默认桌面按用户指定改为 15 项:`local-media`、`lan-transfer`、`json-viewer`、`color-tool`、`sticky-notes`、`qrcode-tool`、`timestamp`、`translator`、`ip-lookup`、`todo-list`、`url-parser`、`encode-decode`、`palette-generator`、`json-generator`、`local-manga`(commit `b44ba7d`)。
  - 仅改 `DEFAULT_DESKTOP_IDS`;已存在 `utools_desktop-state` 的用户不受影响,设置页「重置布局」可套用新默认。
  - 逐键核对:15 个 key 在 `tools.ts` / `desktopApps.ts` 中各存在且唯一。
- 二维码合并:删除 `qr-decode` 路由与 `src/views/QrDecode.vue`,把解析并入 `QrcodeTool.vue` 的第二个 tab;目录 108 → 107(79 + 28),图片工具 12 → 11;README / HANDOVER 计数同步。
- 生成参数对齐 `cli.im/text/other`:内容模板(文本/网址/电话/短信/邮件/WiFi)、码制(仅 QR + 不支持说明)、容错率显示 7%/15%/25%/30%、尺寸预设 300/400/600/自定义、边距按「色块」0–10、前景/背景色、Logo 与大小;新增 SVG 导出(不含 Logo,有提示),PNG 仍按当前设置重生成。
- 解析保留 jsQR 三级放大重试,新增「打开链接」(仅 http/https)。
- 校验:`type-check` 0 错误、`build` 通过(`QrcodeTool` 159.64KB / gzip 58.02KB);dev server `/qrcode-tool` 200,模板与默认清单模块编译正常,顺序已从产物核对。
- 限制:参数截图无法读取(模型不支持图片输入),以参考页可见参数为准;若截图有额外项,后续再补。

### 2026-11-12 · 商店打开应用后「返回」回到商店而非首页(对齐找Tab,行为修复)
- 用户要求:「在桌面的 UI 样式上跟找Tab 保持一致——打开商店、在商店中打开某个应用,返回时不应直接到首页(找Tab 不是这样)」。
- 找Tab 实测(`/store?in=zhaotab`):商店是真实路由进历史栈,应用以浮层打开在当前页面之上,底下页面不被关闭;关闭应用回到进来的页面。
- 修复(`StorePage.vue` / `DesktopHome.vue`):
  1. `openNow()` 删掉 `emit('close')`——商店里点「打开」后商店保持在底下,`AppWindow`(teleport to body,z-index 1500 > `.zt-page` 60)盖在商店上;关闭应用窗口即回到商店,不再直接退到桌面首页;
  2. `panel` 同步从 `router.replace` 改为 `router.push`——每次进出商店/设置/添加都进历史栈,浏览器后退 `/?p=store` → `/`、前进可回来,与找Tab 一致(旧代码注释声称「前进/后退也能切换」但 replace 下并不成立);
  3. Esc 键改为**先关应用窗口**(早退),再按才关面板——避免商店被从打开的应用底下抽走。
- 实测(dev server + 真实 DOM):商店打开「白噪音混音台」→ `.win-overlay` 与 `.zt-page` 同时存在;关红点 → 窗口 opacity 0、商店仍在(h1=应用商店);浏览器后退 → `/` 桌面、前进 → `/?p=store` 商店;商店「返回桌面」→ 桌面、再浏览器后退 → 回商店;Esc 派发 KeyboardEvent 验证:第一次关窗口、第二次退面板到 `/`。
- 注意:后台标签页里 `<transition>` enter/leave 都收不到 transitionend,窗口实际状态要看 `opacity` 与 class,不要误判(踩坑 17)。

### 2026-11-12 · 工作区类应用改为全屏窗口打开(界面调整)
- 用户要求:首页保持现状;二级页面里「全屏显示更美好」的应用(点名本地漫画阅读器、JSON 生成器、长图拼接)全屏打开。
- 实现:`appCatalog.ts` 新增 `FULLSCREEN_APPS`(12 个,在浮层清单基础上扩展了同类工作区应用),`AppWindow.vue` 命中时渲染 `fs-overlay`(padding 0)+ `win-full`(max-width/max-height 取消、height 100%、圆角 0),并 `:deep(.tool-page){max-width:none}` 放开 1200px 限宽;**保留 win-body 内边距**(views/apps 下的桌面应用根容器只有 4px 2px padding,归零会贴边)。其余应用仍为 1100px 圆角浮层。
- 全屏清单:local-manga、local-media、json-generator、json-viewer、image-stitch、markdown-editor、diff-tool、csv-viewer、svg-editor、html-editor、drawing-board、quadrant-notes。
- 实测(dev server):本地漫画阅读器(搜索打开)与长图拼接(商店打开)窗口 offsetWidth/Height = 视口(1936×1265)、radius 0、`tool-page` maxWidth none、商店保持打开在底下;科学计算器(非清单)仍 920×616 / radius 18 / 浮层 padding 28px 40px;Esc 先关全屏窗口、再按退面板到 `/`。
- 注意:后台标签页 transition 不结束,`getBoundingClientRect` 会卡在 scale(0.97),判断尺寸用 `offsetWidth/offsetHeight`(踩坑 17 的补充)。

### 2026-11-12 · 范围收缩:B 类应用全部放弃(决策,非代码变更)
- 用户明确:「B类的这些都不需要做了」→ PDF 裁剪 / 图片去背景 / 随机图片 / 浏览器插件 / 真云同步 全部不做,第 6 节 B 已改为「不要再提议」。
- 同时更正遗留表述:第 9 节原写「是否接 TURN 需拍板」,实际早已决定保持现状(不接 TURN,跨网失败走现有提示 + 6 位配对码)。
- 无源码改动,仅 `HANDOVER.md`。

### 2026-11-12 · 长图拼接改为「好拼」风格三栏布局(界面重构)
- 参考 `img.ops-coffee.com/photo/`(好拼)重做 `src/views/ImageStitch.vue` 的界面:左栏设置 + 图片顺序、中栏画布工具条 + 预览、右栏样式与导出;设计令牌(主色 `#0052cc`、`#e9f2ff` 激活态、`#f4f5f7` 画布底、`#dfe1e6` 边框)直接对齐该站,深色模式另做映射。
- **功能保持一致**,未增删能力;顺带修 3 个旧缺陷:缩略图复用已被 `revokeObjectURL` 的 URL(必然加载失败)、`watch(items.value)` 快照导致清空后不重绘、`forEach(async …)` 导致拼接顺序随解码完成时间乱序(改串行 await)。
- 新增拖拽导入(整块区域可拖入),`URL.createObjectURL` 在移除 / 清空 / 卸载时释放。
- 实测:竖向 400×1037 / 横向 745×150 / 间距 30 → 785×150 / 背景色进像素 / 上移换序 / 移除 → 463×200 / 清空复位,均符合预期;`type-check` 0 错误、`build` 通过。
- 踩坑记入第 7 节第 22 条(`:global(html.dark)` 会丢选择器)。

### 2026-11-12 · 长图拼接完整实现布局拼图功能(`9c1d309`)
- 用户要求「完全实现这个网站的功能,左侧布局、右侧比例等等都要有」,于是从「界面像」推进到「功能齐」:新增 135 个布局模板、14 个画布比例 + 自定义、边框(上右下左)/间距/圆角、背景色/背景图、水印、导出质量、复制到剪贴板、叠加元素(文字/箭头/方框/圆圈)。
- 新文件:`src/config/collageLayouts.ts`(布局数据,`id:cols:rows:cells` 编码 + 分组索引 + `stitchLayout()`)、`src/utils/collage.ts`(设计坐标几何 + 导出渲染,零依赖)。
- 保留「竖向长图 / 横向长图」作为特殊布局,原长图拼接能力不丢;长图模式下追加图片会自动增行。
- 修真实 bug:`onFileChange` 先取 `input.files` 再 `input.value = ''` —— FileList 是活引用,清空后长度归零,图片永远加载不进来;改为 `Array.from` 快照(与第 7 节第 14 条同一个坑)。
- 健壮性:`setPointerCapture` 包 try/catch(合成事件无活动指针会抛);剪贴板写入加 4s 超时兜底(无用户手势时 Promise 会一直挂起)。
- 校验:135 布局逐个点开验重叠/越界/数量全通过;导出像素用 `sips` 转 PNG + 纯 Python zlib 解码核对(4 格 2400×2400、16 格 2400×1350、色块位置全对);`type-check` 0 错误、`build` 通过。

### 2026-11-12 · JSON 查看器对齐 json.cn(`04c14e7`)
- 用户要求「样式和功能跟 json.cn/jsononline 保持一致」,并点名两处:① 解析结果左上角要有多个功能按钮;② 选中图片地址要显示小图。
- 先抓取参考站 HTML / CSS / JS(`json-format.js` 的 `JSONFormat`、`jf1.js` 的工具条逻辑)确认事实:token 颜色 `#92278f/#3ab54a/#25aae2/#f98280/#f1592a/#61D2D6`、4 空格缩进、折叠摘要 `Object{...}`/`Array[n]`、工具条 9 个按钮 + 保留转义勾选框 + 全屏、编辑结果区会回写左侧输入框、URL 包 `<a class="json_link">`。
- 重写 `JsonViewer.vue`:双栏 + 可拖动分隔条 + 双侧行号、工具条、语法着色、折叠/展开全部、键值 `contenteditable`、压缩/转 XML/保存/复制/示例/全屏/保留转义、XML 自动转 JSON、大整数保护、错误定位。
- **图片小图预览是用户要的增强**(参考站本身没有):图片地址点击弹 260px 卡片,含「打开原图」,点空白/Esc 关闭。
- 删除 `src/components/JsonTreeNode.vue`(旧的递归树组件已无引用,`components.d.ts` 自动同步)。
- 踩坑记入第 7 节第 23、24 条(`innerHTML` 需要 `:deep()`;`v-if` 切换后要等 `nextTick`)。
- 校验:着色/折叠/行号/压缩/XML/保存/复制/图片预览/编辑回写/错误/深色/全屏全部实测通过;`type-check` 0 错误、`build` 通过。

---

## 9. 下次接手推荐动作

1. 核基线:`npm run type-check`、`npm run build`,`git status -sb` 应为空,`git rev-parse HEAD origin/main` 应相等。
2. **B 类应用已全部被用户否决**(2026-11-12):PDF 裁剪 / 图片去背景 / 随机图片 / 浏览器插件 / 真云同步 —— **不要再提**。后续可推进的只剩:C 类工程债(LanTransfer 真实跨网人工验证:大厅 + 6 位配对码两种模式)、以及用户新提出的需求。TURN 中继已于更早明确「保持现状」,不再讨论。
3. 若继续加应用,严格按 **4.1 的 6 步 SOP**,每批做完就 commit + push,并回来更新本文件第 3 节数量与第 8 节时间线。
4. 任何「要不要接第三方服务 / 重型库」的取舍,**先问用户再动手**。
