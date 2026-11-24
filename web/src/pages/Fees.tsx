import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/ui'

interface Fee { id: number; property_id: number; standard_fee: number | null; deep_fee: number | null; guest_fee: number | null; effective_date: string }
interface Prop { id: number; name: string; cleaning_by: string }
const WHO = (v: string) => (v === '房东自己' ? '房东自己' : 'Alisa')

// 只读记录：向客人收取的价格随 Hostaway 自动更新（每天同步时，有变化就记一条新的生效日期，旧的保留作历史）；
// 付 Alisa 的价格来自导入的清洁费表。
export default function Fees() {
  const [props, setProps] = useState<Prop[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [q, setQ] = useState('')
  const [hist, setHist] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([
      supabase.from('properties').select('id, name, cleaning_by').order('name').limit(2000),
      supabase.from('cleaning_fees').select('*').order('effective_date', { ascending: false }).limit(10000),
    ])
    if (p.data) setProps(p.data as Prop[])
    if (f.data) setFees(f.data as Fee[])
  }, [])
  useEffect(() => { load() }, [load])

  const latest = useMemo(() => { const m = new Map<number, Fee>(); for (const f of fees) if (!m.has(f.property_id)) m.set(f.property_id, f); return m }, [fees])
  const shown = props.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  const n = shown.filter((p) => latest.has(p.id)).length

  return (
    <div>
      <div className="title-row"><h1>清洁费</h1><input placeholder="搜索房源" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="muted small">这里只做记录。“向客人收取”随 Hostaway 自动更新：每天同步时，如果某个房源最近订单的清洁费变了，就记一条新的，旧的保留；“付 Alisa”来自清洁费表。点房源名可以看价格变化的历史。已有 {n} / {shown.length} 个房源有记录。</p>
      <div className="table-wrap">
        <table className="tight" style={{ width: 'auto', minWidth: 0 }}>
          <thead><tr><th>房源</th><th>谁清洁</th><th>付 Alisa</th><th>向客人收取</th><th>差额（收 − 付）</th><th>最近变化</th></tr></thead>
          <tbody>
            {shown.map((p) => {
              const f = latest.get(p.id)
              const mine = fees.filter((x) => x.property_id === p.id)
              return (
                <>
                  <tr key={p.id}>
                    <td><b style={{ cursor: mine.length > 1 ? 'pointer' : undefined }} onClick={() => mine.length > 1 && setHist(hist === p.id ? null : p.id)}>{p.name}</b></td>
                    <td>{WHO(p.cleaning_by)}</td>
                    <td>{p.cleaning_by === '房东自己' ? '—' : f ? money(f.standard_fee) : '—'}</td>
                    <td>{f ? money(f.guest_fee) : '—'}</td>
                    <td>{f && f.guest_fee != null && f.standard_fee != null && p.cleaning_by !== '房东自己' ? money(f.guest_fee - f.standard_fee) : '—'}</td>
                    <td className="muted small">{f?.effective_date ?? '—'}</td>
                  </tr>
                  {hist === p.id && <tr key={`${p.id}h`}><td colSpan={6} className="small" style={{ background: '#faf8f2' }}>
                    {mine.map((x) => <div key={x.id}>{x.effective_date}　向客人收 {money(x.guest_fee)}　付 Alisa {money(x.standard_fee)}</div>)}
                  </td></tr>}
                </>
              )
            })}
          </tbody>
        </table>
        {!shown.length && <p className="muted pad">没有房源。</p>}
      </div>
    </div>
  )
}
