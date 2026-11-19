import { adminClient, requireAdmin, type Req, type Res } from './_lib.js'
import { hostawayToken, hostawayGet } from './_hostaway.js'

// 字段盘点：看你这个 Hostaway 账号实际返回了哪些字段、每个字段有多少房源/订单填了值。
// 姓名、联系方式、密码、评价正文等敏感内容一律不返回，只返回字段名、有值的数量和无害的示例。
const SENSITIVE = /guest|email|phone|password|passcode|code|key|token|secret|wifi|lock|text|comment|message|review|note|descr|summary|rule|instruction|address|street|lat|lng|latitude|longitude|zip|name|url|link|feedback|response/i

const empty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

type Field = { key: string; filled: number; sample: string }

function profile(rows: any[]): { total: number; fields: Field[] } {
  const map = new Map<string, Field>()
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      const f = map.get(k) ?? { key: k, filled: 0, sample: '' }
      if (!empty(v)) {
        f.filled++
        if (!f.sample) {
          if (SENSITIVE.test(k)) f.sample = '（已隐藏）'
          else if (Array.isArray(v)) f.sample = `列表，${v.length} 项`
          else if (typeof v === 'object') f.sample = `对象：${Object.keys(v as object).slice(0, 6).join('、')}`
          else f.sample = String(v).slice(0, 40)
        }
      }
      map.set(k, f)
    }
  }
  return { total: rows.length, fields: [...map.values()].sort((a, b) => b.filled - a.filled) }
}

// 在整条数据里找 Airbnb / Booking 链接，返回它们藏在哪个字段
function linkPaths(rows: any[]) {
  const found = new Map<string, number>()
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 4 || v === null || v === undefined) return
    if (typeof v === 'string') {
      if (/airbnb\.[a-z.]+\/rooms\/\d+/i.test(v)) found.set(`${path} → Airbnb`, (found.get(`${path} → Airbnb`) ?? 0) + 1)
      else if (/booking\.com\/hotel\//i.test(v)) found.set(`${path} → Booking`, (found.get(`${path} → Booking`) ?? 0) + 1)
      else if (/vrbo\.com|homeaway\./i.test(v)) found.set(`${path} → Vrbo`, (found.get(`${path} → Vrbo`) ?? 0) + 1)
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, `${path}[]`, depth + 1))
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) walk(x, path ? `${path}.${k}` : k, depth + 1)
  }
  rows.forEach((r) => walk(r, '', 0))
  return [...found.entries()].map(([where, n]) => ({ where, n }))
}

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (!(await requireAdmin(req, res, db))) return
    const t = await hostawayToken()
    const out: Record<string, unknown>[] = []

    const tryGet = async (label: string, path: string, withLinks = false) => {
      try {
        const j = await hostawayGet(t, path, 1)
        const rows: any[] = Array.isArray(j.result) ? j.result : j.result ? [j.result] : []
        out.push({ label, path: path.split('?')[0], ok: true, ...profile(rows), links: withLinks ? linkPaths(rows) : undefined })
        return rows
      } catch (e) {
        out.push({ label, path: path.split('?')[0], ok: false, error: (e as Error).message })
        return []
      }
    }

    const listings = await tryGet('房源', '/listings?limit=100&includeResources=1', true)
    const first = listings[0]?.id
    await tryGet('订单', '/reservations?limit=100&sortOrder=arrivalDateDesc')
    await tryGet('评价', '/reviews?limit=100')
    await tryGet('客人会话', '/conversations?limit=20')
    await tryGet('任务', '/tasks?limit=20')
    await tryGet('费用', '/expenses?limit=20')
    await tryGet('房东结算单', '/ownerStatements?limit=5')
    await tryGet('财务字段', '/financeField?limit=5')
    if (first) await tryGet('单个房源详情', `/listings/${first}`, true)

    return res.status(200).json({ ok: true, resources: out })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
