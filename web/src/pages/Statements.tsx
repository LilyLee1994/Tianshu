import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { callApi } from '../lib/api'
import { money, matchQ } from '../lib/ui'
import { coveredAssistantIds } from '../lib/cover'

interface St {
  id: number; property_id: number; month: string; period_start: string; period_end: string; reservations: number; nights: number; rental_income: number; commission_rate: number
  commission: number; platform_fee: number; gst: number; owner_costs: number; review_comp: number; claims_in: number; ledger_adj: number; adjustment: number; adjustment_note: string | null
  payable: number; status: '草稿' | '已确认' | '已付'; property: { name: string; assistant_id: string | null; assistant: { name: string } | null } | null
}

// 默认看上个月整月（月底结算的是刚结束的月份）
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthRange = (offset: number) => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() + offset, 1)), ymd(new Date(n.getFullYear(), n.getMonth() + offset + 1, 0))] as const }
const chip = (s: string) => (s === '已付' ? 'chip green' : s === '已确认' ? 'chip blue' : 'chip amber')

// 加给房东的显示绿色 +，从房东扣的显示红色 −，0 显示 —
const amt = (n: number) => {
  if (!n || Number.isNaN(n)) return <span className="muted">—</span>
  const t = `$${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`
  return n > 0 ? <span style={{ color: '#0f7a4a', whiteSpace: 'nowrap' }}>+{t}</span> : <span style={{ color: '#c0392b', whiteSpace: 'nowrap' }}>−{t}</span>
}
interface LedgerItem { id: number; property_id: number; occurred_date: string; kind: string; category: string; amount: number; reason: string | null; owner_effect: string; guest_name: string | null }
// 鼠标放上去显示“其他补扣”由哪几笔公司款项组成
function LedgerTip({ n, items }: { n: number; items: LedgerItem[] }) {
  if (!items.length) return <>{amt(n)}</>
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const show = (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 6, right: Math.max(12, window.innerWidth - r.right) }) }
  return (
    <span className="tip-wrap" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      {amt(n)}
      <span className="tip-pop" style={pos ? { display: 'block', top: pos.top, right: pos.right } : undefined}>
        <b>其他补扣明细（来自公司款项）</b>
        {items.map((l) => {
          const v = Math.abs(Number(l.amount)) * (l.owner_effect === '扣房东' ? -1 : 1)
          return (
            <span className="tip-row" key={l.id}>
              <span className="muted">{l.occurred_date.slice(5)}</span>
              <span>{l.kind} · {l.category}{l.guest_name ? ` · ${l.guest_name}` : ''}{l.reason ? <span className="muted small"> {l.reason.length > 28 ? `${l.reason.slice(0, 28)}…` : l.reason}</span> : null}</span>
              {amt(v)}
            </span>
          )
        })}
        <span className="tip-row tip-sum"><span /><span>合计</span>{amt(n)}</span>
      </span>
    </span>
  )
}

