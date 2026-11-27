import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, matchQ } from '../lib/ui'
import Loading from '../lib/Loading'

interface St { property_id: number; period_start: string; commission: number; reservations: number; nights: number; property: { name: string } | null }
interface Led { property_id: number; kind: string; category: string; amount: number; owner_effect: string; order_adjusted_at: string | null }
interface Wo { property_id: number; amount: number | null }
interface Line {
  id: number; name: string; months: number; orders: number; nights: number
  fee: number; markup: number; claims: number; repair: number; cleaner: number; other: number; profit: number
}
const GST = 0.1
const sgn = (n: number) => (!n ? <span className="muted">—</span> : <span style={{ color: n > 0 ? '#0f7a4a' : '#c0392b', whiteSpace: 'nowrap' }}>{n > 0 ? '+' : '−'}{money(Math.abs(n))}</span>)

// 房源盈亏：一套房在这段时间里，公司赚了多少服务费，花了多少维修、赔款等
export default function PropertyProfit() {
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setMsg('')
    const [st, lg, wo] = await Promise.all([
      supabase.from('owner_statements').select('property_id, period_start, commission, reservations, nights, property:properties(name)').limit(20000),
      supabase.from('ledger').select('property_id, kind, category, amount, owner_effect, order_adjusted_at').limit(50000),
      supabase.from('work_orders').select('property_id, amount').eq('type', '维修').eq('status', '已完成').eq('payer', '公司').limit(50000),
    ])
    const err = st.error ?? lg.error ?? wo.error
    if (err) { setMsg(`读取出错：${err.message}`); setLoading(false); return }
    const m = new Map<number, Line & { ms: Set<string> }>()
    const get = (id: number, name = '') => { let l = m.get(id); if (!l) { l = { id, name, months: 0, orders: 0, nights: 0, fee: 0, markup: 0, claims: 0, repair: 0, cleaner: 0, other: 0, profit: 0, ms: new Set() }; m.set(id, l) } if (name) l.name = name; return l }
    for (const s of (st.data ?? []) as unknown as St[]) {
      const l = get(s.property_id, s.property?.name ?? '')
      l.ms.add(s.period_start.slice(0, 7)); l.orders += s.reservations; l.nights += s.nights
      l.fee += Number(s.commission) / (1 + GST)          // 服务费按不含 GST 算
    }
    for (const r of (lg.data ?? []) as Led[]) {
      const l = get(r.property_id), a = Number(r.amount)
      if (r.owner_effect === '特殊折扣' && r.order_adjusted_at) continue   // 已在订单里平账，按 0 计
      if (r.category === '维修加价') { l.markup += a; continue }
      if (r.category === '索赔' && a > 0) { l.claims += a; continue }
      if (a >= 0) continue                                  // 其他收款是客人付的房费、押金等，不算公司的收入
      if (r.owner_effect === '扣房东') continue             // 已经从房东结算里扣回来了，公司没有损失
      if (r.kind === '清洁公司费用') l.cleaner += a; else l.other += a
    }
    for (const w of (wo.data ?? []) as Wo[]) get(w.property_id).repair -= Number(w.amount) || 0
    const names = await supabase.from('properties').select('id, name').in('id', [...m.keys()].filter((id) => !m.get(id)!.name).slice(0, 500))
    for (const p of names.data ?? []) get(p.id as number, p.name as string)
    const out = [...m.values()].map((l) => ({ ...l, months: l.ms.size, profit: l.fee + l.markup + l.claims + l.repair + l.cleaner + l.other }))
    out.sort((a, b) => b.profit - a.profit)
    setLines(out); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => lines.filter((l) => !q || matchQ(l.name, q)), [lines, q])
  const tot = (k: keyof Line) => shown.reduce((n, l) => n + Number(l[k]), 0)
  const exportCsv = () => {
    const head = ['房源', '运营月数', '订单数', '晚数', '服务费(不含GST)', '维修加价', '索赔公司留下', '公司承担维修', '清洁公司费用', '其他支出', '净利润']
    const r2 = (n: number) => Math.round(n * 100) / 100
    const rows = shown.map((l) => [l.name, l.months, l.orders, l.nights, r2(l.fee), r2(l.markup), r2(l.claims), r2(l.repair), r2(l.cleaner), r2(l.other), r2(l.profit)])
    const csv = '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `房源盈亏.csv`; a.click()
  }

  return (
    <div>
      <p className="muted small">每套房从开始运营到现在，公司的总收支：<b>赚</b>＝服务费（佣金去掉 GST）＋维修向房东多收的差额＋索赔里公司留下的钱；<b>花</b>＝公司自己承担的维修、清洁公司费用、公司自己消化的退款和赔款。已经从房东结算里扣回的、已在订单里平账的特殊折扣，都不算公司的损失。服务费、运营月数、订单和晚数按“房东结算”统计，没生成结算单的月份不在里面。</p>
      <div className="btn-row" style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="搜索房源" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 160 }} />
        <button className="ghost" onClick={exportCsv} disabled={!shown.length}>导出 CSV</button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {loading ? <Loading /> : !shown.length ? <p className="muted pad">还没有数据。</p> : (
        <>
          <p className="small">{shown.length} 套房 · 净利润合计 <b>{sgn(tot('profit'))}</b>（服务费 {money(tot('fee'))}，维修加价 {money(tot('markup'))}，索赔留下 {money(tot('claims'))}，支出 {money(-(tot('repair') + tot('cleaner') + tot('other')))}）</p>
          <div className="table-wrap">
            <table style={{ minWidth: 980 }}>
              <thead><tr><th>房源</th><th>运营月数</th><th>订单 / 晚</th><th style={{ textAlign: 'right' }}>服务费</th><th style={{ textAlign: 'right' }}>维修加价</th><th style={{ textAlign: 'right' }}>索赔留下</th><th style={{ textAlign: 'right' }}>公司承担维修</th><th style={{ textAlign: 'right' }}>清洁公司费用</th><th style={{ textAlign: 'right' }}>其他支出</th><th style={{ textAlign: 'right' }}>净利润</th></tr></thead>
              <tbody>{shown.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b></td><td>{l.months || '—'}</td><td>{l.orders} / {l.nights}</td>
                  <td style={{ textAlign: 'right' }}>{l.fee ? money(l.fee) : <span className="muted">—</span>}</td>
                  <td style={{ textAlign: 'right' }}>{sgn(l.markup)}</td><td style={{ textAlign: 'right' }}>{sgn(l.claims)}</td>
                  <td style={{ textAlign: 'right' }}>{sgn(l.repair)}</td><td style={{ textAlign: 'right' }}>{sgn(l.cleaner)}</td><td style={{ textAlign: 'right' }}>{sgn(l.other)}</td>
                  <td style={{ textAlign: 'right' }}><b>{sgn(l.profit)}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
