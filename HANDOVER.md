# HANDOVER 交接文档 · uTools 在线工具箱

> 最后更新:**2026-11-11** · 代码基线 `a4c8a0f` · 工作区干净 · `type-check` 0 错误 · `build` 通过。
> **接手请先读第 0 节与第 5 节**,历史细节按需查第 8 节。

---

## 0. 30 秒速览

- **这是什么**:Vue 3 + TypeScript + Vite + Element Plus,「找Tab(https://www.zhaotab.com/)」风格的桌面化在线工具箱。
- **两个形态**:有路由的「工具」(`config/tools.ts`,29 个,走 `<router-view>`)与无路由的「桌面应用」(`config/desktopApps.ts`,80 条注册、**2 条排除** → 78 个,以浮层 `AppWindow` 打开)。
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
| 桌面应用 / 路由工具 | 78 / 29(注册表 80 条,排除电台随身听、公众号排版) |
| 默认桌面图标 | 34 个(其余在商店「添加」) |
| 商店卡片 | 107 张 |

分类计数(浏览器实测,与 README 一致):
`全部 107 · 效率工具 21 · 开发工具 29 · 设计资源 12 · 生活实用 24 · 文本工具 3 · 图片工具 12 · 数据文件 5 · 局域网 1`
排除项泄漏 **0**。

### 3.2 构建 / 校验

- `npm run type-check` → 0 错误。
- `npm run build` → 通过(EXIT=0)。

**分包现状(2026-11-11 调整,commit `663740f`)**:

| chunk | 大小 | 是否首屏加载 |
| --- | --- | --- |
| `index` | 126KB | ✅ |
| `vendor-core`(vue/router/pinia/pinyin-pro) | 418KB | ✅ |
| `vendor-ui`(element-plus) | 1.07MB | ✅ |
| `vendor-markdown`(marked / highlight.js) | 1.03MB | 懒加载 |
| `heic2any` | 1.35MB | 懒加载 |
| `ImageToPdf`(含 jsPDF) | 391KB | 懒加载 |
| `CronParser`(cron-parser + cronstrue) | 307KB | 懒加载 |
| `mqtt` | 338KB | 懒加载 |

> 首屏 JS 由旧策略的 **3.4MB 降到 1.5MB**(`index.html` 只 preload 3 个 chunk)。旧 `manualChunks` 把所有 node_modules 塞进单个 `vendor`,导致 jspdf / mqtt / papaparse 这些只被懒加载视图使用的库也被首屏预加载。**新增第三方库时不要再回到「统一 vendor」写法**。

### 3.3 最近一次交付(B 类,用户选定项)

`42898e2` + 文档 `d43fae7`:**商店与桌面的最近打开、搜索分组、网格 / 列表视图切换**。
- 商店:最近打开横条、搜索分组(最近打开 / 最匹配 / 相关结果)+ 结果统计、网格↔列表(`storeView` 持久化)。
- 桌面:搜索框聚焦且为空 → 「最近打开」分组;输入关键词 → 「搜索结果」分组;点命中即打开并 `pushRecent`(去重前移,上限 12)。
- 实测:商店切换视图后刷新仍为列表;最近打开 2 条;搜「图片」→ 最匹配 12 + 相关 14 = 「26 个结果 · 2 组」;桌面聚焦 → 「最近打开 2」,输入「端口」→ 「搜索结果 1」,打开窗口后 `recentIds` 顺序正确维护。

---

## 4. 架构与文件地图

```
src/
  main.ts / App.vue              # 入口;桌面模式下 App.vue 不渲染 <router-view>
  config/
    tools.ts                     # 29 个「有路由的工具」注册表
    desktopApps.ts               # 78 条「浮层应用」注册表(2 条被排除)
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
  views/*.vue                    # 29 个路由工具视图 + Home
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

**窗口**:应用以浮层窗口打开,可拖动、可关闭,加载态占位;路由工具与桌面应用共用 `AppIcon`。

**107 个应用**:覆盖效率 / 开发 / 设计 / 生活 / 文本 / 图片 / 数据文件 / 局域网八类。每个 P5 批次应用都做过浏览器实测(文件注入、WebSocket 回显、canvas 渲染与导出、持久化、算法正确性等),详见第 8 节。

---

## 6. 未完成项

### A. 以前的主线:按找Tab 补齐应用 —— ✅ 已结束
P5-1~P5-4 共 20 个应用全部完成。找Tab 非游戏应用已基本覆盖。

### B. 需要用户拍板才能做的(不要擅自开工)
| 项 | 说明 |
| --- | --- |
| 图片去背景 | 需 ML 模型或第三方 API,体积 / 隐私成本高 |
| ~~Whois 查询~~ | ✅ 已完成(`whois-lookup`,RDAP 直连,见第 8 节) |
| ~~在线解压~~ | ✅ 已完成(`unzip-tool`,原生 DecompressionStream,零依赖,见第 8 节) |
| PDF 裁剪 | 可引入 `pdf-lib` 纯前端做,约 +150KB |
| 在线解压 | 可引入 `fflate` 做 zip,rar/7z 不支持 |
| 随机图片 | 需外链图源,稳定性不可控 |
| 完整 SVG 编辑器 | 已有「SVG 图案生成器」近似覆盖 |
| 浏览器插件 | 目前只有书签小工具(`?add=`) |
| 真云同步 | 与 9.1 约定冲突,除非用户改口 |

### C. 工程债(可延后)
- ~~大 chunk 警告~~ ✅ 已优化(2026-11-11,`663740f`):改为按需分包,首屏 JS 3.4MB → 1.5MB;`vendor-markdown` / `heic2any` / `ImageToPdf` / `CronParser` / `mqtt` 等只在用到时加载。仍 >1MB 的只剩 `vendor-ui`(element-plus 全量)与 `vendor-markdown`,如需继续压缩可改 Element Plus 按需引入(改动面较大,需回归全部页面)。
- `package.json` 里的 `jimp` **已无任何源码引用**(`grep -rn jimp src` 为空),属历史残留;移除前确认没有动态引用即可(本次未动,避免无谓 lockfile 变更)。
- `LanTransfer.vue` 的**真实 WebRTC 连通性仍未人工验证**:内置 Review 浏览器没有可用 WebRTC(`localDescription` 无 candidate,ICE 恒 `new`),自动化只测过 UI / 信令流程。**需在真 Chrome + 手机验证,不要误判为代码 bug**。

---

## 7. 踩坑清单(按「下次最容易再踩」排序)

1. **必须跑 `npm run build`**,只跑 type-check 会漏掉模板 codegen 崩溃。批量定位:`node -e` 调 `@vue/compiler-sfc` 的 `compileTemplate()` 扫 `src/views/apps/*.vue`。
2. **`v-if` 与 `<template v-else>` 之间不能夹任何元素**(连 `<input hidden>` 也不行),否则 codegen 报 `Cannot read properties of undefined (reading 'type')` / `Codegen node is missing`。修法:把中间元素移到 `v-if` 之前;中间只留 HTML 注释是安全的。已修 `ImageToBase64`、`NineGridCut`、`ImageCrop`(这个坑已经踩过三次)。
3. **新增应用必须改两处 + 追加 `RELEASE_BATCHES`**(见 4.1)。`CATALOG` 由注册表派生,**不要另建目录**。
4. **`category` 是字面量联合类型**。用 `数据文件`/`图片工具`/`文本工具`/`局域网` 时,`desktopApps.ts` 的联合类型与 `appCatalog.ts` 的 `APP_CATEGORY_MAP` **都要加**。
5. **Vue 3 响应式**:push 进 `ref([])` 的 raw 对象后续赋值不触发更新(表现为永远「压缩中」)→ 必须取回响应式代理再改;computed 读模块级 `let` 变量不建立依赖 → 改 `ref`。已修 `ImageCompress.vue`、`ImageCrop.vue`。
6. **`teleport to="body"` 拿不到 `.desktop` 上的 CSS 变量**:右键菜单 `.ctx` 必须在自身定义 `--fg` / `--glass-bg` / `--shadow` 并在 `html.dark` 覆盖。
7. **深链接只能用 `query` + `router.replace({query})`**,不要 `window.history.replaceState`(会让 router 状态与地址栏脱钩),也不要新增路径式路由。
8. **`AppIcon.vue` 外链 favicon 会失效**:用 `imgFailed` + `watch(iconUrl)` 回退到 emoji → EP 图标 → 首字;`AddAppPage` 会 `new Image()` 预检 URL。
9. **图标名要验**:注册表里写的是字符串名,新增前 `node -e "...'X' in require('@element-plus/icons-vue')"`(`headphones` 不存在 → `Headset`;没有 `Left` → 用 `ArrowLeft`)。
10. **`el-radio-group` 的 `@change` 显式标注类型**:模板内联 `(v) => …` 会让参数隐式 `any` 过不了 type-check → 抽成 `(v: string | number | boolean)` 的命名函数。
11. **`el-select allow-create` 的自定义值要归一化**(字节换算里 `MB`/`MiB`/`M` 都得认),否则显示对、算出 NaN。
12. **CURL 格式化**:多行 curl 的 JSON body 必须压成单行;`fetch()` 的 JSON body 用 `JSON.stringify(对象)`,别二次 stringify。
13. **本地 HTML 预览 iframe 沙箱**:只给 `allow-scripts` 会让 frame 变不透明来源,父页面 `contentWindow.document` 抛 `SecurityError`;本地编辑器用 `allow-scripts allow-same-origin`。
14. **`LocalMedia.vue` 选文件**:必须先把 `input.files` 快照成数组再清空 `input.value`,否则 Blink 会连带清空 FileList(表现为「选了文件夹什么都没显示」)。
15. **排序一律用 `naturalCompare`**(`localeCompare` 加 `{numeric:true}`),不要直接 `localeCompare`,否则 `10 - …` 会排在 `1 - …` 前面。
16. **依赖 API 事实**:cron-parser v5 只有 `CronExpressionParser.parse` 且 `next()` 要 `.toDate()`;cronstrue 用 `cronstrue/i18n` + `zh_CN`;marked v18 的 renderer 收到 token 对象;gifenc `writeFrame(Uint8Array, w, h, {palette, delay})`;exifr 去掉 `ifd0: true`。
17. **自动化验证假象**:后台标签页里 `<transition>` 的 leave 收不到 `transitionend`,`.win-overlay` 会残留 `win-leave-active` 且 `opacity:0` —— 不是 bug,判关闭请看 class / opacity 或直接 reload,别去改 `AppWindow.vue`。
18. **Code Mode 的 `browser.evaluate` 里没有 `setTimeout`**:延时必须在**页面脚本内部**声明 `const sleep = ms => new Promise(r => setTimeout(r, ms))`;导航(`location.href` / `reload`)必须单独一次 eval;`input.focus()` 对已聚焦元素不再触发 `focus`,验证下拉用 `dispatchEvent(new FocusEvent('focus'))`。
19. **headless Chrome 截图会挂死**:`--user-data-dir=<新目录>` + `--no-proxy-server` 组合会卡十几分钟;可靠写法是不带这两个参数、`localhost:<port>`、`--virtual-time-budget=6000`,并用 `subprocess.run(..., timeout=75)` 兜底。**macOS 没有 `timeout` 命令**。
20. **运行时校验目录时 esbuild 遇到 `.vue` 动态 import 会报 `No loader is configured for ".vue"`**:加 stub 插件,或直接正则抽注册表 `name:`;Pinia 运行时测试要把 `pinia`/`vue`/`vue-demi` 标 external。
21. **`manualChunks` 不要把全部 `node_modules` 归到一个 `vendor`**:只被懒加载视图使用的重库(jsPDF、mqtt、papaparse、cron-parser)会被塞进首屏 chunk 一起预加载。正确做法:只为首屏必需的运行时(vue / vue-router / pinia / pinyin-pro)建 `vendor-core`,其余 `return undefined` 让 Rollup 跟随按需 chunk;改完看 `dist/index.html` 的 preload 列表验证。

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

---

## 9. 下次接手推荐动作

1. 核基线:`npm run type-check`、`npm run build`,`git status -sb` 应为空,`git rev-parse HEAD origin/main` 应相等。
2. **先问用户要做哪一项**:B 类剩「图片去背景 / PDF 裁剪 / 随机图片 / 完整 SVG 编辑器 / 浏览器插件」(Whois、在线解压已于 2026-11-11 完成),或 C 类工程债(LanTransfer 人工验证 / Element Plus 按需引入)。
3. 若继续加应用,严格按 **4.1 的 6 步 SOP**,每批做完就 commit + push,并回来更新本文件第 3 节数量与第 8 节时间线。
4. 任何「要不要接第三方服务 / 重型库」的取舍,**先问用户再动手**。
