import { adminClient, authenticate, sydneyToday, type Req, type Res } from './_lib.js'

// 每天清理：清洁工单的照片只留最近 3 个月。已经转成索赔的损坏照永久保留（索赔要用）。维修工单照片不动。
const KEEP_DAYS = 92
const BATCH = 200
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10)

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const h = req.headers.authorization
    const bearer = (Array.isArray(h) ? h[0] : h) ?? ''
    if (!(process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`)) {
      const c = await authenticate(req, res, db)
      if (!c) return
      if (c.role !== 'admin') return res.status(403).json({ error: '只有管理员可以手动清理。' })
    }
    const cutoff = addDays(sydneyToday(), -KEEP_DAYS)

    // 索赔里引用的照片路径：永久保留
    const { data: cl } = await db.from('claims').select('photos').limit(20000)
    const keep = new Set<string>((cl ?? []).flatMap((c) => (c.photos as string[] | null) ?? []))

    const { data: orders, error } = await db.from('work_orders')
      .select('id, photos, damage_photos, done_date, created_at')
      .eq('type', '清洁').lt('created_at', `${cutoff}T00:00:00Z`).limit(BATCH)
    if (error) return res.status(500).json({ error: error.message })

    let removedFiles = 0, touched = 0
    for (const o of orders ?? []) {
      const photos = (o.photos as string[] | null) ?? []
      const damage = (o.damage_photos as string[] | null) ?? []
      const dateOf = (o.done_date as string | null) ?? String(o.created_at).slice(0, 10)
      if (dateOf >= cutoff) continue
      const del = [...photos, ...damage].filter((p) => !keep.has(p))
      if (!photos.length && !del.length) continue
      if (del.length) {
        const r = await db.storage.from('work-photos').remove(del)
        if (r.error) continue // 这张删失败，下次再试，不改数据库
        removedFiles += del.length
      }
      const u = await db.from('work_orders').update({ photos: [], damage_photos: damage.filter((p) => keep.has(p)) }).eq('id', o.id)
      if (!u.error) touched++
    }
    return res.status(200).json({ ok: true, cutoff, orders: touched, removedFiles, more: (orders ?? []).length === BATCH })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
