/**
 * 通用工具函数:复制 / 下载 / 存储 / 格式化
 * 所有页面共用,避免重复实现。
 */

/** 复制文本到剪贴板,失败时回退到隐藏 textarea 方案(兼容 http 环境) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** 通过 Blob + a[download] 保存文件(浏览器本地导出统一入口;也支持直接传普通文本) */
export function downloadBlob(blob: Blob | string, filename: string): void {
  const target = typeof blob === 'string' ? new Blob([blob], { type: 'text/plain;charset=utf-8' }) : blob
  const url = URL.createObjectURL(target)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 释放对象 URL,避免内存泄漏
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 按文本内容保存为文件 */
export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

/** 本地存储封装:JSON 序列化 + 异常兜底(Key 前缀 utools_ 集中管理) */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('utools_' + key)
      if (raw === null) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem('utools_' + key, JSON.stringify(value))
    } catch {
      /* 存储已满或隐私模式下静默失败 */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem('utools_' + key)
    } catch {
      /* ignore */
    }
  },
}

/** 文件大小格式化:自动选取 B/KB/MB/GB */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** formatSize 的别名(部分视图以 formatBytes 命名调用) */
export const formatBytes = formatSize

/** 从 File 对象取出纯文件名(不含扩展名),用于拼装导出文件名 */
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 数字补零 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 把任意坐标/文本安全的数字字符串转为数字,失败返回 null */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
