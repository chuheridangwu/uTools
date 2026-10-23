/**
 * 路由配置
 * 采用 import.meta.glob 懒加载所有工具视图;路由表本体由 src/config/tools.ts
 * 的注册表自动生成,新增工具无需改这里。
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { TOOLS } from '@/config/tools'
import Home from '../views/Home.vue'

/** kebab-case 工具 key → PascalCase 视图文件名,如 json-viewer → JsonViewer */
function toViewFile(key: string): string {
  const pascal = key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return '../views/' + pascal + '.vue'
}

/** 一次性收集所有工具视图组件(懒加载,构建时按文件分包) */
const viewModules = import.meta.glob('../views/*.vue')

/** 生成每个工具的路由记录 */
const toolRoutes: RouteRecordRaw[] = TOOLS.map((t) => ({
  path: t.path,
  name: t.key,
  component: viewModules[toViewFile(t.key)],
  meta: { title: t.name, icon: t.icon, category: t.category, desc: t.desc },
}))

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: Home, meta: { title: '首页' } }, ...toolRoutes],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
