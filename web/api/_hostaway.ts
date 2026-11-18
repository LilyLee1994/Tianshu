const API = 'https://api.hostaway.com/v1'

export async function hostawayToken(): Promise<string> {
  const id = process.env.HOSTAWAY_ACCOUNT_ID, key = process.env.HOSTAWAY_API_KEY
  if (!id || !key) throw new Error('服务器还没配置 HOSTAWAY_ACCOUNT_ID 和 HOSTAWAY_API_KEY')
  const r = await fetch(`${API}/accessTokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: key, scope: 'general' }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error(`Hostaway 登录失败（${r.status}），请检查 Account ID 和 API Key`)
  return j.access_token as string
}

// Hostaway 限速约 15 次 / 10 秒，这里保守地每次间隔 ~700ms，遇到 429 等一下再试
let last = 0
export async function hostawayGet(t: string, path: string, retries = 3): Promise<any> {
  const wait = 700 - (Date.now() - last)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  let r: Response
  try { r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${t}` }, signal: ctl.signal }) }
  catch { throw new Error(`Hostaway ${path.split('?')[0]} 超时`) }
  finally { clearTimeout(timer) }
  if (r.status === 429 && retries > 0) { await new Promise((x) => setTimeout(x, 5000)); return hostawayGet(t, path, retries - 1) }
  if (!r.ok) throw new Error(`Hostaway ${path.split('?')[0]} 失败（${r.status}）`)
  return r.json()
}

export async function hostawayAll(t: string, path: string, maxPages = 30): Promise<any[]> {
  const out: any[] = []
  for (let page = 0; page < maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const j = await hostawayGet(t, `${path}${sep}limit=100&offset=${page * 100}`)
    const rows: any[] = j.result ?? []
    out.push(...rows)
    if (rows.length < 100) break
  }
  return out
}
