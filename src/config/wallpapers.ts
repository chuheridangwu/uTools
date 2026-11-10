/**
 * 壁纸预设(仿找Tab 的「壁纸管理」)
 * 全部用本地 CSS 渐变 / 内联 SVG 生成,不依赖任何外部图片 CDN。
 * 分组:渐变色(加载最快) + 风景图片(高清风景插画)。
 */
export type WallpaperPreset =
  // 渐变色
  | 'purple-blue' | 'sunset' | 'pink' | 'teal' | 'dark' | 'light'
  // 风景图片
  | 'mountain' | 'ocean' | 'forest-scene' | 'starry' | 'sakura'
  // 旧版预设(保留,避免已有用户的配置失效)
  | 'aurora' | 'dawn' | 'mist' | 'forest' | 'violet'
  | 'custom'

export interface WallpaperMeta {
  id: Exclude<WallpaperPreset, 'custom'>
  name: string
  type: 'gradient' | 'image'
  css: string
}

function svgBg(svg: string): string {
  return `center / cover no-repeat url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const svg = {
  mountain: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset=".55" stop-color="#60a5fa"/><stop offset="1" stop-color="#fde68a"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#s)"/><circle cx="1180" cy="290" r="88" fill="#fff3c4" opacity=".8"/><path d="M0 760 280 420 520 700 820 360 1120 700 1360 480 1600 760 1600 1000 0 1000Z" fill="url(#m)" opacity=".92"/><path d="M0 860 260 700 560 860 900 660 1240 880 1600 720 1600 1000 0 1000Z" fill="#0f172a" opacity=".72"/><path d="M0 700Q400 655 800 710T1600 685 1600 780Q1200 750 800 780T0 770Z" fill="#fff" opacity=".22"/></svg>`,
  ocean: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset=".45" stop-color="#fda4af"/><stop offset=".55" stop-color="#fbbf24"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#s)"/><circle cx="800" cy="520" r="110" fill="#fff7ed" opacity=".9"/><rect y="550" width="1600" height="450" fill="#0c4a6e" opacity=".55"/><path d="M0 620Q400 600 800 625T1600 610M0 700Q400 680 800 705T1600 690M0 790Q400 770 800 795T1600 780" stroke="#fff" stroke-width="5" fill="none" opacity=".28"/><path d="M0 900Q400 880 800 905T1600 890" stroke="#fff" stroke-width="8" fill="none" opacity=".18"/></svg>`,
  forestScene: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset=".6" stop-color="#4ade80"/><stop offset="1" stop-color="#052e16"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#s)"/><circle cx="380" cy="230" r="120" fill="#fef9c3" opacity=".35"/><g fill="#052e16" opacity=".55"><path d="M120 1000V420l90 180 90-180v580Z"/><path d="M420 1000V330l120 210 120-210v670Z"/><path d="M800 1000V450l100 190 100-190v550Z"/><path d="M1120 1000V360l130 220 130-220v640Z"/></g><path d="M0 620Q400 590 800 625T1600 605V720Q1200 690 800 720T0 710Z" fill="#fff" opacity=".12"/></svg>`,
  starry: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617"/><stop offset=".6" stop-color="#312e81"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#s)"/><g fill="#fff"><circle cx="120" cy="120" r="2"/><circle cx="320" cy="220" r="1.6"/><circle cx="520" cy="90" r="2.4"/><circle cx="700" cy="260" r="1.4"/><circle cx="900" cy="140" r="2.2"/><circle cx="1120" cy="80" r="1.8"/><circle cx="1320" cy="230" r="2.6"/><circle cx="1480" cy="130" r="1.6"/><circle cx="220" cy="400" r="1.5"/><circle cx="620" cy="380" r="2"/><circle cx="1020" cy="420" r="1.7"/><circle cx="1400" cy="360" r="2.3"/><circle cx="80" cy="280" r="1.3"/><circle cx="1240" cy="300" r="1.5"/></g><circle cx="1240" cy="200" r="70" fill="#e0e7ff" opacity=".82"/><path d="M0 800 260 640 520 790 820 600 1120 780 1380 660 1600 800 1600 1000 0 1000Z" fill="#0f172a"/></svg>`,
  sakura: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fce7f3"/><stop offset=".55" stop-color="#fbcfe8"/><stop offset="1" stop-color="#f9a8d4"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#s)"/><circle cx="340" cy="220" r="100" fill="#fff" opacity=".45"/><path d="M0 820Q300 740 620 810T1200 780T1600 820V1000H0Z" fill="#f472b6" opacity=".35"/><path d="M0 900Q400 850 800 900T1600 880V1000H0Z" fill="#db2777" opacity=".28"/><g fill="#fff" opacity=".55"><circle cx="180" cy="360" r="9"/><circle cx="460" cy="180" r="7"/><circle cx="720" cy="420" r="10"/><circle cx="980" cy="240" r="8"/><circle cx="1240" cy="430" r="9"/><circle cx="1480" cy="300" r="7"/><circle cx="300" cy="620" r="8"/><circle cx="900" cy="600" r="7"/></g></svg>`,
}

