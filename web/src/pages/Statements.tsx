import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { callApi } from '../lib/api'
import { money } from '../lib/ui'

interface St {
  id: number; property_id: number; month: string; reservations: number; nights: number; rental_income: number; commission_rate: number
  commission: number; platform_fee: number; gst: number; owner_costs: number; review_comp: number; claims_in: number; adjustment: number; adjustment_note: string | null
  payable: number; status: '草稿' | '已确认' | '已付'; property: { name: string; assistant: { name: string } | null } | null
}

// 默认看上个月（月底结算的是刚结束的月份）
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) }
const chip = (s: string) => (s === '已付' ? 'chip green' : s === '已确认' ? 'chip blue' : 'chip amber')

export default function Statements() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'finance'
  const [month, setMonth] = useState(lastMonth())
  const [rows, setRows] = useState<St[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [adj, setAdj] = useState<St | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('owner_statements')
      .select('*, property:properties(name, assistant_id, assistant:profiles!assistant_id(name))')
      .eq('month', `${month}-01`).order('property_id').limit(1000)
    if (error) { setMsg(`读取出错：${error.message}`); return }
    setRows((data ?? []) as never)
  }, [month])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => rows.filter((r) => {
    if (q && !r.property?.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, q])

  const total = useMemo(() => shown.reduce((a, r) => ({
    rental: a.rental + Number(r.rental_income), comm: a.comm + Number(r.commission), plat: a.plat + Number(r.platform_fee), gst: a.gst + Number(r.gst),
    cost: a.cost + Number(r.owner_costs), rev: a.rev + Number(r.review_comp), claims: a.claims + Number(r.claims_in), adj: a.adj + Number(r.adjustment), pay: a.pay + Number(r.payable),
  }), { rental: 0, comm: 0, plat: 0, gst: 0, cost: 0, rev: 0, claims: 0, adj: 0, pay: 0 }), [shown])

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg('')
    const [r, e] = await callApi<{ made?: number; kept?: number }>('statements', body)
    setBusy(false)
    if (e) { setMsg(e); return }
    setMsg(body.action === 'generate' ? `已生成 ${r?.made ?? 0} 张草稿${r?.kept ? `，${r.kept} 张已确认的没动` : ''}。` : ok)
    setAdj(null); load()
  }

  const exportCsv = () => {
    const head = ['房源', '助理', '订单数', '晚数', '房费', '佣金比例', '佣金', '平台费', 'GST', '房东承担维修', '差评赔偿', '索赔到账', '调整', '调整说明', '应付房东', '状态']
    const lines = shown.map((r) => [r.property?.name, r.property?.assistant?.name ?? '', r.reservations, r.nights, r.rental_income, r.commission_rate, r.commission, r.platform_fee, r.gst, r.owner_costs, r.review_comp, r.claims_in, r.adjustment, r.adjustment_note ?? '', r.payable, r.status]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const url = URL.createObjectURL(new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `房东结算-${month}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1>房东结算（财务）</h1>
      <p className="muted small">应付房东 = 房费（不含清洁费，按退房日归月）先扣平台费 16.5%，再在剩下的金额上扣佣金（比例 × 1.1，默认 15% → 16.5%）；再 + 当月到账的索赔、± 手工调整、− 房东承担的维修费和差评赔偿。平台费和佣金已含 GST，“其中 GST”仅供对账。确认后不能再改。</p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <input placeholder="搜索房源" value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit && <button disabled={busy} onClick={() => act({ action: 'generate', month }, '')}>{busy ? '生成中…' : rows.length ? '重新计算草稿' : '生成这个月的草稿'}</button>}
        <button className="ghost" onClick={exportCsv} disabled={!shown.length}>导出 CSV</button>
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="table-wrap">
        <table style={{ minWidth: 1260 }}>
          <thead><tr><th>房源</th><th>助理</th><th>订单/晚</th><th>房费</th><th>佣金</th><th>平台费</th><th>其中 GST</th><th>维修扣款</th><th>差评赔偿</th><th>索赔到账</th><th>调整</th><th>应付房东</th><th>状态</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.property?.name}</td><td>{r.property?.assistant?.name ?? '—'}</td>
                <td>{r.reservations} / {r.nights}</td>
                <td>{money(r.rental_income)}</td>
                <td>{money(r.commission)} <span className="muted small">{Math.round(Number(r.commission_rate) * 1000) / 10}%</span></td>
                <td>{money(r.platform_fee)}</td><td>{money(r.gst)}</td><td>{money(r.owner_costs)}</td><td>{Number(r.review_comp) ? money(r.review_comp) : '—'}</td><td>{Number(r.claims_in) ? money(r.claims_in) : '—'}</td>
                <td title={r.adjustment_note ?? ''}>{Number(r.adjustment) ? money(r.adjustment) : '—'}</td>
                <td><b>{money(r.payable)}</b></td>
                <td><span className={chip(r.status)}>{r.status}</span></td>
                {canEdit && <td className="btn-row" style={{ margin: 0 }}>
                  {r.status === '草稿' && <><button className="ghost" onClick={() => setAdj(r)}>调整</button><button className="ghost" disabled={busy} onClick={() => act({ action: 'confirm', id: r.id }, '已确认。')}>确认</button></>}
                  {r.status === '已确认' && <button className="ghost" disabled={busy} onClick={() => act({ action: 'pay', id: r.id }, '已标记为已付。')}>标记已付</button>}
                </td>}
              </tr>
            ))}
            {shown.length > 0 && (
              <tr style={{ fontWeight: 600 }}>
                <td>合计（{shown.length} 个房源）</td><td></td><td></td>
                <td>{money(total.rental)}</td><td>{money(total.comm)}</td><td>{money(total.plat)}</td><td>{money(total.gst)}</td><td>{money(total.cost)}</td><td>{money(total.rev)}</td><td>{money(total.claims)}</td><td>{money(total.adj)}</td><td>{money(total.pay)}</td><td></td>{canEdit && <td></td>}
              </tr>
            )}
          </tbody>
        </table>
        {!shown.length && <p className="muted pad">{month} 还没有结算单。{canEdit ? '点上面的“生成这个月的草稿”。' : '等财务生成后这里会显示。'}</p>}
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
