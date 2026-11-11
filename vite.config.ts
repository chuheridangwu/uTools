import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import ElementPlus from "unplugin-element-plus/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // 开发服务器配置:使用 5199 端口避免与其他项目冲突
  server: {
    port: 5199,
    host: true, // 允许局域网访问
  },
  // 路径别名:@ 指向 src 目录
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    vue(),
    /**
     * Element Plus 按需引入(2026-11-11):
     *  - Components + ElementPlusResolver:模板里的 <el-*> 组件与 v-loading 指令按需注册并只引对应样式;
     *  - unplugin-element-plus:把 `import { ElMessage } from 'element-plus'` 自动改写成
     *    `element-plus/es/components/message/index` + 样式,避免 99 个文件逐个改;
     *  - 因此 main.ts 不再全量 `app.use(ElementPlus)` 与 `dist/index.css`,语言包改由
     *    App.vue 的 <el-config-provider :locale="zhCn"> 提供。
     */
    Components({
      dts: "src/types/components.d.ts",
      resolvers: [ElementPlusResolver({ importStyle: "css" })],
    }),
    ElementPlus({}),
  ],
  build: {
    target: "es2022", // 现代浏览器,代码体积更小
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        /**
         * onlyExplicitManualChunks:
         * 只让 manualChunks 里明确点名的模块进入手动 chunk,不再把「共用依赖 / CJS 互操作 helper」
         * 自动塞进手动 chunk。否则入口会静态 import 手动 chunk 里的 helper,导致整个 chunk
         * 被 modulepreload(实测 vendor-markdown 1MB 被首屏预加载)。
         */
        onlyExplicitManualChunks: true,
        /**
         * 手动分包策略(2026-11-11 调整):
         *  - 只把「首屏必需」的运行时打进 vendor-core:vue / vue-router / pinia / pinyin-pro。
         *  - Element Plus 与 marked / highlight.js 都不再强制合并:
         *    按需引入后若仍把它们锁进固定 chunk,该 chunk 会被首屏入口静态引用并 preload,
         *    反而把懒加载重库变成首屏负担(实测 vendor-markdown 的 CJS 互操作 helper 会被入口引用)。
         *  - 其余第三方库一律交给 Rollup 跟随「按需路由 chunk」,避免 jspdf / mqtt / papaparse
         *    这类只在懒加载视图里用的重库被塞进首屏 vendor(旧策略会把 2.4MB vendor 全量预加载)。
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // HEIC 解码库体积较大且仅按需使用,交给 Rollup 独立分包
          if (id.includes("heic2any") || id.includes("libheif")) return undefined;
          // Element Plus 按需引入:跟随各自的 import 方分包,首屏只带走真正用到的组件
          if (id.includes("element-plus") || id.includes("@element-plus")) {
            return undefined;
          }
          // 同理,marked / highlight.js 只在「Markdown 编辑器」等懒加载视图使用,不要锁 chunk
          if (id.includes("highlight.js") || id.includes("/marked/")) {
            return "vendor-markdown";
          }
          if (
            id.includes("/node_modules/vue/") ||
            id.includes("/node_modules/@vue/") ||
            id.includes("/node_modules/vue-router/") ||
            id.includes("/node_modules/pinia/") ||
            id.includes("/node_modules/vue-demi/") ||
            id.includes("/node_modules/pinyin-pro/")
          ) {
            return "vendor-core"; // 首屏必需的运行时
          }
          return undefined; // 其余按需库跟随各自的懒加载 chunk
        },
      },
    },
  },
});
