/**
 * 拼图几何与导出渲染
 * 全部在「设计坐标」里计算(基准宽 DESIGN_BASE),再按 scale 放大到预览 / 导出尺寸,
 * 保证预览与下载结果完全一致。零依赖,全部本地完成。
 */

/** 设计基准宽度:边框 / 间距 / 圆角 / 水印字号都以此为参照(与「好拼」的 460px 画布一致) */
export const DESIGN_BASE = 460

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface CellSpan {
  w: number
  h: number
}

export interface Border {
  t: number
  r: number
  b: number
  l: number
}

export interface WatermarkOptions {
  text: string
  /** 字号(设计 px) */
  size: number
  opacity: number
  /** 旋转角度,单位度 */
  rotate: number
  density: 'low' | 'medium' | 'high'
  /** none = 平铺;其余为单点位置 */
  anchor: 'none' | 'tl' | 'tr' | 'c' | 'bl' | 'br'
}

export interface CellDraw {
  /** 设计坐标下的单元格矩形 */
  rect: Rect
  img: HTMLImageElement | null
  /** 平移:-1 ~ 1,按可用溢出量归一化 */
  ox: number
  oy: number
  /** 缩放:>= 1 */
  zoom: number
}

export interface RenderOptions {
  width: number
  height: number
  base: number
  radius: number
  bgColor: string
  bgImage: HTMLImageElement | null
  cells: CellDraw[]
  watermark: WatermarkOptions | null
}

/** 设计画布高度(按比例) */
export function designHeight(base: number, ratioW: number, ratioH: number): number {
  return (base * ratioH) / ratioW
}

/**
 * 按 CSS Grid 的「行优先 + 稀疏」规则把 span 列表排成矩形。
 * 与浏览器自动排布一致(模板均为 span-only,没有显式起点)。
 */
export function computeRects(
  cols: number,
  rows: number,
  spans: CellSpan[],
  box: Rect,
  spacing: number,
): Rect[] {
  const colW = (box.w - spacing * (cols - 1)) / cols
  const rowH = (box.h - spacing * (rows - 1)) / rows
  const occ: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))
  const out: Rect[] = []
  let curR = 0
  let curC = 0

  for (const span of spans) {
    const sw = Math.max(1, Math.min(span.w, cols))
    const sh = Math.max(1, Math.min(span.h, rows))
    let placed = false
    let guard = 0
    while (!placed && guard++ < cols * rows * 4) {
      if (curC + sw > cols) {
        curR += 1
        curC = 0
        continue
      }
      if (curR >= rows) break
      let free = true
      for (let y = curR; y < curR + sh && free; y += 1) {
        for (let x = curC; x < curC + sw; x += 1) {
          if (y >= rows || occ[y][x]) {
            free = false
            break
          }
        }
      }
      if (free) {
        for (let y = curR; y < curR + sh; y += 1) {
          for (let x = curC; x < curC + sw; x += 1) occ[y][x] = true
        }
        out.push({
          x: box.x + curC * (colW + spacing),
          y: box.y + curR * (rowH + spacing),
          w: colW * sw + spacing * (sw - 1),
          h: rowH * sh + spacing * (sh - 1),
        })
        curC += sw
        placed = true
      } else {
        curC += 1
      }
    }
    // 兜底:模板格子数超过网格容量时,叠在最后一个可放位置
    if (!placed) out.push({ x: box.x, y: box.y, w: colW, h: rowH })
  }
  return out
}

/** 设计坐标 → 目标像素 */
export function scaleRect(r: Rect, s: number): Rect {
  return { x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s }
}

/** 图片按 cover 铺满目标矩形,并按 ox/oy 平移、zoom 缩放 */
export function coverRect(
  imgW: number,
  imgH: number,
  target: Rect,
  ox: number,
  oy: number,
  zoom: number,
): Rect {
  if (!imgW || !imgH) return { ...target }
  const scale = Math.max(target.w / imgW, target.h / imgH) * Math.max(1, zoom)
  const w = imgW * scale
  const h = imgH * scale
  // 可平移的溢出量:缩放后超出目标框的部分
  const overflowX = Math.max(0, w - target.w)
  const overflowY = Math.max(0, h - target.h)
  const x = target.x + (target.w - w) / 2 + (ox * overflowX) / 2
  const y = target.y + (target.h - h) / 2 + (oy * overflowY) / 2
  return { x, y, w, h }
}

