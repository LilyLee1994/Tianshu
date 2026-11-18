import { adminClient, requireAdmin, type Req, type Res } from './_lib.js'

// 从 Hostaway 拉取房源，写入 properties / property_details。
// 只更新来自 Hostaway 的字段；人工填的合同、主责助理不动；WiFi 和锁盒密码只在库里是空的时才填。
const API = 'https://api.hostaway.com/v1'

async function token(): Promise<string> {
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

async function allListings(t: string): Promise<any[]> {
  const out: any[] = []
  for (let offset = 0; offset < 2000; offset += 100) {
    const r = await fetch(`${API}/listings?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${t}` } })
    if (!r.ok) throw new Error(`读取 Hostaway 房源失败（${r.status}）`)
    const j = await r.json()
    const rows: any[] = j.result ?? []
    out.push(...rows)
    if (rows.length < 100) break
  }
  return out
}

const str = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim())
const int = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.round(Number(v)))

// 在房源数据里找 Airbnb / Booking 链接（字段名不固定，所以把所有文字字段扫一遍）
function findLinks(l: Record<string, unknown>) {
  let airbnb: string | null = null, booking: string | null = null
  const walk = (v: unknown, depth: number) => {
    if (depth > 4 || v === null || v === undefined) return
    if (typeof v === 'string') {
      const m = v.match(/https?:\/\/[^\s"']+/)
      const u = m?.[0]
      if (!u) return
      if (!airbnb && /airbnb\.[a-z.]+\/rooms\/\d+/i.test(u)) airbnb = u.split('?')[0]
      if (!booking && /booking\.com\/hotel\//i.test(u)) booking = u.split('?')[0]
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1))
    else if (typeof v === 'object') Object.values(v as object).forEach((x) => walk(x, depth + 1))
  }
  walk(l, 0)
  if (!airbnb) {
    for (const [k, v] of Object.entries(l)) {
      if (/airbnb/i.test(k) && /id$/i.test(k) && /^\d{6,}$/.test(String(v ?? ''))) { airbnb = `https://www.airbnb.com/rooms/${v}`; break }
    }
  }
  return { airbnb, booking }
}

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (!(await requireAdmin(req, res, db))) return
    const list = await allListings(await token())

    const { data: existing } = await db.from('properties').select('id, name, hostaway_id')
    const byHost = new Map((existing ?? []).filter((p) => p.hostaway_id).map((p) => [Number(p.hostaway_id), p.id as number]))
    const byName = new Map((existing ?? []).filter((p) => !p.hostaway_id).map((p) => [String(p.name).toLowerCase(), p.id as number]))

    let created = 0, updated = 0, airbnbFound = 0, bookingFound = 0
    const skipped: string[] = []
    for (const l of list) {
      const hid = Number(l.id)
      const name = str(l.internalListingName) ?? str(l.name) ?? str(l.externalListingName)
      if (!hid || !name) { skipped.push(`id=${l.id}（没有名称）`); continue }
      const address = str(l.address) ?? (([str(l.street), str(l.city), str(l.state)].filter(Boolean).join(', ')) || null)
      const region = str(l.city)

      let pid = byHost.get(hid) ?? byName.get(name.toLowerCase())
      if (pid) {
        const { error } = await db.from('properties').update({ hostaway_id: hid, address, region, hostaway_synced_at: new Date().toISOString() }).eq('id', pid)
        if (error) { skipped.push(`${name}：${error.message}`); continue }
        updated++
      } else {
        const { data, error } = await db.from('properties')
          .insert({ name, address, region, hostaway_id: hid, legacy: true, hostaway_synced_at: new Date().toISOString() }).select('id').single()
        if (error || !data) { skipped.push(`${name}：${error?.code === '23505' ? '名称重复' : error?.message}`); continue }
        pid = data.id as number
        created++
      }

      // 平台链接：只在库里还是空的时候填，不覆盖手工填的
      const links = findLinks(l)
      if (links.airbnb) airbnbFound++
      if (links.booking) bookingFound++
      const { data: pl } = await db.from('properties').select('airbnb_url, booking_url').eq('id', pid).maybeSingle()
      const lp: Record<string, string> = {}
      if (!pl?.airbnb_url && links.airbnb) lp.airbnb_url = links.airbnb
      if (!pl?.booking_url && links.booking) lp.booking_url = links.booking
      if (Object.keys(lp).length) await db.from('properties').update(lp).eq('id', pid)

      // 基本情况：Hostaway 有的就更新；锁盒密码、WiFi 只在库里还是空的时候填
      const { data: cur } = await db.from('property_details').select('lock_code, wifi_name, wifi_password').eq('property_id', pid).maybeSingle()
      const patch: Record<string, unknown> = {
        bedrooms: int(l.bedroomsNumber), bathrooms: int(l.bathroomsNumber), max_guests: int(l.personCapacity),
      }
      if (!cur?.lock_code && str(l.doorSecurityCode)) patch.lock_code = str(l.doorSecurityCode)
      if (!cur?.wifi_name && str(l.wifiUsername)) patch.wifi_name = str(l.wifiUsername)
      if (!cur?.wifi_password && str(l.wifiPassword)) patch.wifi_password = str(l.wifiPassword)
      await db.from('property_details').update(patch).eq('property_id', pid)
    }

    // 附上第一条原始数据的字段名，方便核对 Hostaway 实际给了哪些字段
    const sampleKeys = list[0] ? Object.keys(list[0]) : []
    return res.status(200).json({ ok: true, total: list.length, created, updated, skipped, sampleKeys, airbnbFound, bookingFound })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
