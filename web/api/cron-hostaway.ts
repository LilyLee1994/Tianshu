import { adminClient, authenticate, sydneyToday, type Req, type Res } from './_lib.js'
import { hostawayGet, hostawayToken } from './_hostaway.js'

// Hostaway 每日同步。一次调用最多跑约 45 秒，做不完就把进度存进数据库，下次调用接着做：
//   阶段：订单 → 自动派清洁 → 评价 → 日历快照（每个房源未来 180 天，逐个房源）
// 定时任务一天调用几次（vercel.json），管理员也可以在总览页点“立即同步”，页面会一直调用到完成。
const BUDGET_MS = 40_000
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const dateOnly = (v: unknown) => (v ? String(v).slice(0, 10) : null)
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10)
const active = (st: string | null) => !/cancel|inquiry|declin|expire|denied/i.test(st ?? '')

const channelOf = (cid: number, name?: unknown) =>
  cid === 2018 ? 'Airbnb' : cid === 2005 ? 'Booking.com' : name ? String(name) : cid ? `渠道${cid}` : null

type Phase = 'reservations' | 'cleaning' | 'reviews' | 'calendar' | 'done'
interface State { phase: Phase; calOffset: number; resOffset?: number; revOffset?: number; lastFirst?: Record<string, number>; counts: Record<string, unknown>; failed: string[] }

