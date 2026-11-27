import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/ui'
import { downloadRepairPdf } from '../lib/repairPdf'

interface Row {
  id: number; type: string; description: string | null; amount: number | null; owner_charge?: number | null; payer: string; status: string
  done_date: string | null; vendor_name: string | null; assigned_to: string | null; settled_at: string | null
  property: { name: string } | null; worker: { name: string } | null
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthRange = (offset: number) => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() + offset, 1)), ymd(new Date(n.getFullYear(), n.getMonth() + offset + 1, 0))] as const }
const workerOf = (r: Row) => r.worker?.name ?? r.vendor_name ?? '未指定师傅'

export default function RepairSettle() {
  const nav = useNavigate()
  const [dFrom, setDFrom] = useState(monthRange(0)[0])
  const [dTo, setDTo] = useState(monthRange(0)[1])
  const [from, setFrom] = useState(dFrom)
  const [to, setTo] = useState(dTo)
  const [dWho, setDWho] = useState('')
  const [dSt, setDSt] = useState('全部')
  const [who, setWho] = useState('')
  const [st, setSt] = useState('全部')
  const [rows, setRows] = useState<Row[]>([])
  const [pending, setPending] = useState(0)        // 这段时间里还没确认费用的维修单
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const base = supabase.from('work_orders').select('*, property:properties(name), worker:profiles!assigned_to(name)').eq('type', '维修')
    const [a, b] = await Promise.all([
      base.eq('status', '已完成').gte('done_date', from).lte('done_date', to).order('done_date').limit(2000),
      supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('type', '维修').eq('status', '待确认费用'),
    ])
    if (a.error) { setMsg(`读取出错：${a.error.message}`); return }
    setMsg(''); setRows((a.data ?? []) as unknown as Row[]); setPending(b.count ?? 0)
  }, [from, to])
  useEffect(() => { load() }, [load])

  const query = (a = dFrom, b = dTo) => {
    if (!a || !b) { setMsg('请选好开始和结束日期。'); return }
    setDFrom(a); setDTo(b); setFrom(a); setTo(b); setWho(dWho); setSt(dSt)
  }
  const shown = useMemo(() => rows.filter((r) => (!who || workerOf(r) === who) && (st === '全部' || (st === '已结算' ? !!r.settled_at : !r.settled_at))), [rows, who, st])
  const workers = useMemo(() => [...new Set(rows.map(workerOf))].sort(), [rows])
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of shown) m.set(workerOf(r), [...(m.get(workerOf(r)) ?? []), r])
    return [...m.entries()].map(([name, list]) => ({
      name, list, total: list.reduce((n, r) => n + Number(r.amount ?? 0), 0),
      open: list.filter((r) => !r.settled_at), openTotal: list.filter((r) => !r.settled_at).reduce((n, r) => n + Number(r.amount ?? 0), 0),
      noAmt: list.filter((r) => r.amount == null).length,
    }))
  }, [shown])

  const settle = async (ids: number[], on: boolean) => {
    if (!ids.length) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('work_orders').update({ settled_at: on ? new Date().toISOString() : null }).in('id', ids)
    setBusy(false)
    if (error) { setMsg(error.code === '42703' ? '保存失败：还没运行 066 迁移。' : `保存失败：${error.message}`); return }
    setMsg(on ? `已标记 ${ids.length} 张为已结算。` : `已取消 ${ids.length} 张的已结算。`); load()
  }
  const downloadPdf = async (name: string, list: Row[]) => {
    setBusy(true); setMsg('')
    try {
      const sorted = [...list].sort((a, b) => (a.done_date ?? '').localeCompare(b.done_date ?? ''))
      await downloadRepairPdf(name, `${from} 至 ${to}`, sorted.map((r) => ({
        date: r.done_date ?? '', property: r.property?.name ?? '', text: (r.description ?? '').replace(/^【索赔#\d+】/, ''), amount: r.amount == null ? null : Number(r.amount),
      })))
    } catch (e) { setMsg(`生成 PDF 失败：${e instanceof Error ? e.message : '请重试'}`) }
    setBusy(false)
  }
  const exportCsv = () => {
    const head = ['师傅', '完成日期', '房源', '内容', '金额', '谁承担', '是否已结算']
    const lines = shown.map((r) => [workerOf(r), r.done_date ?? '', r.property?.name ?? '', r.description ?? '', r.amount ?? '', r.payer, r.settled_at ? '已结算' : '未结算'])
    const csv = '﻿' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `维修结算_${from}至${to}.csv`; a.click()
  }

  return (
    <div>
      <p className="muted small">按完成日期列出这段时间所有已完成的维修单，按师傅分组，方便月底对账、付钱。点“标记已结算”后，这些单就不会再出现在“未结算”里。</p>
      <div className="btn-row" style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted small">完成日期</span>
        <input type="date" value={dFrom} onChange={(e) => { setDFrom(e.target.value); if (dTo < e.target.value) setDTo(e.target.value) }} />
        <span className="muted small">到</span>
        <input type="date" value={dTo} onChange={(e) => { setDTo(e.target.value); if (dFrom > e.target.value) setDFrom(e.target.value) }} />
        <button className="ghost" onClick={() => { const r = monthRange(0); query(r[0], r[1]) }}>本月</button>
        <button className="ghost" onClick={() => { const r = monthRange(-1); query(r[0], r[1]) }}>上个月</button>
      </div>
      <div className="btn-row" style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={dWho} onChange={(e) => setDWho(e.target.value)}><option value="">全部师傅</option>{workers.map((w) => <option key={w}>{w}</option>)}</select>
        <select value={dSt} onChange={(e) => setDSt(e.target.value)}><option>全部</option><option>未结算</option><option>已结算</option></select>
        <button onClick={() => query()}>查询</button>
        <button className="ghost" onClick={exportCsv} disabled={!shown.length}>导出 CSV</button>
      </div>
      {pending > 0 && <p className="warn small">还有 {pending} 张维修单是“待确认费用”，确认金额、完成之后才会算进来。<button className="task-btn" onClick={() => nav('/repairs?tab=list')}>去处理</button></p>}
      {msg && <p className="muted">{msg}</p>}
      {!groups.length && <p className="muted pad">{from} 至 {to} 没有符合条件的已完成维修单。</p>}
      {groups.map((g) => (
        <section className="card" key={g.name} style={{ marginBottom: 16 }}>
          <div className="title-row">
            <h3 style={{ margin: 0 }}>{g.name} <span className="muted small">· {g.list.length} 单 · 合计 {money(g.total)}</span></h3>
            <span className="btn-row" style={{ margin: 0 }}>
              <span className="small">未结算 <b>{money(g.openTotal)}</b>（{g.open.length} 单）</span>
              <button className="ghost" disabled={busy} onClick={() => downloadPdf(g.name, g.list)}>下载对账单 PDF</button>
              <button disabled={busy || !g.open.length} onClick={() => settle(g.open.map((r) => r.id), true)}>标记这些为已结算</button>
            </span>
          </div>
          {g.noAmt > 0 && <p className="warn small">有 {g.noAmt} 单没有填金额，请到工单里补上。</p>}
          <div className="table-wrap" style={{ border: 0 }}>
            <table style={{ minWidth: 720 }}>
              <thead><tr><th>完成日期</th><th>房源</th><th>内容</th><th style={{ textAlign: 'right' }}>给师傅</th><th>谁承担</th><th style={{ textAlign: 'right' }}>收房东</th><th>结算</th><th></th></tr></thead>
              <tbody>{g.list.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.done_date?.slice(5)}</td><td>{r.property?.name}</td><td>{r.description ?? ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.amount == null ? <span className="muted">未填</span> : money(r.amount)}</td>
                  <td>{r.payer}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.payer === '房东' ? money(r.owner_charge ?? r.amount) : <span className="muted">—</span>}</td>
                  <td>{r.settled_at ? <span className="chip green" style={{ marginLeft: 0 }}>已结算</span> : <span className="chip amber" style={{ marginLeft: 0 }}>未结算</span>}</td>
                  <td className="btn-row" style={{ margin: 0 }}>
                    <button className="task-btn" onClick={() => nav(`/repairs?id=${r.id}`)}>看工单</button>
                    {r.settled_at && <button className="task-btn" disabled={busy} onClick={() => settle([r.id], false)}>取消结算</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
