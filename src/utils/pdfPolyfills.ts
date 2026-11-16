/**
 * pdf.js 6.x 兼容垫片
 * pdfjs-dist 6.5 使用了 2026 年才全量落地的新 JS 内置方法:
 *   - Map.prototype.getOrInsert / getOrInsertComputed(Safari 26.2+ / Chrome 145+ / Firefox 144+)
 *   - Promise.try(Safari 18.2+)
 *   - Uint8Array.fromBase64 / toBase64 等(Safari 18.2+)
 * Safari 18.x(如 18.6)、Safari 17 与旧版 WebView 会直接 TypeError 导致 PDF 解析失败。
 * 这里按 TC39 提案语义补齐,原生支持时零开销;主线程与 worker 两端都要安装。
 */

export function installPdfPolyfills(): void {
  /* Map.prototype.getOrInsert(Computed) */
  const m = Map.prototype as unknown as Record<string, unknown>
  if (typeof m.getOrInsert !== 'function') {
    m.getOrInsert = function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (this.has(key)) return this.get(key)
      this.set(key, value)
      return value
    }
    m.getOrInsertComputed = function (
      this: Map<unknown, unknown>,
      key: unknown,
      fn: (key: unknown) => unknown,
    ) {
      if (this.has(key)) return this.get(key)
      const value = fn(key)
      this.set(key, value)
      return value
    }
  }

  /* WeakMap.prototype.getOrInsert(Computed)(同提案,防御性补齐) */
  if (typeof WeakMap !== 'undefined') {
    const w = WeakMap.prototype as unknown as Record<string, unknown>
    if (typeof w.getOrInsert !== 'function') {
      w.getOrInsert = function (this: WeakMap<object, unknown>, key: object, value: unknown) {
        if (this.has(key)) return this.get(key)
        this.set(key, value)
        return value
      }
      w.getOrInsertComputed = function (
        this: WeakMap<object, unknown>,
        key: object,
        fn: (key: object) => unknown,
      ) {
        if (this.has(key)) return this.get(key)
        const value = fn(key)
        this.set(key, value)
        return value
      }
    }
  }

  /* Promise.try(立即执行并包装,同步抛错转 reject) */
  const P = Promise as unknown as Record<string, unknown>
  if (typeof P.try !== 'function') {
    P.try = function (fn: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return new Promise((resolve, reject) => {
        try {
          resolve(fn(...args))
        } catch (e) {
          reject(e)
        }
      })
    }
  }

  /* Uint8Array base64 / hex(ES2025,防御性补齐) */
  const U8 = Uint8Array as unknown as Record<string, unknown>
  if (typeof U8.fromBase64 !== 'function') {
    U8.fromBase64 = function (this: Uint8ArrayConstructor, text: string): Uint8Array {
      const clean = String(text).replace(/[\t\n\f\r ]/g, '')
      const bin = atob(clean)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    }
  }
  if (typeof U8.fromHex !== 'function') {
    U8.fromHex = function (this: Uint8ArrayConstructor, text: string): Uint8Array {
      const out = new Uint8Array(text.length / 2)
      for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16)
      return out
    }
  }
  const proto = Uint8Array.prototype as unknown as Record<string, unknown>
  if (typeof proto.toBase64 !== 'function') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    proto.toBase64 = function (this: Uint8Array): string {
      let s = ''
      for (let i = 0; i < this.length; i += 3) {
        const b0 = this[i], b1 = this[i + 1], b2 = this[i + 2]
        s += chars[b0 >> 2] + chars[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
        if (b1 === undefined) s += '=='
        else {
          s += chars[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
          if (b2 === undefined) s += '='
          else s += chars[b2 & 63]
        }
      }
      return s
    }
  }
  if (typeof proto.toHex !== 'function') {
    proto.toHex = function (this: Uint8Array): string {
      let s = ''
      for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, '0')
      return s
    }
  }
}
