/// <reference types="vite/client" />

/** .env 里的自定义变量(值在 .env,这里只声明类型) */
interface ImportMetaEnv {
  /** Supabase 项目地址,如 https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL: string
  /** Supabase anon / publishable key(可公开,配合 RLS 使用) */
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: number[][]; delay?: number }): void
    setRepeat(n: number): void
    finish(): void
    bytes(): Uint8Array
  }
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: unknown): number[][]
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
