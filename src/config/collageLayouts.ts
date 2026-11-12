/**
 * 拼图布局模板表
 * 数据取自「好拼」(img.ops-coffee.com/photo/)的布局库,共 135 个模板。
 * 编码格式:`id:cols:rows:cellspans`,其中 cellspans 为 `列span x 行span`,逗号分隔,
 * 模板之间用 `|` 分隔 —— 与 CSS Grid 的自动排布(span-only,无显式起点)一一对应。
 */

export interface CellSpan {
  /** 横向跨列数 */
  w: number
  /** 纵向跨行数 */
  h: number
}

export interface CollageLayout {
  id: string
  cols: number
  rows: number
  /** 单元格跨度,顺序即图片填充顺序 */
  cells: CellSpan[]
  /** 该模板可放几张图 */
  count: number
}

const RAW =
  '1-full:1:1:1x1|2-t1b1:1:2:1x1,1x1|2-l1r1:2:1:1x1,1x1|3-31:3:3:1x3,1x3,1x3|3-13:3:3:3x1,3x1,3x1|3-t1b2:2:2:2x1,1x1,1x1|3-t2b1:2:2:1x1,1x1,2x1|3-l1r2:2:2:1x2,1x1,1x1|3-l2r1:2:2:1x1,1x2,1x1|3-l1rr:3:3:2x3,1x1,1x2|3-t1bb:3:3:3x2,1x1,2x1|4-grid:2:2:1x1,1x1,1x1,1x1|4-41:4:4:1x4,1x4,1x4,1x4|4-14:4:4:4x1,4x1,4x1,4x1|4-t1b3:3:2:3x1,1x1,1x1,1x1|4-b1t3:3:2:1x1,1x1,1x1,3x1|4-l1r3:2:3:1x3,1x1,1x1,1x1|4-l-feat:3:2:1x2,2x1,1x1,1x1|4-r-feat:3:2:2x1,1x2,1x1,1x1|4-121:2:3:2x1,1x1,1x1,2x1|4-212:3:2:1x2,1x1,1x2,1x1|4-g3x2-alt:2:3:1x2,1x1,1x1,1x1|5-center:3:3:2x1,1x2,1x2,1x1,2x1|5-l3r2:3:3:1x1,2x1,1x1,2x2,1x1|5-131:3:3:1x3,1x1,1x3,1x1,1x1|5-l2r3:2:3:1x2,1x1,1x1,1x1,1x1|5-t2b3:3:2:2x1,1x1,1x1,1x1,1x1|5-center-h-bar:2:3:1x1,1x1,1x1,1x1,1x1|5-t2b3-split:6:2:3x1,3x1,2x1,2x1,2x1|5-l1r4-col:2:4:1x4,1x1,1x1,1x1,1x1|5-t-feat-r:3:2:1x1,2x1,1x1,1x1,1x1|5-t1b4-grid:2:3:2x1,1x1,1x1,1x1,1x1|5-r1l4-col:2:4:1x1,1x1,1x1,1x1,1x1|5-cross-center:3:3:3x1,1x1,1x1,1x1,3x1|5-l-tall-r-split:3:3:1x3,2x1,1x1,1x1,1x1|6-g3x2:2:3:1x1,1x1,1x1,1x1,1x1,1x1|6-g2x3:3:2:1x1,1x1,1x1,1x1,1x1,1x1|6-center:4:4:3x1,1x2,1x3,2x2,1x2,2x1|6-123:6:3:6x1,3x1,3x1,2x1,2x1,2x1|6-321:6:3:2x1,2x1,2x1,3x1,3x1,6x1|6-231:6:3:3x1,3x1,2x1,2x1,2x1,6x1|6-222:3:3:2x1,1x1,1x1,2x1,2x1,1x1|6-1133:3:4:3x2,1x1,1x1,1x2,1x1,1x1|6-223r:3:3:2x2,1x1,1x1,1x1,1x1,1x1|6-223l:3:3:1x1,2x2,1x1,1x1,1x1,1x1|6-114:5:3:5x2,1x1,1x1,1x1,1x1,1x1|6-3333:4:4:2x2,1x2,1x2,1x2,1x2,2x2|7-main:4:4:2x2,2x2,2x2,1x1,1x1,1x1,1x1|7-h-center-band:3:3:1x1,1x1,1x1,3x1,1x1,1x1,1x1|7-w-center-band:3:3:1x1,1x3,1x1,1x1,1x1,1x1,1x1|7-feat-l:2:4:1x2,1x1,1x1,1x1,1x1,1x1,1x1|7-feat-t:2:4:1x1,1x1,1x1,1x1,1x1,1x2,1x1|7-311:3:3:3x1,1x1,1x1,1x1,1x1,1x1,1x1|7-113:3:3:1x1,1x1,1x1,1x1,1x1,1x1,3x1|7-232:6:3:3x1,3x1,2x1,2x1,2x1,3x1,3x1|7-124:4:3:3x2,1x1,1x1,1x1,1x1,1x1,1x1|7-323:4:3:1x1,3x2,1x1,1x1,1x1,1x1,1x1|7-313:3:4:1x1,1x1,1x1,2x3,1x1,1x1,1x1|7-331:4:3:1x1,1x1,1x1,1x1,3x2,1x1,1x1|7-233:6:4:3x2,3x2,2x1,2x2,2x1,2x1,2x1|7-333:3:3:1x1,2x1,1x1,1x1,1x1,1x1,2x1|7-346:6:4:2x1,2x2,2x2,2x1,3x2,3x1,3x1|7-121:12:12:5x3,7x4,5x3,7x4,5x3,7x4,5x3|8-g4x2:2:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|8-g2x4:4:2:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|8-222:4:4:2x1,1x2,1x2,2x1,1x2,1x2,2x1,2x1|8-l2-tall-r6-grid:4:3:1x3,1x1,1x1,1x3,1x1,1x1,1x1,1x1|8-sandwich-6:3:4:3x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|8-313:4:5:2x2,2x2,1x1,1x1,1x1,1x1,2x2,2x2|8-131:5:4:2x2,1x1,2x2,1x1,2x2,1x1,2x2,1x1|8-134:4:4:3x3,1x1,1x1,1x1,1x1,1x1,1x1,1x1|8-431:4:4:1x1,1x1,1x1,1x1,1x1,3x3,1x1,1x1|8-323:6:3:2x1,2x1,2x1,3x1,3x1,2x1,2x1,2x1|8-363:3:6:1x2,1x3,1x2,1x2,1x2,1x3,1x2,1x2|8-344:4:4:1x1,1x2,2x2,1x1,2x2,1x2,1x1,1x1|9-grid:3:3:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|9-144-grid:4:3:4x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|9-414-grid:4:3:1x1,1x1,1x1,1x1,4x1,1x1,1x1,1x1,1x1|9-441-grid:4:3:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,4x1|9-211-grid:4:3:2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|9-112-grid:4:3:1x1,1x1,1x1,1x1,1x1,1x1,2x2,1x1,1x1|9-334-grid:4:3:1x1,2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1|9-434-grid:4:4:1x1,2x4,1x1,1x1,1x1,1x1,1x1,1x1,1x1|9-344-grid:4:4:1x1,1x1,1x1,1x1,4x2,1x1,1x1,1x1,1x1|9-424-grid:4:4:2x2,1x2,1x2,2x1,1x1,1x1,2x1,1x1,1x1|9-116-grid:6:6:3x3,3x3,3x3,2x2,1x1,1x1,1x1,1x1,1x1|9-611-grid:6:6:2x2,1x1,3x3,1x1,1x1,1x1,1x1,3x3,3x3|9-cen-grid:4:4:2x1,2x1,1x2,2x2,1x2,1x1,1x1,1x1,1x1|9-quad-fill-grid:4:4:2x2,1x2,1x2,2x1,2x1,1x1,1x1,1x1,1x1|9-mid-strip-grid:4:4:2x2,2x1,2x1,1x2,1x2,1x1,1x1,1x1,1x1|10-g5x2:2:5:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|10-t2b8-grid:4:3:2x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|10-424-grid:4:3:1x1,1x1,1x1,1x1,2x1,2x1,1x1,1x1,1x1,1x1|10-4x3-grid:3:4:3x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|10-5x5-grid:5:5:4x4,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|10-4x4-grid:4:4:2x2,1x1,1x1,1x1,1x1,1x1,1x1,2x2,1x1,1x1|10-8x8-grid:8:8:4x4,4x4,4x4,2x2,2x2,2x2,1x1,1x1,1x1,1x1|10-442-grid:4:4:1x1,1x1,1x1,1x1,2x2,2x2,1x1,1x1,1x1,1x1|10-6x6-grid:6:6:2x2,2x2,2x2,2x2,2x1,2x2,2x1,2x2,2x2,2x2|11-4c4-t:4:4:1x1,1x1,1x1,1x1,1x2,2x2,1x2,1x1,1x1,1x1,1x1|11-4x4-t:4:4:1x1,2x1,1x1,1x1,2x2,1x1,1x1,1x1,1x1,2x1,1x1|11-4x6-t:6:4:3x1,3x1,2x1,2x1,2x1,2x1,2x1,2x1,2x1,2x1,2x1|11-feat-t:5:3:5x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|11-feat-c:5:3:1x1,1x1,1x1,1x1,1x1,5x1,1x1,1x1,1x1,1x1,1x1|11-feat-f:5:3:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,5x1|12-g4x3:3:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|12-g3x4:4:3:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|12-top-bottom:4:6:4x1,4x1,2x1,2x1,2x1,2x1,1x1,1x1,1x1,1x1,2x1,2x1|12-center-focus:4:4:1x1,2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1|12-quad-emphasis:4:4:2x1,2x1,1x1,1x1,2x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1|12-trio-emphasis:4:4:2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1|13-feat-c:4:4:1x1,1x1,1x1,1x1,1x1,2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1|13-211:4:4:2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|13-112:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x2,1x1,1x1|13-left-right:4:5:1x5,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1,3x1|13-tri-center:4:5:2x2,2x2,2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|13-grid-varied:4:4:2x1,1x1,1x1,1x2,1x1,1x1,1x1,1x1,1x1,1x2,1x1,1x1,1x1|13-tall-center:4:5:2x4,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|13-horizon:4:5:1x1,1x1,1x1,1x1,4x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|14-g7x2:2:7:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|14-g4x4r:4:4:1x1,1x1,1x1,1x1,1x1,2x1,1x1,1x1,2x1,1x1,1x1,1x1,1x1,1x1|14-g4x4c:4:4:1x1,1x1,1x1,1x1,1x1,1x2,1x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1|14-quad-feature:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,3x1|14-vertical-emphasis:4:4:1x2,1x1,1x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|14-cross-center:4:4:2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1,1x1|14-triple-row:4:6:4x2,2x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1,1x1|15-g5x3:3:5:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|15-g4x4c:4:4:1x1,1x1,1x1,1x1,1x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|15-g4x4f:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1|15-triple-focus:4:5:2x1,2x1,1x1,1x1,2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|15-center-emphasis:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1|15-wide-landscape:6:3:2x1,2x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|15-cluster-center:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,2x1,1x1,1x1,1x1,1x1,1x1,1x1|15-mixed-frames:4:5:2x1,2x1,1x1,1x1,2x2,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1|16-g4x4:4:4:1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1,1x1'

