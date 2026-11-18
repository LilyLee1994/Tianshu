import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 最小的请求/响应类型，避免额外依赖
export interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: any }
export interface Res { status(code: number): Res; json(body: unknown): void }

const URL = process.env.SUPABASE_URL || 'https://vzvmejgxgypkcnbtzrvo.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function adminClient(): SupabaseClient {
  if (!KEY) throw new Error('服务器没有配置 SUPABASE_SERVICE_ROLE_KEY')
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const emailOf = (account: string) => `${account.trim().toLowerCase()}@tianshu.local`

// 不含容易看错的字符（0 O 1 l I）
export function genPassword(len = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => chars[n % chars.length]).join('')
}

export interface Caller { id: string; role: string }

// 校验调用者的登录凭证，返回他的角色；失败时已经写好响应并返回 null
export async function authenticate(req: Req, res: Res, db: SupabaseClient): Promise<Caller | null> {
  const h = req.headers.authorization
  const token = (Array.isArray(h) ? h[0] : h)?.replace(/^Bearer\s+/i, '')
  if (!token) { res.status(401).json({ error: '请先登录。' }); return null }
  const { data: u, error } = await db.auth.getUser(token)
  if (error || !u.user) { res.status(401).json({ error: '登录已过期，请重新登录。' }); return null }
  const { data: p } = await db.from('profiles').select('id, role, active').eq('id', u.user.id).maybeSingle()
  if (!p || !p.active) { res.status(403).json({ error: '账号已停用。' }); return null }
  return { id: p.id, role: p.role }
}

export async function requireAdmin(req: Req, res: Res, db: SupabaseClient): Promise<Caller | null> {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST。' }); return null }
  const c = await authenticate(req, res, db)
  if (!c) return null
  if (c.role !== 'admin') { res.status(403).json({ error: '只有管理员可以做这个操作。' }); return null }
  return c
}

// 悉尼时区的今天（YYYY-MM-DD）
export const sydneyToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

export async function requireWorker(req: Req, res: Res, db: SupabaseClient): Promise<Caller | null> {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST。' }); return null }
  const c = await authenticate(req, res, db)
  if (!c) return null
  if (c.role !== 'repairman' && c.role !== 'cleaner') { res.status(403).json({ error: '这个功能只给维修师傅和清洁公司。' }); return null }
  return c
}
