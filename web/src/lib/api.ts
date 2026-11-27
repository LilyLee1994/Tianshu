import { supabase } from './supabase'

// 调用服务端函数（带上登录凭证），返回 [结果, 错误]
export async function callApi<T = Record<string, unknown>>(path: string, body: unknown): Promise<[T | null, string | null]> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 55_000)   // 超过 55 秒还没回应就报错，不要一直转圈
  try {
    const r = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return [null, j.error || `请求失败（${r.status}）`]
    return [j as T, null]
  } catch {
    return [null, ctl.signal.aborted ? '服务器太久没有回应，请刷新页面看看有没有保存成功，没有的话再试一次。' : '网络不通，请稍后再试。']
  } finally { clearTimeout(timer) }
}