/** 解析后的布局表(id 唯一,单元格数 = 图片数) */
export const COLLAGE_LAYOUTS: CollageLayout[] = RAW.split('|').map((item) => {
  const [id, cols, rows, cells] = item.split(':')
  const spans = cells.split(',').map((s) => {
    const [w, h] = s.split('x').map(Number)
    return { w, h }
  })
  return { id, cols: Number(cols), rows: Number(rows), cells: spans, count: spans.length }
})

export const COLLAGE_LAYOUT_MAP: Map<string, CollageLayout> = new Map(
  COLLAGE_LAYOUTS.map((l) => [l.id, l]),
)

/** 按图片数分组(1–16),用于左侧「布局选择」的分段筛选 */
export const LAYOUT_BY_COUNT: Map<number, CollageLayout[]> = (() => {
  const m = new Map<number, CollageLayout[]>()
  for (const l of COLLAGE_LAYOUTS) {
    const arr = m.get(l.count) ?? []
    arr.push(l)
    m.set(l.count, arr)
  }
  return m
})()

/** 可选的图片数量分组(升序) */
export const LAYOUT_COUNTS: number[] = [...LAYOUT_BY_COUNT.keys()].sort((a, b) => a - b)

/**
 * 长图模式:把 N 张图按顺序排成一条。
 * 竖向 = N 行 1 列;横向 = 1 行 N 列。
 */
export function stitchLayout(count: number, direction: 'vertical' | 'horizontal'): CollageLayout {
  const n = Math.max(1, count)
  const cells = Array.from({ length: n }, () => ({ w: 1, h: 1 }))
  return direction === 'vertical'
    ? { id: 'stitch-v', cols: 1, rows: n, cells, count: n }
    : { id: 'stitch-h', cols: n, rows: 1, cells, count: n }
}
