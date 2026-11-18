import { adminClient, authenticate, sydneyToday, type Req, type Res } from './_lib.js'
import { hostawayAll, hostawayGet, hostawayToken } from './_hostaway.js'

// 每天自动跑一次（vercel.json 里配置），管理员也可以在总览页手动触发。
// 拉三样：订单、未来 180 天的日历价格快照、评价。原始数据全存，字段以后可补。
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const dateOnly = (v: unknown) => (v ? String(v).slice(0, 10) : null)
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10)

export default async function handler(req: Req, res: Res) {
  const db = adminClient()
  // 允许两种调用者：Vercel 定时任务（带 CRON_SECRET），或已登录的管理员
  const h = req.headers.authorization
  const bearer = (Array.isArray(h) ? h[0] : h) ?? ''
  const isCron = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`
  if (!isCron) {
    const c = await authenticate(req, res, db)
    if (!c) return
    if (c.role !== 'admin') return res.status(403).json({ error: '只有管理员可以手动同步。' })
  }

  const { data: run } = await db.from('sync_runs').insert({ kind: 'hostaway_daily' }).select('id').single()
  const summary: Record<string, unknown> = {}
  try {
    const t = await hostawayToken()
    const today = sydneyToday()
    const { data: props } = await db.from('properties').select('id, hostaway_id').not('hostaway_id', 'is', null)
    const byHost = new Map((props ?? []).map((p) => [Number(p.hostaway_id), p.id as number]))

    // 1) 订单：最近 90 天内离店过的和以后的
    const resv = await hostawayAll(t, `/reservations?departureStartDate=${addDays(today, -90)}`)
    const rows = resv.map((r) => ({
      id: Number(r.id), property_id: byHost.get(Number(r.listingMapId)) ?? null, listing_id: num(r.listingMapId),
      channel_name: r.channelName ?? null, status: r.status ?? null,
      guest_name: r.guestName ?? ([r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') || null),
      arrival_date: dateOnly(r.arrivalDate), departure_date: dateOnly(r.departureDate), nights: num(r.nights),
      total_price: num(r.totalPrice), cleaning_fee: num(r.cleaningFee), channel_commission: num(r.channelCommissionAmount),
      currency: r.currency ?? null, reserved_at: r.reservationDate ?? null, raw: r, synced_at: new Date().toISOString(),
    })).filter((r) => r.id)
    for (let i = 0; i < rows.length; i += 200) await db.from('reservations').upsert(rows.slice(i, i + 200), { onConflict: 'id' })
    summary.reservations = rows.length

    // 2) 评价
    const revs = await hostawayAll(t, '/reviews')
    const rv = revs.map((r) => ({
      id: Number(r.id), property_id: byHost.get(Number(r.listingMapId)) ?? null, listing_id: num(r.listingMapId),
      channel_name: r.channelName ?? null, rating: num(r.rating), reviewed_at: r.submittedAt ?? r.insertedOn ?? null, raw: r, synced_at: new Date().toISOString(),
    })).filter((r) => r.id)
    for (let i = 0; i < rv.length; i += 200) await db.from('reviews').upsert(rv.slice(i, i + 200), { onConflict: 'id' })
    summary.reviews = rv.length

    // 3) 日历快照：每个房源未来 180 天
    let cal = 0
    const failed: string[] = []
    for (const p of props ?? []) {
      try {
        const j = await hostawayGet(t, `/listings/${p.hostaway_id}/calendar?startDate=${today}&endDate=${addDays(today, 180)}`)
        const days = ((j.result ?? []) as any[]).map((d) => ({
          property_id: p.id, date: dateOnly(d.date)!, snapshot_date: today,
          price: num(d.price), status: d.status ?? null, is_available: typeof d.isAvailable === 'boolean' ? !!d.isAvailable : d.isAvailable === 1,
          min_stay: num(d.minimumStay),
        })).filter((d) => d.date)
        for (let i = 0; i < days.length; i += 500) await db.from('calendar_snapshots').upsert(days.slice(i, i + 500), { onConflict: 'property_id,date,snapshot_date' })
        cal += days.length
      } catch (e) { failed.push(`${p.hostaway_id}：${(e as Error).message}`) }
    }
    summary.calendarRows = cal
    summary.calendarFailed = failed.length ? failed.slice(0, 5) : 0

    await db.from('sync_runs').update({ finished_at: new Date().toISOString(), ok: true, summary }).eq('id', run?.id)
    return res.status(200).json({ ok: true, summary })
  } catch (e) {
    const msg = (e as Error).message
    await db.from('sync_runs').update({ finished_at: new Date().toISOString(), ok: false, summary, error: msg }).eq('id', run?.id)
    return res.status(500).json({ error: msg })
  }
}
