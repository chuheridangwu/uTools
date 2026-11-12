/**
 * 路由配置
 * 采用 import.meta.glob 懒加载所有工具视图;路由表本体由 src/config/tools.ts
 * 的注册表自动生成,新增工具无需改这里。
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { TOOLS, TOOL_MAP } from '@/config/tools'
import { CATALOG_MAP, FULLSCREEN_APPS } from '@/config/appCatalog'
import Home from '../views/Home.vue'

/** kebab-case 工具 key → PascalCase 视图文件名,如 json-viewer → JsonViewer */
function toPascal(key: string): string {
  return key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

/** 一次性收集所有工具视图组件(懒加载,构建时按文件分包) */
const viewModules = import.meta.glob('../views/*.vue')

/** 生成每个工具的路由记录 */
const toolRoutes: RouteRecordRaw[] = TOOLS.map((t) => ({
  path: t.path,
  name: t.key,
  component: viewModules['../views/' + toPascal(t.key) + '.vue'],
  meta: { title: t.name, icon: t.icon, category: t.category, desc: t.desc },
}))

/**
 * 整页打开、但没有路由的桌面应用(FULLSCREEN_APPS 里 kind=app 的那几个,
 * 如 SVG 编辑器 / 画板)挂在 /app/<key> 下,桌面模式点击时以独立路径打开。
 */
const appViewModules = import.meta.glob('../views/apps/*.vue')
const appRoutes: RouteRecordRaw[] = [...FULLSCREEN_APPS]
  .filter((k) => CATALOG_MAP.has(k) && !TOOL_MAP.has(k))
  .map((key) => ({
    path: `/app/${key}`,
    name: key,
    component: appViewModules[`../views/apps/${toPascal(key)}.vue`],
    meta: { title: CATALOG_MAP.get(key)?.name ?? key },
  }))

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: Home, meta: { title: '首页' } }, ...toolRoutes, ...appRoutes],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
