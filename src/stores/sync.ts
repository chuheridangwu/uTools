/**
 * 云同步引擎(P1,离线优先)
 * - localStorage 是运行时唯一数据源;Supabase app_state 表只做云端备份/多端同步
 * - 应用写 localStorage 时派发自定义事件(见 utils/common.ts storage.set),本 store 监听后
 *   把 scope 入队,防抖 2s 推送;登录/启动时全量拉取
 * - 冲突:同 scope 按 updated_at 最后写入胜(LWW);删除走软删除墓碑,避免删了又被推回
 * - 离线:待推队列持久化在本机,联网/登录后自动补推
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSupabase, supabaseConfigured } from '@/services/supabase'
import { SYNC_SCOPES, SYNC_SCOPES_MAP } from '@/config/syncScopes'
import { storage } from '@/utils/common'

/** 应用写入 localStorage 后派发的事件名(utils/common.ts 同步派发) */
export const LS_MUTATED_EVENT = 'utools:ls-mutated'

/** 云端行结构(app_state) */
interface AppStateRow {
  scope: string
  data: unknown
  schema_version: number
  updated_at: string
  deleted: boolean
}

/** 防抖推送定时器 */
const timers = new Map<string, number>()
/** 防抖窗口(ms) */
const DEBOUNCE_MS = 2000

type SyncState = 'local' | 'ready' | 'syncing' | 'offline' | 'error'
type SessionState = 'loading' | 'guest' | 'user'

