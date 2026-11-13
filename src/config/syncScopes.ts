/**
 * 云同步范围声明(P1)
 * scope = Supabase app_state.scope;lsKey = localStorage 键(storage 封装会加 utools_ 前缀,
 * 但应用各自直接读写 localStorage 的键如 utools_todo 用完整键名)。
 * ★ 新应用接入同步:在这里加一行即可,数据库零改动。
 * 敏感数据(TOTP 密钥等)按约定默认不同步,后续要做需先加密。
 */
export interface SyncScopeDef {
  /** Supabase 表里的 scope 标识,一旦上线不可改名(改名等于新数据集) */
  scope: string
  /** localStorage 完整键名(含 utools_ 前缀) */
  lsKey: string
  /** 设置页展示名 */
  label: string
}

export const SYNC_SCOPES: SyncScopeDef[] = [
  { scope: 'desktop-state', lsKey: 'utools_desktop-state', label: '桌面布局与偏好' },
  { scope: 'todo', lsKey: 'utools_todo', label: '待办清单' },
  { scope: 'sticky-notes', lsKey: 'utools_stickynotes', label: '便签墙' },
  { scope: 'expense', lsKey: 'utools_expense', label: '记账本' },
]

export const SYNC_SCOPES_MAP = new Map(SYNC_SCOPES.map((s) => [s.scope, s]))
