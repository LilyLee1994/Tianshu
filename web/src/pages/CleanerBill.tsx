import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/ui'
import { downloadRepairPdf } from '../lib/repairPdf'

interface Row {
  id: number; occurred_date: string; category: string; amount: number; reason: string | null; guest_name: string | null; settled_at: string | null
  property: { name: string } | null
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthRange = (offset: number) => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() + offset, 1)), ymd(new Date(n.getFullYear(), n.getMonth() + offset + 1, 0))] as const }
const abs = (n: number) => Math.abs(Number(n) || 0)

// 清洁公司额外费用月度账单：数据来自“公司款项”里类型为“清洁公司费用”的记录
export default function CleanerBill() {
  const nav = useNavigate()
  const [dFrom, setDFrom] = useState(monthRange(0)[0])
  const [dTo, setDTo] = useState(monthRange(0)[1])
  const [from, setFrom] = useState(dFrom)
  const [to, setTo] = useState(dTo)
  const [dCat, setDCat] = useState('全部')
  const [dSt, setDSt] = useState('全部')
  const [cat, setCat] = useState('全部')
  const [st, setSt] = useState('全部')
  const [company, setCompany] = useState('Alisa')
  const [rows, setRows] = useState<Row[]>([])
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ledger').select('id, occurred_date, category, amount, reason, guest_name, settled_at, property:properties(name)')
      .eq('kind', '清洁公司费用').gte('occurred_date', from).lte('occurred_date', to).order('occurred_date').order('id').limit(5000)
    if (error) { setMsg(error.code === '42703' ? '读取出错：还没运行 069 迁移。' : `读取出错：${error.message}`); return }
    setRows((data ?? []) as unknown as Row[])
  }, [from, to])
  useEffect(() => { load() }, [load])

  const query = (a = dFrom, b = dTo) => {
    if (!a || !b) { setMsg('请选好开始和结束日期。'); return }
    setDFrom(a); setDTo(b); setFrom(a); setTo(b); setCat(dCat); setSt(dSt); setSel(new Set()); setMsg('')
  }
  const shown = useMemo(() => rows.filter((r) => (cat === '全部' || r.category === cat) && (st === '全部' || (st === '已结算' ? !!r.settled_at : !r.settled_at))), [rows, cat, st])
  const picked = shown.filter((r) => sel.has(r.id))
  const sum = (l: Row[]) => l.reduce((n, r) => n + abs(r.amount), 0)
  const toggle = (ids: number[], on: boolean) => setSel((p) => { const n = new Set(p); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n })
  const text = (r: Row) => [r.category, r.reason].filter(Boolean).join(' · ')

  const settle = async (ids: number[], on: boolean) => {
    if (!ids.length) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('ledger').update({ settled_at: on ? new Date().toISOString() : null }).in('id', ids)
    setBusy(false)
    if (error) { setMsg(error.code === '42703' ? '保存失败：还没运行 069 迁移。' : `保存失败：${error.message}`); return }
    setMsg(on ? `已标记 ${ids.length} 笔为已结算。` : `已取消 ${ids.length} 笔的已结算。`); setSel(new Set()); load()
  }
  const downloadPdf = async () => {
    setBusy(true); setMsg('')
    try {
      await downloadRepairPdf(company.trim() || '清洁公司', `${from} 至 ${to}`,
        picked.map((r) => ({ date: r.occurred_date, property: r.property?.name ?? '', text: text(r), amount: abs(r.amount) })),
        { title: '清洁费用对账单', titleEn: 'Cleaning Services Statement', party: '清洁公司' })
    } catch (e) { setMsg(`生成 PDF 失败：${e instanceof Error ? e.message : '请重试'}`) }
    setBusy(false)
  }
  const exportCsv = () => {
    const head = ['日期', '房源', '类别', '事项', '金额', '是否已结算']
    const lines = picked.map((r) => [r.occurred_date, r.property?.name ?? '', r.category, r.reason ?? '', abs(r.amount), r.settled_at ? '已结算' : '未结算'])
    lines.push(['合计', '', '', `共 ${lines.length} 笔`, sum(picked), ''])
    const csv = '﻿' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `清洁公司费用_${from}至${to}.csv`; a.click()
  }
  const open = shown.filter((r) => !r.settled_at)

  return (
    <div>
      <p className="muted small">额外清洁、跑腿等清洁公司做的额外事项，在“款项明细”里新增一条，类型选“清洁公司费用”。这里按日期汇总成账单，勾选后可以下载 PDF 发给清洁公司核对，付完钱再标记已结算。</p>
      <div className="btn-row" style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted small">日期</span>
        <input type="date" value={dFrom} onChange={(e) => { setDFrom(e.target.value); if (dTo < e.target.value) setDTo(e.target.value) }} />
        <span className="muted small">到</span>
        <input type="date" value={dTo} onChange={(e) => { setDTo(e.target.value); if (dFrom > e.target.value) setDFrom(e.target.value) }} />
        <button className="ghost" onClick={() => { const r = monthRange(0); query(r[0], r[1]) }}>本月</button>
        <button className="ghost" onClick={() => { const r = monthRange(-1); query(r[0], r[1]) }}>上个月</button>
      </div>
      <div className="btn-row" style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={dCat} onChange={(e) => setDCat(e.target.value)}><option>全部</option><option>额外清洁</option><option>跑腿</option><option>其他</option></select>
        <select value={dSt} onChange={(e) => setDSt(e.target.value)}><option>全部</option><option>未结算</option><option>已结算</option></select>
        <button onClick={() => query()}>查询</button>
        <span className="muted small">清洁公司名称（显示在 PDF 上）</span>
        <input style={{ width: 120 }} value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      {msg && <p className="muted">{msg}</p>}
      {!shown.length ? <p className="muted pad">{from} 至 {to} 没有清洁公司费用。先到“款项明细”新增，类型选“清洁公司费用”。</p> : (
        <section className="card">
          <div className="title-row">
            <h3 style={{ margin: 0 }}>{shown.length} 笔 <span className="muted small">· 合计 {money(sum(shown))} · 未结算 <b>{money(sum(open))}</b>（{open.length} 笔）</span></h3>
            <span className="btn-row" style={{ margin: 0, alignItems: 'center' }}>
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" style={{ width: 18, height: 18, minHeight: 0 }} checked={picked.length === shown.length} onChange={(e) => toggle(shown.map((r) => r.id), e.target.checked)} />全选（已选 {picked.length} / {shown.length}）</label>
              <button className="ghost" disabled={busy || !picked.length} onClick={downloadPdf}>下载已选对账单 PDF{picked.length ? `（${picked.length}）` : ''}</button>
              <button className="ghost" disabled={!picked.length} onClick={exportCsv}>导出已选 CSV</button>
              <button disabled={busy || !picked.some((r) => !r.settled_at)} onClick={() => settle(picked.filter((r) => !r.settled_at).map((r) => r.id), true)}>标记已选为已结算</button>
            </span>
          </div>
          <div className="table-wrap" style={{ border: 0 }}>
            <table style={{ minWidth: 680 }}>
              <thead><tr><th style={{ width: 36 }} /><th>日期</th><th>房源</th><th>事项</th><th style={{ textAlign: 'right' }}>金额</th><th>结算</th><th /></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" style={{ width: 18, height: 18, minHeight: 0 }} checked={sel.has(r.id)} onChange={(e) => toggle([r.id], e.target.checked)} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.occurred_date.slice(5)}</td><td>{r.property?.name}</td><td>{text(r)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(abs(r.amount))}</td>
                  <td>{r.settled_at ? <span className="chip green" style={{ marginLeft: 0 }}>已结算</span> : <span className="chip amber" style={{ marginLeft: 0 }}>未结算</span>}</td>
                  <td className="btn-row" style={{ margin: 0 }}>
                    <button className="task-btn" onClick={() => nav('/company')}>去款项明细</button>
                    {r.settled_at && <button className="task-btn" disabled={busy} onClick={() => settle([r.id], false)}>取消结算</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