export const useSyncStore = defineStore('utools-sync', {
  state: () => ({
    session: 'loading' as SessionState,
    email: '',
    /** 上次与云端通信的结果时间戳 */
    lastSyncAt: storage.get<number>('sync-last-at', 0),
    /** 待推送的 scope(持久化,离线不丢) */
    pending: storage.get<string[]>('sync-pending', []),
    status: 'local' as SyncState,
    statusText: '',
    /** 各 scope 云端 updated_at(拉取后记录,LWW 判断用) */
    remoteTimes: {} as Record<string, string>,
  }),

  getters: {
    loggedIn: (s) => s.session === 'user',
    enabled: () => supabaseConfigured(),
    pendingCount: (s) => s.pending.length,
    scopes: () => SYNC_SCOPES,
    lastSyncText(): string {
      if (!this.lastSyncAt) return '从未同步'
      return new Date(this.lastSyncAt).toLocaleString('zh-CN', { hour12: false })
    },
  },

  actions: {
    /* ------------------------------ 会话 ------------------------------ */
    async init() {
      if (!supabaseConfigured()) {
        this.session = 'guest'
        this.status = 'local'
        this.statusText = '未配置云端'
        return
      }
      const sb = await getSupabase()
      if (!sb) {
        this.session = 'guest'
        this.status = 'local'
        this.statusText = '云端不可用'
        return
      }
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (user) {
        this.session = 'user'
        this.email = user.email ?? ''
        this.status = 'ready'
        this.statusText = '已连接'
        void this.pullAll({ silent: true })
      } else {
        this.session = 'guest'
        this.status = 'local'
        this.statusText = '未登录,数据仅本机'
      }
      // 会话恢复/登出(跨标签页、令牌刷新失败等)
      sb.auth.onAuthStateChange((_ev, s) => {
        const u = s?.user
        if (u) {
          this.session = 'user'
          this.email = u.email ?? ''
          this.status = 'ready'
          this.statusText = '已连接'
          void this.pullAll({ silent: true })
        } else {
          this.session = 'guest'
          this.email = ''
          this.status = 'local'
          this.statusText = '未登录,数据仅本机'
        }
      })
      this.watchLocalMutations()
      void this.flushPending()
    },

    /** 发送邮箱验证码登录邮件(Magic Link 兜底为 6 位 OTP,均由 Supabase 托管) */
    async sendCode(email: string): Promise<boolean> {
      const sb = await getSupabase()
      if (!sb || !email.trim()) return false
      const { error } = await sb.auth.signInWithOtp({ email: email.trim() })
      if (error) {
        this.statusText = error.message
        return false
      }
      return true
    },

    /** 校验 6 位验证码并完成登录 */
    async verifyCode(email: string, token: string): Promise<boolean> {
      const sb = await getSupabase()
      if (!sb) return false
      const { error } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      })
      if (error) {
        this.statusText = error.message
        return false
      }
      return true
    },

    async signOut() {
      const sb = await getSupabase()
      if (sb) await sb.auth.signOut()
    },

    /* ------------------------------ 拉取 ------------------------------ */
    /** 全量拉取云端并按 LWW 合并到本地 */
    async pullAll(opts: { silent?: boolean } = {}) {
      const sb = await getSupabase()
      if (!sb || this.session !== 'user') return
      this.status = 'syncing'
      if (!opts.silent) this.statusText = '正在拉取云端数据…'
      try {
        const { data, error } = await sb
          .from('app_state')
          .select('scope,data,schema_version,updated_at,deleted')
          .eq('deleted', false)
        if (error) throw error
        const rows = (data ?? []) as AppStateRow[]
        let applied = 0
        for (const row of rows) {
          const def = SYNC_SCOPES_MAP.get(row.scope)
          if (!def) continue // 云端有、本地未声明:忽略(旧应用数据不覆盖未知结构)
          this.remoteTimes[row.scope] = row.updated_at
          const localRaw = localStorage.getItem(def.lsKey)
          const localTime = localRaw ? this.localTimeOf(def.lsKey) : ''
          // LWW:云端比本地新才覆盖;本地从未有该数据直接采用云端
          if (!localRaw || !localTime || row.updated_at > localTime) {
            localStorage.setItem(def.lsKey, JSON.stringify(row.data))
            applied++
          }
        }
        this.lastSyncAt = Date.now()
        storage.set('sync-last-at', this.lastSyncAt)
        this.status = 'ready'
        this.statusText = applied ? `已同步,应用了 ${applied} 项云端更新` : '已是最新'
      } catch (e) {
        this.status = 'offline'
        this.statusText = '拉取失败,稍后重试'
        console.warn('[sync] pullAll failed:', e)
      }
    },

    /** 读取本地某 scope 的更新时间(与云端 updated_at 对比) */
    localTimeOf(lsKey: string): string {
      return storage.get<Record<string, string>>('sync-local-times', {})[lsKey] ?? ''
    },

    markLocalTime(lsKey: string, t: string) {
      const map = storage.get<Record<string, string>>('sync-local-times', {})
      map[lsKey] = t
      storage.set('sync-local-times', map)
    },

    /* ------------------------------ 推送 ------------------------------ */
    /** 监听应用对 localStorage 的写入 → 入队防抖推送 */
    watchLocalMutations() {
      window.addEventListener(LS_MUTATED_EVENT, ((e: CustomEvent<string>) => {
        const def = SYNC_SCOPES.find((s) => s.lsKey === e.detail)
        if (def && this.session === 'user') this.enqueue(def.scope)
      }) as EventListener)
      window.addEventListener('online', () => void this.flushPending())
    },

    enqueue(scope: string) {
      if (!this.pending.includes(scope)) {
        this.pending = [...this.pending, scope]
        storage.set('sync-pending', this.pending)
      }
      const t = timers.get(scope)
      if (t) window.clearTimeout(t)
      timers.set(scope, window.setTimeout(() => void this.push(scope), DEBOUNCE_MS))
    },

    /** 推送单个 scope 的本地整包到云端(LWW:附 updated_at) */
    async push(scope: string) {
      const sb = await getSupabase()
      const def = SYNC_SCOPES_MAP.get(scope)
      if (!sb || !def || this.session !== 'user') return
      const raw = localStorage.getItem(def.lsKey)
      if (raw === null) return
      const now = new Date().toISOString()
      this.markLocalTime(def.lsKey, now)
      this.status = 'syncing'
      this.statusText = '正在推送…'
      try {
        const { error } = await sb.from('app_state').upsert({
          scope,
          data: JSON.parse(raw),
          schema_version: 1,
          updated_at: now,
          deleted: false,
        })
        if (error) throw error
        this.pending = this.pending.filter((s) => s !== scope)
        storage.set('sync-pending', this.pending)
        this.lastSyncAt = Date.now()
        storage.set('sync-last-at', this.lastSyncAt)
        this.status = 'ready'
        this.statusText = '已同步'
      } catch (e) {
        this.status = 'error'
        this.statusText = '推送失败,将在联网后重试'
        console.warn('[sync] push failed:', scope, e)
      }
    },

    /** 把积压的待推 scope 全部补推(登录后 / 网络恢复时) */
    async flushPending() {
      if (this.session !== 'user') return
      const list = [...this.pending]
      for (const scope of list) await this.push(scope)
    },

    /** 手动「立即同步」:先补推本地,再拉云端 */
    async syncNow() {
      await this.flushPending()
      await this.pullAll()
    },
  },
})
