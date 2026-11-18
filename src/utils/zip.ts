/**
 * 纯前端 ZIP 工具(零第三方依赖)
 *  - buildZip:打包(store / 不压缩模式,零依赖),从「在线解压」应用抽出共享,
 *    PDF 转图片等多文件导出场景复用
 *  - readZip:读取/解压(依赖浏览器原生 DecompressionStream),用于提取
 *    Office 文件内部的嵌入资源(如 WPS xls 的 ETCellImageData 图片流)
 */

/** CRC32 表(标准 ZIP 多项式 0xEDB88320) */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** 条目名,支持中文(自动置 UTF-8 标志) */
  name: string
  /** 文件内容 */
  data: Uint8Array
}

/** 把多个文件打成一个 ZIP Blob(store 模式,兼容中文文件名) */
export function buildZip(list: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff
  let offset = 0

  for (const f of list) {
    const data = f.data
    if (!data) continue
    const nameBytes = enc.encode(f.name)
    const crc = crc32(data)

    const lh = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    lh.set(nameBytes, 30)

    const ch = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    ch.set(nameBytes, 46)

    local.push(lh, data)
    central.push(ch)
    offset += lh.length + data.length
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, list.length, true)
  ev.setUint16(10, list.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...local, ...central, eocd] as BlobPart[], { type: 'application/zip' })
}

/** 触发浏览器下载一个 Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// ────────────────────────── ZIP 读取(解压) ──────────────────────────

/** 解压单个 deflate-raw 数据块(依赖浏览器原生 DecompressionStream,Chrome 103+ / Safari 16.4+) */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const out = await new Response(stream).arrayBuffer()
  return new Uint8Array(out)
}

/**
 * 读取 ZIP 全部条目(条目名 → 数据)。
 * 用于解析 Office 文件内部的嵌入资源:.xlsx 本身(xl/media 图片)、
 * WPS xls 私有 OLE 流 ETCellImageData(内容也是 ZIP)等。
 */
export async function readZip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const u8 = new Uint8Array(buf)
  const view = new DataView(buf)

  // 从尾部找 EOCD(0x06054b50):注释最长 65535
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP 数据(未找到 EOCD)')

  const count = view.getUint16(eocd + 10, true)
  let cdOffset = view.getUint32(eocd + 16, true)

  // 兼容 ZIP64:EOCD 前有 ZIP64 EOCD Locator(0x07064b50)时改用其中央目录偏移
  if (cdOffset === 0xffffffff || count === 0xffff) {
    const z64 = eocd - 20
    if (z64 >= 0 && view.getUint32(z64, true) === 0x07064b50) {
      cdOffset = Number(view.getBigUint64(z64 + 8, true))
    }
  }

  const entries = new Map<string, Uint8Array>()
  let p = cdOffset
  for (let n = 0; n < count && p + 46 <= u8.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break // 中央目录文件头
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOff = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(u8.slice(p + 46, p + 46 + nameLen))

    // 本地文件头中的文件名/扩展字段长度可能与中央目录不同,数据起始按本地头算
    const lNameLen = view.getUint16(localOff + 26, true)
    const lExtraLen = view.getUint16(localOff + 28, true)
    const dataStart = localOff + 30 + lNameLen + lExtraLen

    if (!name.endsWith('/')) {
      const raw = u8.slice(dataStart, dataStart + compSize)
      if (method === 0) {
        entries.set(name, raw) // store 不压缩
      } else if (method === 8) {
        entries.set(name, await inflateRaw(raw)) // deflate
      }
      // 其他压缩方法(加密/罕见)忽略
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}
