import { adminClient, requireFinance, type Req, type Res } from './_lib.js'

const CANCELLED = /cancel|inquiry|declin|expire|denied/i
const r2 = (n: number) => Math.round(n * 100) / 100
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01` }

// 结算单草稿：房费（不含清洁费，按退房日归月）− 佣金 − 平台费 − GST ± 手工调整 − 房东承担的维修费
export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (!(await requireFinance(req, res, db))) return
    const { action, month, id, adjustment, note } = req.body ?? {}

    if (action === 'generate') {
      if (!/^\d{4}-\d{2}$/.test(month ?? '')) return res.status(400).json({ error: '月份格式不对。' })
      const from = `${month}-01`, to = nextMonth(month)
      const { data: rules } = await db.from('fee_rules').select('key, value')
      const rate = Object.fromEntries((rules ?? []).map((x) => [x.key, Number(x.value)]))
      const platformRate = rate.platform_fee_rate ?? 0.155, gstRate = rate.gst_rate ?? 0.1

      const { data: props } = await db.from('properties').select('id, commission_rate')
      const commOf = new Map((props ?? []).map((p) => [p.id as number, Number(p.commission_rate)]))

      // 当月退房的订单（分页取，Supabase 一次最多 1000 条）
      const inc = new Map<number, { n: number; nights: number; rental: number }>()
      for (let off = 0; ; off += 1000) {
        const { data, error } = await db.from('reservations').select('property_id, status, nights, total_price, cleaning_fee, currency')
          .gte('departure_date', from).lt('departure_date', to).not('property_id', 'is', null).order('id').range(off, off + 999)
        if (error) return res.status(500).json({ error: error.message })
        for (const r of data ?? []) {
          if (CANCELLED.test(String(r.status ?? ''))) continue
          const e = inc.get(r.property_id as number) ?? { n: 0, nights: 0, rental: 0 }
          e.n++; e.nights += Number(r.nights) || 0
          e.rental += Math.max(0, (Number(r.total_price) || 0) - (Number(r.cleaning_fee) || 0))
          inc.set(r.property_id as number, e)
        }
        if ((data ?? []).length < 1000) break
      }

      // 房东承担、已完成的工单费用
      const costs = new Map<number, number>()
      const { data: wo } = await db.from('work_orders').select('property_id, amount').eq('payer', '房东').eq('status', '已完成').gte('done_date', from).lt('done_date', to)
      for (const w of wo ?? []) costs.set(w.property_id as number, (costs.get(w.property_id as number) ?? 0) + (Number(w.amount) || 0))

      const { data: existing } = await db.from('owner_statements').select('id, property_id, status, adjustment').eq('month', from)
      const ex = new Map((existing ?? []).map((x) => [x.property_id as number, x]))

      let made = 0, kept = 0
      for (const pid of new Set([...inc.keys(), ...costs.keys()])) {
        const old = ex.get(pid)
        if (old && old.status !== '草稿') { kept++; continue }
        const e = inc.get(pid) ?? { n: 0, nights: 0, rental: 0 }
        const cr = commOf.get(pid) ?? 0.15
        const commission = r2(e.rental * cr), platform = r2(e.rental * platformRate), gst = r2((commission + platform) * gstRate)
        const ownerCosts = r2(costs.get(pid) ?? 0), adj = Number(old?.adjustment ?? 0)
        const payable = r2(e.rental - commission - platform - gst - ownerCosts + adj)
        const row = { property_id: pid, month: from, reservations: e.n, nights: e.nights, rental_income: r2(e.rental), commission_rate: cr, commission, platform_fee: platform, gst, owner_costs: ownerCosts, payable, generated_at: new Date().toISOString() }
        const { error } = await db.from('owner_statements').upsert(row, { onConflict: 'property_id,month' })
        if (error) return res.status(500).json({ error: error.message })
        made++
      }
      return res.status(200).json({ ok: true, made, kept })
    }

    const { data: st } = await db.from('owner_statements').select('*').eq('id', id).maybeSingle()
    if (!st) return res.status(404).json({ error: '找不到这张结算单。' })

    if (action === 'adjust') {
      if (st.status !== '草稿') return res.status(400).json({ error: '已确认的结算单不能再改。' })
      const adj = Number(adjustment)
      if (Number.isNaN(adj)) return res.status(400).json({ error: '调整金额要填数字。' })
      const payable = r2(Number(st.rental_income) - Number(st.commission) - Number(st.platform_fee) - Number(st.gst) - Number(st.owner_costs) + adj)
      await db.from('owner_statements').update({ adjustment: adj, adjustment_note: note || null, payable }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    if (action === 'confirm') {
      if (st.status !== '草稿') return res.status(400).json({ error: '这张结算单已经确认过了。' })
      await db.from('owner_statements').update({ status: '已确认', confirmed_at: new Date().toISOString() }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    if (action === 'pay') {
      if (st.status !== '已确认') return res.status(400).json({ error: '要先确认，才能标记已付。' })
      await db.from('owner_statements').update({ status: '已付', paid_at: new Date().toISOString() }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: '未知操作。' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