export default function Statements() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'finance'
  const canGenerate = canEdit || profile?.role === 'assistant'      // 生成草稿：客服助理也可以
  const isAssistant = profile?.role === 'assistant'
  const [cover, setCover] = useState<Set<string>>(new Set())
  useEffect(() => { if (isAssistant && profile) coveredAssistantIds(profile.id).then(setCover) }, [profile?.id, isAssistant]) // eslint-disable-line react-hooks/exhaustive-deps
  const [from, setFrom] = useState(monthRange(-1)[0])
  const [to, setTo] = useState(monthRange(-1)[1])
  const [dFrom, setDFrom] = useState(from)       // 日期先填在这里，点“查询”才生效
  const [dTo, setDTo] = useState(to)
  const label = from === to ? from : `${from} 至 ${to}`
  const query = (a = dFrom, b = dTo) => { if (!a || !b || a > b) { setMsg('请选好开始和结束日期（开始不能晚于结束）。'); return }; setMsg(''); setDFrom(a); setDTo(b); setFrom(a); setTo(b) }
  const [rows, setRows] = useState<St[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [adj, setAdj] = useState<St | null>(null)
  const [lgItems, setLgItems] = useState<Map<number, LedgerItem[]>>(new Map())

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('owner_statements')
      .select('*, property:properties(name, assistant_id, assistant:profiles!assistant_id(name))')
      .eq('period_start', from).eq('period_end', to).order('property_id').limit(5000)
    if (error) { setMsg(`读取出错：${error.message}`); return }
    setRows((data ?? []) as never)
    const lg = await supabase.from('ledger').select('id, property_id, occurred_date, kind, category, amount, reason, owner_effect, guest_name')
      .in('owner_effect', ['补房东', '扣房东']).gte('occurred_date', from).lte('occurred_date', to).order('occurred_date').limit(5000)
    const m = new Map<number, LedgerItem[]>()
    for (const l of (lg.data ?? []) as LedgerItem[]) m.set(l.property_id, [...(m.get(l.property_id) ?? []), l])
    setLgItems(m)
  }, [from, to])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => rows.filter((r) => {
    if (isAssistant && !(r.property?.assistant_id && cover.has(r.property.assistant_id))) return false
    if (q && !matchQ(r.property?.name, q)) return false
    return true
  }), [rows, q, isAssistant, cover])


  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg('')
    const [r, e] = await callApi<{ made?: number; kept?: number }>('statements', body)
    setBusy(false)
    if (e) { setMsg(e); return }
    setMsg(body.action === 'generate' ? `已生成 ${r?.made ?? 0} 张草稿${r?.kept ? `，${r.kept} 张已确认的没动` : ''}。` : ok)
    setAdj(null); load()
  }

  const generate = async () => {
    if (!from || !to || from > to) { setMsg('请选好开始和结束日期（开始不能晚于结束）。'); return }
    await act({ action: 'generate', from, to }, '')
  }

  const exportCsv = () => {
    const head = ['期间', '房源', '助理', '订单数', '晚数', '房费', '佣金比例', '佣金', '平台费', 'GST', '房东承担维修', '差评赔偿', '索赔到账', '其他补扣', '手工调整', '调整说明', '应付房东', '状态']
    const lines = shown.map((r) => [`${r.period_start}~${r.period_end}`, r.property?.name, r.property?.assistant?.name ?? '', r.reservations, r.nights, r.rental_income, r.commission_rate, r.commission, r.platform_fee, r.gst, r.owner_costs, r.review_comp, r.claims_in, r.ledger_adj ?? 0, r.adjustment, r.adjustment_note ?? '', r.payable, r.status]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const url = URL.createObjectURL(new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `房东结算-${from}至${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1>房东结算</h1>
      <p className="muted small">应付房东 = 房费（不含清洁费，按退房日算在哪个日期范围）先扣平台费 16.5%，再在剩下的金额上扣佣金（比例 × 1.1，默认 15% → 16.5%）；再 + 这段时间到账、给房东的索赔，− 房东承担的维修费和差评赔偿，± “其他补扣”（公司款项里标为补房东 / 扣房东的）和手工调整。表里绿色 + 号是加给房东，红色 − 号是从房东扣。平台费和佣金已含 GST，“其中 GST”仅供对账。确认后不能再改。</p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input type="date" value={dFrom} onChange={(e) => { setDFrom(e.target.value); if (dTo < e.target.value) setDTo(e.target.value) }} title="开始日期（含当天）" />
        <span className="muted small">到</span>
        <input type="date" value={dTo} onChange={(e) => { setDTo(e.target.value); if (dFrom > e.target.value) setDFrom(e.target.value) }} title="结束日期（含当天）" />
        <button onClick={() => query()}>查询</button>
        <button className="ghost" onClick={() => { const r = monthRange(-1); query(r[0], r[1]) }}>上个月</button>
        <button className="ghost" onClick={() => { const r = monthRange(0); query(r[0], r[1]) }}>本月</button>
        <input placeholder="搜索房源" value={q} onChange={(e) => setQ(e.target.value)} />
        {canGenerate && <button disabled={busy} onClick={generate}>{busy ? '生成中…' : rows.length ? '重新计算草稿' : '生成这段时间的草稿'}</button>}
        <button className="ghost" onClick={exportCsv} disabled={!shown.length}>导出 CSV</button>
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="table-wrap">
        <table style={{ minWidth: 1260 }}>
          <thead><tr><th>房源</th><th>助理</th><th>订单/晚</th><th>房费</th><th>佣金</th><th>平台费</th><th>其中 GST</th><th title="房东承担的维修费，从应付里扣">维修扣款</th><th title="给客人的差评赔偿，从应付里扣">差评赔偿</th><th title="这段时间到账的索赔，给房东的部分，加到应付里">索赔到账</th><th title="公司款项里标为“补房东 / 扣房东”的金额合计">其他补扣</th><th title="财务手工调整">手工调整</th><th>应付房东</th><th>状态</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.property?.name}</td><td>{r.property?.assistant?.name ?? '—'}</td>
                <td>{r.reservations} / {r.nights}</td>
                <td>{money(r.rental_income)}</td>
                <td>{money(r.commission)} <span className="muted small">{Math.round(Number(r.commission_rate) * 1000) / 10}%</span></td>
                <td>{money(r.platform_fee)}</td><td>{money(r.gst)}</td><td>{amt(-Number(r.owner_costs))}</td><td>{amt(-Number(r.review_comp))}</td><td>{amt(Number(r.claims_in))}</td>
                <td><LedgerTip n={Number(r.ledger_adj)} items={lgItems.get(r.property_id) ?? []} /></td>
                <td title={r.adjustment_note ?? ''}>{amt(Number(r.adjustment))}</td>
                <td><b>{money(r.payable)}</b></td>
                <td><span className={chip(r.status)}>{r.status}</span></td>
                {canEdit && <td className="btn-row" style={{ margin: 0 }}>
                  {r.status === '草稿' && <><button className="ghost" onClick={() => setAdj(r)}>调整</button><button className="ghost" disabled={busy} onClick={() => act({ action: 'confirm', id: r.id }, '已确认。')}>确认</button></>}
                  {r.status === '已确认' && <button className="ghost" disabled={busy} onClick={() => act({ action: 'pay', id: r.id }, '已标记为已付。')}>标记已付</button>}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="muted pad">{
          rows.length && !q ? `${label} 已经有结算单，但没有你负责的房源。`
          : q ? '没有找到匹配的房源。'
          : to >= ymd(new Date()) ? `${label} 还没有结束，订单按退房日算，现在生成的草稿只包含已经退房的订单。点上面的“生成这段时间的草稿”可以先看看。`
          : `${label} 还没有生成结算单。点上面的“生成这段时间的草稿”。`
        }</p>}
      </div>

      {adj && <AdjustModal row={adj} busy={busy} onClose={() => setAdj(null)} onSave={(v, n) => act({ action: 'adjust', id: adj.id, adjustment: v, note: n }, '已保存调整。')} />}
    </div>
  )
}

function AdjustModal({ row, busy, onClose, onSave }: { row: St; busy: boolean; onClose: () => void; onSave: (v: number, note: string) => void }) {
  const [v, setV] = useState(String(row.adjustment ?? 0))
  const [note, setNote] = useState(row.adjustment_note ?? '')
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{row.property?.name} · 手工调整</h3>
        <p className="muted small">正数加给房东（如索赔到账），负数从房东扣（如差评赔偿、代缴水电网扣回）。</p>
        <label>金额（AUD）<input value={v} onChange={(e) => setV(e.target.value)} /></label>
        <label>说明<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：Airbnb 索赔到账 / 代缴电费扣回" /></label>
        <div className="btn-row">
          <button disabled={busy || Number.isNaN(Number(v))} onClick={() => onSave(Number(v), note)}>保存</button>
          <button className="ghost" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}
