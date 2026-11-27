import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, matchQ, cleanDesc } from '../lib/ui'
import Loading from '../lib/Loading'
import DateRange from '../lib/DateRange'

interface St { property_id: number; period_start: string; period_end: string; commission: number; reservations: number; nights: number; property: { name: string } | null }
interface Led { id: number; occurred_date: string; reason: string | null; guest_name: string | null; property_id: number; kind: string; category: string; amount: number; owner_effect: string; order_adjusted_at: string | null }
interface Wo { id: number; property_id: number; amount: number | null; description: string | null; done_date: string | null }
interface Item { sec: string; date: string; text: string; amount: number }
const SECS = ['服务费', '维修加价', '索赔留下', '公司承担维修', '清洁公司费用', '其他支出'] as const
interface Line {
  id: number; name: string; months: number; orders: number; nights: number
  fee: number; markup: number; claims: number; repair: number; cleaner: number; other: number; profit: number
  items: Item[]
}
const GST = 0.1
const sgn = (n: number) => (!n ? <span className="muted">—</span> : <span style={{ color: n > 0 ? '#0f7a4a' : '#c0392b', whiteSpace: 'nowrap' }}>{n > 0 ? '+' : '−'}{money(Math.abs(n))}</span>)

async function fetchLines(pid?: number, from = '', to = ''): Promise<{ lines: Line[]; error?: string }> {
  // 不选日期 = 从开始到现在的累计；选了日期只算这段时间
  const rng = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T, col: string): T => { let r = q; if (from) r = r.gte(col, from); if (to) r = r.lte(col, to); return r }
    const [st, lg, wo] = await Promise.all([
      rng(pid ? supabase.from('owner_statements').select('property_id, period_start, period_end, commission, reservations, nights, property:properties(name)').eq('property_id', pid) : supabase.from('owner_statements').select('property_id, period_start, period_end, commission, reservations, nights, property:properties(name)'), 'period_start').limit(20000),
      rng(pid ? supabase.from('ledger').select('id, occurred_date, reason, guest_name, property_id, kind, category, amount, owner_effect, order_adjusted_at').eq('property_id', pid) : supabase.from('ledger').select('id, occurred_date, reason, guest_name, property_id, kind, category, amount, owner_effect, order_adjusted_at'), 'occurred_date').limit(50000),
      rng((pid ? supabase.from('work_orders').select('id, property_id, amount, description, done_date').eq('property_id', pid) : supabase.from('work_orders').select('id, property_id, amount, description, done_date')).eq('type', '维修').eq('status', '已完成').eq('payer', '公司'), 'done_date').limit(50000),
    ])
    const err = st.error ?? lg.error ?? wo.error
    if (err) return { lines: [], error: `读取出错：${err.message}` }
    const m = new Map<number, Line & { ms: Set<string> }>()
    const get = (id: number, name = '') => { let l = m.get(id); if (!l) { l = { id, name, months: 0, orders: 0, nights: 0, fee: 0, markup: 0, claims: 0, repair: 0, cleaner: 0, other: 0, profit: 0, items: [], ms: new Set() }; m.set(id, l) } if (name) l.name = name; return l }
    for (const s of (st.data ?? []) as unknown as St[]) {
      const l = get(s.property_id, s.property?.name ?? '')
      l.ms.add(s.period_start.slice(0, 7)); l.orders += s.reservations; l.nights += s.nights
      l.fee += Number(s.commission) / (1 + GST)          // 服务费按不含 GST 算
      l.items.push({ sec: '服务费', date: s.period_start, text: `${s.period_start} ~ ${s.period_end} 房东结算的佣金 ${money(s.commission)}，去掉 GST`, amount: Number(s.commission) / (1 + GST) })
    }
    for (const r of (lg.data ?? []) as Led[]) {
      const l = get(r.property_id), a = Number(r.amount)
      if (r.owner_effect === '特殊折扣' && r.order_adjusted_at) continue   // 已在订单里平账，按 0 计
      const note = [r.kind + ' · ' + r.category, r.guest_name, r.reason].filter(Boolean).join(' · ')
      const add = (sec: string) => l.items.push({ sec, date: r.occurred_date, text: note, amount: a })
      if (r.category === '维修加价') { l.markup += a; add('维修加价'); continue }
      if (r.category === '索赔' && a > 0) { l.claims += a; add('索赔留下'); continue }
      if (a >= 0) continue                                  // 其他收款是客人付的房费、押金等，不算公司的收入
      if (r.owner_effect === '扣房东') continue             // 已经从房东结算里扣回来了，公司没有损失
      if (r.kind === '清洁公司费用') { l.cleaner += a; add('清洁公司费用') } else { l.other += a; add('其他支出') }
    }
    for (const w of (wo.data ?? []) as Wo[]) { const l = get(w.property_id), a = -(Number(w.amount) || 0); l.repair += a; l.items.push({ sec: '公司承担维修', date: w.done_date ?? '', text: cleanDesc(w.description) || '维修', amount: a }) }
    const names = await supabase.from('properties').select('id, name').in('id', [...m.keys()].filter((id) => !m.get(id)!.name).slice(0, 500))
    for (const p of names.data ?? []) get(p.id as number, p.name as string)
    const out = [...m.values()].map((l) => ({ ...l, months: l.ms.size, profit: l.fee + l.markup + l.claims + l.repair + l.cleaner + l.other }))
    out.sort((a, b) => b.profit - a.profit)
    return { lines: out }
}

