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
        // 手动分包:把体积较大的第三方库单独拆分,便于浏览器缓存
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            // HEIC 解码库体积较大且仅按需使用,交给 Rollup 独立分包
            if (id.includes("heic2any") || id.includes("libheif")) return undefined;
            if (id.includes("element-plus") || id.includes("@element-plus")) {
              return "vendor-ui"; // UI 框架
            }
            if (id.includes("highlight.js") || id.includes("marked")) {
              return "vendor-markdown"; // Markdown 渲染相关
            }
            return "vendor"; // 其他公共依赖
          }
          return undefined;
        },
      },
    },
  },
});
