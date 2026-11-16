/**
 * pdf.js worker 入口(带兼容垫片)
 * pdf.worker.min.mjs 自身也用了 Map.getOrInsertComputed 等新 API,
 * Safari 18.x 里 worker 一启动就会挂;先装垫片再加载官方 worker。
 * 主线程通过 new Worker(new URL('./pdfWorker.ts', import.meta.url)) 使用本文件,
 * Vite 会把它(连同 pdf.js worker)打进独立 chunk,仍然懒加载。
 */
import { installPdfPolyfills } from '@/utils/pdfPolyfills'

installPdfPolyfills()
// 官方 worker 无类型声明(见 env.d.ts 的模块声明);副作用导入:
// 在 worker 作用域内自注册消息处理器并接管 self
await import('pdfjs-dist/build/pdf.worker.min.mjs')