// 房源盈亏：一套房在这段时间里，公司赚了多少服务费，花了多少维修、赔款等
export default function PropertyProfit() {
  const [dFrom, setDFrom] = useState('')
  const [dTo, setDTo] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<Line | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg('')
    const r = await fetchLines(undefined, from, to)
    if (r.error) setMsg(r.error); else setLines(r.lines)
    setLoading(false)
  }, [from, to])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => lines.filter((l) => !q || matchQ(l.name, q)), [lines, q])
  const tot = (k: keyof Line) => shown.reduce((n, l) => n + Number(l[k]), 0)
  const setRange = (a: string, b: string) => { setDFrom(a); setDTo(b); setFrom(a); setTo(b) }
  const thisMonth = () => { const n = new Date(), p = (x: number) => String(x).padStart(2, '0'); setRange(`${n.getFullYear()}-${p(n.getMonth() + 1)}-01`, `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate())}`) }
  const lastMonth = () => { const n = new Date(), p = (x: number) => String(x).padStart(2, '0'), d = new Date(n.getFullYear(), n.getMonth() - 1, 1); setRange(`${d.getFullYear()}-${p(d.getMonth() + 1)}-01`, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())}`) }
  const exportCsv = () => {
    const head = ['房源', '运营月数', '订单数', '晚数', '服务费(不含GST)', '维修加价', '索赔公司留下', '公司承担维修', '清洁公司费用', '其他支出', '净利润']
    const r2 = (n: number) => Math.round(n * 100) / 100
    const rows = shown.map((l) => [l.name, l.months, l.orders, l.nights, r2(l.fee), r2(l.markup), r2(l.claims), r2(l.repair), r2(l.cleaner), r2(l.other), r2(l.profit)])
    const csv = '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `房源盈亏${from || to ? `_${from || '起'}至${to || '今'}` : '_累计'}.csv`; a.click()
  }

  return (
    <div>
      <p className="muted small">每套房的公司收支。不选日期是从开始运营到现在的累计，选了日期只算这段时间：<b>赚</b>＝服务费（佣金去掉 GST）＋维修向房东多收的差额＋索赔里公司留下的钱；<b>花</b>＝公司自己承担的维修、清洁公司费用、公司自己消化的退款和赔款。已经从房东结算里扣回的、已在订单里平账的特殊折扣，都不算公司的损失。服务费、运营月数、订单和晚数按“房东结算”统计，没生成结算单的月份不在里面。</p>
      <div className="btn-row" style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <DateRange from={dFrom} to={dTo} onChange={(a, b) => { if (a && b) setRange(a, b); else setRange('', '') }} />
        <button className="ghost" onClick={thisMonth}>本月</button>
        <button className="ghost" onClick={lastMonth}>上个月</button>
        <button className="ghost" onClick={() => setRange('', '')}>全部（累计）</button>
        <input placeholder="搜索房源" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 160 }} />
        <button className="ghost" onClick={exportCsv} disabled={!shown.length}>导出 CSV</button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {loading ? <Loading /> : !shown.length ? <p className="muted pad">还没有数据。</p> : (
        <>
          <p className="small">{from && to ? `${from} ~ ${to}` : '累计'} · {shown.length} 套房 · 净利润合计 <b>{sgn(tot('profit'))}</b>（服务费 {money(tot('fee'))}，维修加价 {money(tot('markup'))}，索赔留下 {money(tot('claims'))}，支出 {money(-(tot('repair') + tot('cleaner') + tot('other')))}）</p>
          <div className="table-wrap">
            <table style={{ minWidth: 980 }}>
              <thead><tr><th>房源</th><th>运营月数</th><th>订单 / 晚</th><th style={{ textAlign: 'right' }}>服务费</th><th style={{ textAlign: 'right' }}>维修加价</th><th style={{ textAlign: 'right' }}>索赔留下</th><th style={{ textAlign: 'right' }}>公司承担维修</th><th style={{ textAlign: 'right' }}>清洁公司费用</th><th style={{ textAlign: 'right' }}>其他支出</th><th style={{ textAlign: 'right' }}>净利润</th></tr></thead>
              <tbody>{shown.map((l) => (
                <tr key={l.id} onClick={() => setOpen(l)} style={{ cursor: 'pointer' }} title="点击看明细">
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
      {open && <Detail line={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Detail({ line, onClose }: { line: Line; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, width: '92vw', maxHeight: '86vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="title-row"><h2 style={{ margin: 0 }}>{line.name}</h2><button className="ghost" onClick={onClose}>关闭</button></div>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>运营 {line.months || 0} 个月 · {line.orders} 单 / {line.nights} 晚 · 净利润 <b>{sgn(line.profit)}</b></p>
        {SECS.map((sec) => {
          const items = line.items.filter((i) => i.sec === sec).sort((a, b) => a.date.localeCompare(b.date))
          if (!items.length) return null
          const sum = items.reduce((n, i) => n + i.amount, 0)
          return (
            <div key={sec} style={{ marginBottom: 14 }}>
              <div className="title-row" style={{ marginBottom: 4 }}><b>{sec}</b><span>{sgn(sum)}</span></div>
              <table style={{ minWidth: 0, width: '100%' }}>
                <tbody>{items.map((i, k) => (
                  <tr key={k}><td style={{ width: 90, whiteSpace: 'nowrap' }}>{i.date.slice(0, 10)}</td><td>{i.text}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{sgn(i.amount)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )
        })}
        {!line.items.length && <p className="muted">这套房还没有收支记录。</p>}
      </div>
    </div>
  )
}

// 房源档案里的“盈亏明细”按钮：点开就是这套房的收支明细弹窗
export function ProfitButton({ propertyId, name }: { propertyId: number; name: string }) {
  const [line, setLine] = useState<Line | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    const r = await fetchLines(propertyId)
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    setLine(r.lines[0] ?? { id: propertyId, name, months: 0, orders: 0, nights: 0, fee: 0, markup: 0, claims: 0, repair: 0, cleaner: 0, other: 0, profit: 0, items: [] })
  }
  return (
    <>
      <button className="ghost" disabled={busy} onClick={go}>{busy ? '读取中…' : '盈亏明细'}</button>
      {err && <span className="error small">{err}</span>}
      {line && <Detail line={{ ...line, name: line.name || name }} onClose={() => setLine(null)} />}
    </>
  )
}