/** 圆角矩形路径(兼容不支持 ctx.roundRect 的环境) */
export function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2))
  ctx.beginPath()
  if (rr <= 0) {
    ctx.rect(r.x, r.y, r.w, r.h)
    return
  }
  ctx.moveTo(r.x + rr, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr)
  ctx.closePath()
}

/** 水印:黑色文字,alpha = 透明度;anchor=none 时按密度平铺 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  wm: WatermarkOptions,
  scale: number,
): void {
  const text = wm.text.trim()
  if (!text) return
  const fontSize = Math.max(4, wm.size * scale)
  ctx.save()
  ctx.globalAlpha = Math.max(0.01, Math.min(1, wm.opacity))
  ctx.fillStyle = '#000000'
  ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const angle = (wm.rotate * Math.PI) / 180

  const stamp = (x: number, y: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  if (wm.anchor !== 'none') {
    const pad = fontSize * 1.2
    const w = ctx.measureText(text).width
    const half = Math.abs(Math.cos(angle)) * (w / 2) + Math.abs(Math.sin(angle)) * (fontSize / 2)
    const halfV = Math.abs(Math.sin(angle)) * (w / 2) + Math.abs(Math.cos(angle)) * (fontSize / 2)
    const clampX = (x: number) => Math.max(half + 2, Math.min(size.w - half - 2, x))
    const clampY = (y: number) => Math.max(halfV + 2, Math.min(size.h - halfV - 2, y))
    const spot: Record<string, [number, number]> = {
      tl: [pad + w / 2, pad],
      tr: [size.w - pad - w / 2, pad],
      c: [size.w / 2, size.h / 2],
      bl: [pad + w / 2, size.h - pad],
      br: [size.w - pad - w / 2, size.h - pad],
    }
    const [x, y] = spot[wm.anchor]
    stamp(clampX(x), clampY(y))
  } else {
    const factor = wm.density === 'low' ? 8 : wm.density === 'medium' ? 5 : 3
    const stepX = fontSize * factor
    const stepY = stepX * 0.92
    const cols = Math.ceil(size.w / stepX) + 2
    const rows = Math.ceil(size.h / stepY) + 2
    for (let r = -1; r < rows; r += 1) {
      for (let c = -1; c < cols; c += 1) {
        stamp(c * stepX + stepX / 2, r * stepY + stepY / 2)
      }
    }
  }
  ctx.restore()
}

/** 铺满绘制(等比裁剪,类似 CSS background-size: cover) */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
): void {
  const r = coverRect(img.naturalWidth, img.naturalHeight, { x: 0, y: 0, w, h }, 0, 0, 1)
  ctx.drawImage(img, r.x, r.y, r.w, r.h)
}

/** 渲染出成品画布(导出用) */
export function renderCollage(opt: RenderOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(opt.width))
  canvas.height = Math.max(1, Math.round(opt.height))
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / opt.base

  if (opt.bgImage) {
    drawCover(ctx, opt.bgImage, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = opt.bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  for (const cell of opt.cells) {
    const target = scaleRect(cell.rect, s)
    ctx.save()
    roundRectPath(ctx, target, opt.radius * s)
    ctx.clip()
    if (cell.img) {
      const r = coverRect(cell.img.naturalWidth, cell.img.naturalHeight, target, cell.ox, cell.oy, cell.zoom)
      ctx.drawImage(cell.img, r.x, r.y, r.w, r.h)
    }
    ctx.restore()
  }

  if (opt.watermark) {
    drawWatermark(ctx, { w: canvas.width, h: canvas.height }, opt.watermark, s)
  }
  return canvas
}
