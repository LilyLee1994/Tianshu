import { adminClient, requireFinance, type Req, type Res } from './_lib.js'

const CANCELLED = /cancel|inquiry|declin|expire|denied/i
const r2 = (n: number) => Math.round(n * 100) / 100
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01` }

// 结算单草稿：房费（不含清洁费，按退房日归月）先扣平台费（16.5%，含 GST），再在剩下的金额上扣佣金（15% × 1.1 = 16.5%，含 GST），
// 即 房费 × 0.835 × 0.835；再 ± 手工调整、− 房东承担的维修费
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
      const platformRate = rate.platform_fee_rate ?? 0.165, gstRate = rate.gst_rate ?? 0.1

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

      // 当月已赔付的索赔（按到账日期）
      const claimsIn = new Map<number, number>()
      const { data: cl } = await db.from('claims').select('property_id, paid_amount').eq('status', '已赔付').gte('paid_date', from).lt('paid_date', to)
      for (const c of cl ?? []) claimsIn.set(c.property_id as number, (claimsIn.get(c.property_id as number) ?? 0) + (Number(c.paid_amount) || 0))

      // 当月处理的差评赔偿里，房东承担的部分
      const reviewComp = new Map<number, number>()
      const { data: ra } = await db.from('review_actions').select('comp_amount, review:reviews(property_id)').eq('status', '赔偿客人').eq('payer', '房东').gte('handled_date', from).lt('handled_date', to)
      for (const a of (ra ?? []) as any[]) {
        const pid = a.review?.property_id as number | undefined
        if (pid) reviewComp.set(pid, (reviewComp.get(pid) ?? 0) + (Number(a.comp_amount) || 0))
      }

      const { data: existing } = await db.from('owner_statements').select('id, property_id, status, adjustment').eq('month', from)
      const ex = new Map((existing ?? []).map((x) => [x.property_id as number, x]))

      let kept = 0
      const out: Record<string, unknown>[] = []
      for (const pid of new Set([...inc.keys(), ...costs.keys(), ...claimsIn.keys(), ...reviewComp.keys()])) {
        const old = ex.get(pid)
        if (old && old.status !== '草稿') { kept++; continue }
        const e = inc.get(pid) ?? { n: 0, nights: 0, rental: 0 }
        const cr = commOf.get(pid) ?? 0.15
        const platform = r2(e.rental * platformRate)                                  // 平台费（含 GST）
        const commission = r2((e.rental - platform) * cr * (1 + gstRate))              // 佣金（含 GST），在扣完平台费的金额上算
        const gst = r2(platform * gstRate / (1 + gstRate) + commission * gstRate / (1 + gstRate)) // 其中的 GST，仅供对账参考
        const ownerCosts = r2(costs.get(pid) ?? 0), claimsAmt = r2(claimsIn.get(pid) ?? 0), revComp = r2(reviewComp.get(pid) ?? 0), adj = Number(old?.adjustment ?? 0)
        const payable = r2(e.rental - commission - platform - ownerCosts - revComp + claimsAmt + adj)
        const row = { property_id: pid, month: from, reservations: e.n, nights: e.nights, rental_income: r2(e.rental), commission_rate: cr, commission, platform_fee: platform, gst, owner_costs: ownerCosts, claims_in: claimsAmt, review_comp: revComp, payable, generated_at: new Date().toISOString() }
        out.push(row)
      }
      // 一次写一批（之前一套房写一次，房源多了会超时，只生成了前几十个）
      for (let i = 0; i < out.length; i += 100) {
        const { error } = await db.from('owner_statements').upsert(out.slice(i, i + 100), { onConflict: 'property_id,month' })
        if (error) return res.status(500).json({ error: error.message })
      }
      const made = out.length
      return res.status(200).json({ ok: true, made, kept })
    }

    const { data: st } = await db.from('owner_statements').select('*').eq('id', id).maybeSingle()
    if (!st) return res.status(404).json({ error: '找不到这张结算单。' })

    if (action === 'adjust') {
      if (st.status !== '草稿') return res.status(400).json({ error: '已确认的结算单不能再改。' })
      const adj = Number(adjustment)
      if (Number.isNaN(adj)) return res.status(400).json({ error: '调整金额要填数字。' })
      const payable = r2(Number(st.rental_income) - Number(st.commission) - Number(st.platform_fee) - Number(st.owner_costs) - Number(st.review_comp) + Number(st.claims_in) + adj)
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