/** id → CSS background,兼容旧代码里 WALLPAPERS[key] 的用法 */
export const WALLPAPERS: Record<Exclude<WallpaperPreset, 'custom'>, string> = {
  'purple-blue': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  sunset: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 48%, #f6d365 100%)',
  pink: 'linear-gradient(135deg, #fbc2eb 0%, #a18cd1 100%)',
  teal: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  dark: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0b1120 100%)',
  light: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  mountain: svgBg(svg.mountain),
  ocean: svgBg(svg.ocean),
  'forest-scene': svgBg(svg.forestScene),
  starry: svgBg(svg.starry),
  sakura: svgBg(svg.sakura),
  // 旧版
  aurora: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #312e81 100%)',
  dawn: 'linear-gradient(135deg, #fda085 0%, #f6d365 55%, #a8edea 100%)',
  mist: 'linear-gradient(180deg, #e0f2fe 0%, #93c5fd 60%, #bfdbfe 100%)',
  forest: 'linear-gradient(135deg, #022c22 0%, #065f46 55%, #0a4d3a 100%)',
  violet: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)',
}

/** 设置页展示用的分组列表 */
export const WALLPAPER_GROUPS: {
  key: 'gradient' | 'image'
  label: string
  desc: string
  items: WallpaperMeta[]
}[] = [
  {
    key: 'gradient',
    label: '渐变色',
    desc: '纯色渐变,加载最快',
    items: [
      { id: 'purple-blue', name: '梦幻紫蓝', type: 'gradient', css: WALLPAPERS['purple-blue'] },
      { id: 'sunset', name: '落日晚霞', type: 'gradient', css: WALLPAPERS.sunset },
      { id: 'pink', name: '粉色浪漫', type: 'gradient', css: WALLPAPERS.pink },
      { id: 'teal', name: '清新绿意', type: 'gradient', css: WALLPAPERS.teal },
      { id: 'dark', name: '深色壁纸', type: 'gradient', css: WALLPAPERS.dark },
      { id: 'light', name: '浅色壁纸', type: 'gradient', css: WALLPAPERS.light },
    ],
  },
  {
    key: 'image',
    label: '风景图片',
    desc: '内置 SVG 风景插画,无需联网',
    items: [
      { id: 'mountain', name: '山脉云海', type: 'image', css: WALLPAPERS.mountain },
      { id: 'ocean', name: '海岸日落', type: 'image', css: WALLPAPERS.ocean },
      { id: 'forest-scene', name: '晨雾森林', type: 'image', css: WALLPAPERS['forest-scene'] },
      { id: 'starry', name: '星空夜色', type: 'image', css: WALLPAPERS.starry },
      { id: 'sakura', name: '樱花粉霞', type: 'image', css: WALLPAPERS.sakura },
    ],
  },
]

/** 浅色壁纸需要切换成深色文字 */
export const LIGHT_WALLPAPERS = new Set<WallpaperPreset>(['light', 'mist', 'sunset', 'pink', 'sakura', 'teal'])

/** 取当前壁纸的 CSS background */
export function wallpaperCss(preset: WallpaperPreset, custom?: string): string {
  if (preset === 'custom' && custom) return `center / cover no-repeat url("${custom}")`
  return WALLPAPERS[preset as Exclude<WallpaperPreset, 'custom'>] ?? WALLPAPERS['purple-blue']
}
