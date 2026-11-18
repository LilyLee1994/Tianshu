import { supabase } from './supabase'

// 调用服务端函数（带上登录凭证），返回 [结果, 错误]
export async function callApi<T = Record<string, unknown>>(path: string, body: unknown): Promise<[T | null, string | null]> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  try {
    const r = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return [null, j.error || `请求失败（${r.status}）`]
    return [j as T, null]
  } catch {
    return [null, '网络不通，请稍后再试。']
  }
}