export default async function handler(req: Req, res: Res) {
  const db = adminClient()
  const h = req.headers.authorization
  const bearer = (Array.isArray(h) ? h[0] : h) ?? ''
  const isCron = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`
  if (!isCron) {
    const c = await authenticate(req, res, db)
    if (!c) return
    if (c.role !== 'admin') return res.status(403).json({ error: '只有管理员可以手动同步。' })
  }

  const t0 = Date.now()
  const left = () => BUDGET_MS - (Date.now() - t0)
  const today = sydneyToday()
  const kind = `hostaway_daily:${today}`

  // 找到今天的同步记录，没有就新建
  let { data: run } = await db.from('sync_runs').select('id, ok, summary').eq('kind', kind).maybeSingle()
  if (!run) {
    const init: State = { phase: 'reservations', calOffset: 0, counts: {}, failed: [] }
    const ins = await db.from('sync_runs').insert({ kind, summary: init }).select('id, ok, summary').single()
    run = ins.data
  }
  if (!run) return res.status(500).json({ error: '无法创建同步记录。' })
  if (run.ok === true) {
    // 定时任务不重复跑；管理员手动点时，只把日历这一段重跑一遍
    if (isCron) return res.status(200).json({ done: true, summary: (run.summary as State).counts })
    const prev = run.summary as State
    const redo: State = { ...prev, phase: 'calendar', calOffset: 0, failed: [], counts: { ...prev.counts, calendarRows: 0 } }
    await db.from('sync_runs').update({ summary: redo, ok: null, finished_at: null }).eq('id', run.id)
    run = { ...run, ok: null, summary: redo }
  }
  const st = run.summary as State
  const save = (patch: Record<string, unknown> = {}) =>
    db.from('sync_runs').update({ summary: st, ...patch }).eq('id', run!.id)

  try {
    const t = await hostawayToken()
    const { data: props } = await db.from('properties').select('id, hostaway_id, cleaning_by').not('hostaway_id', 'is', null).order('id')
    const byHost = new Map((props ?? []).map((p) => [Number(p.hostaway_id), p.id as number]))

    // 分页拉取，每页写库后记下偏移量；时间不够就停下，下次接着拉
    const pull = async (path: string, key: 'resOffset' | 'revOffset', handle: (rows: any[]) => Promise<void>) => {
      while (left() > 10_000) {
        const off = st[key] ?? 0
        const j = await hostawayGet(t, `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${off}`)
        const rows: any[] = j.result ?? []
        // 保护：如果这一页和上一页第一条一样（Hostaway 没按偏移翻页），或已经拉了 6000 条，就当作拉完，避免永远循环
        const first = Number(rows[0]?.id) || 0
        st.lastFirst = st.lastFirst ?? {}
        if (rows.length && first && st.lastFirst[key] === first) return true
        if (rows.length) st.lastFirst[key] = first
        await handle(rows)
        st[key] = off + rows.length
        await save()
        if (rows.length < 100 || st[key]! >= 6000) return true
      }
      return false
    }

    if (st.phase === 'reservations') {
      const finished = await pull(`/reservations?departureStartDate=${addDays(today, -90)}`, 'resOffset', async (resv) => {
        const rows = resv.map((r) => ({
          id: Number(r.id), property_id: byHost.get(Number(r.listingMapId)) ?? null, listing_id: num(r.listingMapId),
          channel_name: channelOf(Number(r.channelId), r.channelName), status: r.status ?? null,
          guest_name: r.guestName ?? ([r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') || null),
          arrival_date: dateOnly(r.arrivalDate), departure_date: dateOnly(r.departureDate), nights: num(r.nights),
          total_price: num(r.totalPrice), cleaning_fee: num(r.cleaningFee), channel_commission: num(r.channelCommissionAmount),
          currency: r.currency ?? null, reserved_at: r.reservationDate ?? null, raw: r, synced_at: new Date().toISOString(),
        })).filter((r) => r.id)
        if (rows.length) await db.from('reservations').upsert(rows, { onConflict: 'id' })
      })
      st.counts.reservations = st.resOffset ?? 0
      if (finished) { st.phase = 'cleaning'; await save() }
    }

    if (st.phase === 'cleaning') {
      st.counts.autoCleaning = await autoCleaning(db, today)
      st.phase = 'reviews'; await save()
    }

    if (st.phase === 'reviews') {
      // 评价历史很多（几万条），平时跳过，只在评价表几乎为空或每周一重新拉
      const { count: nRev } = await db.from('reviews').select('id', { count: 'exact', head: true })
      const monday = new Date(today).getUTCDay() === 1
      if ((nRev ?? 0) > 100 && !monday && !(st.revOffset && st.revOffset > 0)) { st.counts.reviews = `跳过（已有 ${nRev} 条，每周一刷新）`; st.phase = 'calendar'; await save() }
    }
    if (st.phase === 'reviews') {
      const finished = await pull('/reviews', 'revOffset', async (revs) => {
        // 只要「客人评房东」且有评分的；房东评客人、没评分的不要
        const rv = revs.filter((r) => !/host-to-guest|host_to_guest/i.test(String(r.type ?? '')) && num(r.rating) !== null).map((r) => {
          const cid = Number(r.channelId)
          const channel = channelOf(cid, r.channelName)
          return {
            id: Number(r.id), property_id: byHost.get(Number(r.listingMapId)) ?? null, listing_id: num(r.listingMapId),
            channel_name: channel, rating: num(r.rating), reviewed_at: r.submittedAt ?? r.insertedOn ?? null, raw: r, synced_at: new Date().toISOString(),
          }
        }).filter((r) => r.id)
        if (rv.length) await db.from('reviews').upsert(rv, { onConflict: 'id' })
      })
      st.counts.reviews = st.revOffset ?? 0
      if (finished) { st.phase = 'calendar'; await save() }
    }

    if (st.phase === 'calendar') {
      const list = props ?? []
      while (st.calOffset < list.length && left() > 8_000) {
        const p = list[st.calOffset]
        try {
          const j = await hostawayGet(t, `/listings/${p.hostaway_id}/calendar?startDate=${today}&endDate=${addDays(today, 180)}`)
          const days = ((j.result ?? []) as any[]).map((d) => ({
            property_id: p.id, date: dateOnly(d.date)!, snapshot_date: today,
            price: num(d.price), status: d.status ?? null, is_available: typeof d.isAvailable === 'boolean' ? d.isAvailable : d.isAvailable === 1,
            min_stay: num(d.minimumStay),
          })).filter((d) => d.date)
          const uniq = [...new Map(days.map((d) => [d.date, d])).values()]
          for (let i = 0; i < uniq.length; i += 500) {
            const { error } = await db.from('calendar_snapshots').upsert(uniq.slice(i, i + 500), { onConflict: 'property_id,date,snapshot_date' })
            if (error) throw new Error(`写入日历失败：${error.message}`)
          }
          st.counts.calendarRows = (Number(st.counts.calendarRows) || 0) + uniq.length
        } catch (e) { if (st.failed.length < 5) st.failed.push(`${p.hostaway_id}：${(e as Error).message}`) }
        st.calOffset++
        if (st.calOffset % 5 === 0) await save()
      }
      if (st.calOffset >= list.length) { st.phase = 'done'; st.counts.calendarFailed = st.failed.length ? st.failed : 0 }
      await save()
    }

    if (st.phase === 'done') {
      await save({ finished_at: new Date().toISOString(), ok: true })
      return res.status(200).json({ done: true, summary: st.counts })
    }
    return res.status(200).json({ done: false, phase: st.phase, calOffset: st.calOffset, resOffset: st.resOffset ?? 0, revOffset: st.revOffset ?? 0, total: props?.length ?? 0 })
  } catch (e) {
    const msg = (e as Error).message
    await save({ error: msg })      // 不标记结束，下次调用会从当前阶段重试
    return res.status(500).json({ error: msg })
  }
}

// 自动派清洁：今天和明天退房的订单，各生成一张清洁单。
// 房东自己做清洁的房源跳过；只有一家启用的清洁公司账号时直接派给它，否则进“待派单”。
async function autoCleaning(db: ReturnType<typeof adminClient>, today: string) {
  const { data: pr } = await db.from('properties').select('id, cleaning_by')
  const ownerCleans = new Set((pr ?? []).filter((p) => p.cleaning_by === '房东自己').map((p) => p.id as number))
  const { data: accts } = await db.from('profiles').select('id').eq('role', 'cleaner').eq('active', true)
  const only = accts?.length === 1 ? (accts[0].id as string) : null

  const cols = 'id, property_id, arrival_date, departure_date, status, guest_name'
  const { data: near } = await db.from('reservations').select(cols).not('property_id', 'is', null).gte('arrival_date', today).lte('arrival_date', addDays(today, 4))
  const arrivals = (near ?? []).filter((r) => active(r.status))
  const { data: outs } = await db.from('reservations').select(cols).not('property_id', 'is', null).gte('departure_date', today).lte('departure_date', addDays(today, 1))
  const { data: have } = await db.from('work_orders').select('reservation_id').eq('type', '清洁').not('reservation_id', 'is', null)
  const haveSet = new Set((have ?? []).map((h) => Number(h.reservation_id)))

  const fresh = (outs ?? []).filter((r) => active(r.status) && !haveSet.has(Number(r.id)) && !ownerCleans.has(r.property_id as number)).map((r) => {
    const dep = String(r.departure_date)
    const urgent = arrivals.some((a) => a.property_id === r.property_id && a.id !== r.id && String(a.arrival_date) >= dep && String(a.arrival_date) <= addDays(dep, 1))
    return {
      property_id: r.property_id, type: '清洁', description: `退房清洁${r.guest_name ? `（${r.guest_name}）` : ''}`,
      planned_date: dep, urgent, reservation_id: r.id, assigned_to: only, status: only ? '已派单' : '待派单',
    }
  })
  if (fresh.length) await db.from('work_orders').insert(fresh)

  // 订单后来取消、清洁单还没做的，标记已取消
  const { data: pend } = await db.from('work_orders').select('id, reservation_id').eq('type', '清洁').not('reservation_id', 'is', null).in('status', ['待派单', '已派单'])
  let cancelled = 0
  if (pend?.length) {
    const { data: rs } = await db.from('reservations').select('id, status').in('id', pend.map((o) => o.reservation_id))
    const dead = new Set((rs ?? []).filter((r) => !active(r.status)).map((r) => Number(r.id)))
    const ids = pend.filter((o) => dead.has(Number(o.reservation_id))).map((o) => o.id)
    if (ids.length) { await db.from('work_orders').update({ status: '已取消' }).in('id', ids); cancelled = ids.length }
  }
  return { created: fresh.length, noCleaner: fresh.filter((o) => !o.assigned_to).length, cancelled }
}
