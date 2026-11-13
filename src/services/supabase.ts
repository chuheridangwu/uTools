/**
 * Supabase 客户端(云同步 P1)
 * 动态 import,让 supabase-js(~110KB / gzip 30KB)独立分包、不进首屏;
 * 未配置 .env 时返回 null,站点完全等价于纯本地模式(离线优先的降级路径)。
 */
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let loading: Promise<SupabaseClient | null> | null = null

/** .env 是否配置了 Supabase(值来自 import.meta.env,构建时注入) */
export function supabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/** 获取客户端;未配置或加载失败返回 null(调用方按纯本地模式处理) */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (client) return client
  if (!supabaseConfigured()) return null
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        client = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
        )
        return client
      })
      .catch((e) => {
        console.warn('[sync] Supabase 加载失败,使用本地模式:', e)
        return null
      })
  }
  return loading
}
