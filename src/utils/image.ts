/**
 * Canvas / 图片通用操作:
 * 加载图片、按参数绘制到画布、画布转 Blob 等。
 * 所有图片类工具(转换/批量/水印/拼接/GIF/EXIF缩略)共用,保证行为一致。
 */
import { baseName } from './common'

/** 把 File(data URL)加载为可绘制的 HTMLImageElement */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败,可能是不受支持的格式'))
    }
    img.src = url
  })
}

/** 缩放后的目标宽高:按模式(mode=percent 百分比 / width 定宽 / height 定高)计算,始终保留比例 */
export function calcTargetSize(
  srcW: number,
  srcH: number,
  opts: { mode: 'none' | 'percent' | 'width' | 'height'; percent?: number; width?: number; height?: number },
): { width: number; height: number } {
  if (opts.mode === 'percent') {
    const p = Math.max(1, Math.min(400, opts.percent ?? 100)) / 100
    return { width: Math.max(1, Math.round(srcW * p)), height: Math.max(1, Math.round(srcH * p)) }
  }
  if (opts.mode === 'width') {
    const w = Math.max(1, opts.width ?? srcW)
    return { width: w, height: Math.max(1, Math.round((srcH / srcW) * w)) }
  }
  if (opts.mode === 'height') {
    const h = Math.max(1, opts.height ?? srcH)
    return { width: Math.max(1, Math.round((srcW / srcH) * h)), height: h }
  }
  return { width: srcW, height: srcH }
}

/** 把 HTMLImageElement 绘制到指定尺寸的画布,返回画布 */
export function drawImageTo(
  img: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
  background?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // JPEG 等不带透明度的格式需要白色底,也允许调用方指定背景色
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

/** 画布导出为目标格式的 Blob */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画布导出失败'))),
      type,
      quality,
    )
  })
}

/** 依据目标格式(mime)推导导出文件名,如 /tmp/a.png + image/webp → a.webp */
export function renameWithExt(name: string, mime: string): string {
  const ext =
    mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'bin'
  return `${baseName(name)}.${ext}`
}
