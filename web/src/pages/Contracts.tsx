import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { chipOf } from '../lib/ui'
import { statusOf } from './Properties'

interface Row {
  id: number; name: string
  property_contracts: { water: string; power: string; gas: string; internet: string; recharge_back: string; end_date: string | null; base_status: '筹备中' | '运营中' } | null
}
export const daysTo = (d: string | null) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null)

export default function Contracts() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('properties').select('id, name, property_contracts(*)').eq('legacy', false).order('name').then(({ data }) => { setRows((data ?? []) as unknown as Row[]); setLoading(false) })
  }, [])
  if (loading) return <p className="muted">加载中…</p>
  return (
    <div>
      <h1>合同财务</h1>
      <p className="muted">新增房源的水电燃气网络由谁交费、合同到期日（从 Hostaway 同步来的历史房源不用登记，这里不显示）。要修改，请到“房源档案”里编辑。</p>
      <div className="table-wrap">
        <table style={{ minWidth: 860 }}>
          <thead><tr><th>房源</th><th>水</th><th>电</th><th>燃气</th><th>网络</th><th>代缴扣回</th><th>合同到期</th><th>状态</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const c = r.property_contracts, d = daysTo(c?.end_date ?? null), st = statusOf(c as never)
              return (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td><td>{c?.water ?? '—'}</td><td>{c?.power ?? '—'}</td><td>{c?.gas ?? '—'}</td><td>{c?.internet ?? '—'}</td><td>{c?.recharge_back ?? '—'}</td>
                  <td>{c?.end_date ?? '—'}{d !== null && d >= 0 && d <= 60 && <span className="chip amber">{d} 天后到期</span>}{d !== null && d < 0 && <span className="chip amber">已到期</span>}</td>
                  <td><span className={chipOf(st)}>{st}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted pad">还没有需要登记合同的新房源。</p>}
      </div>
    </div>
  )
}
