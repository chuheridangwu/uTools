/// <reference types="vite/client" />

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
