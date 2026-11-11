import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
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
  plugins: [vue()],
  build: {
    target: "es2022", // 现代浏览器,代码体积更小
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        /**
         * 手动分包策略(2026-11-11 调整):
         *  - 只把「首屏必需」的运行时打进 vendor-core:vue / vue-router / pinia / pinyin-pro。
         *  - element-plus 单独 vendor-ui。
         *  - 其余第三方库一律交给 Rollup 跟随「按需路由 chunk」,避免 jspdf / mqtt / papaparse
         *    这类只在懒加载视图里用的重库被塞进首屏 vendor(旧策略会把 2.4MB vendor 全量预加载)。
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // HEIC 解码库体积较大且仅按需使用,交给 Rollup 独立分包
          if (id.includes("heic2any") || id.includes("libheif")) return undefined;
          if (id.includes("element-plus") || id.includes("@element-plus")) {
            return "vendor-ui"; // UI 框架
          }
          if (id.includes("highlight.js") || id.includes("marked")) {
            return "vendor-markdown"; // Markdown 渲染相关
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
