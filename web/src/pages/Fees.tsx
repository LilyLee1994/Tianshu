import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { money, today } from '../lib/ui'

interface Fee { id: number; property_id: number; standard_fee: number; deep_fee: number; guest_fee: number; effective_date: string }
interface Prop { id: number; name: string }

export default function Fees() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'finance'
  const [props, setProps] = useState<Prop[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [editing, setEditing] = useState<Prop | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([
      supabase.from('properties').select('id, name').order('name'),
      supabase.from('cleaning_fees').select('*').order('effective_date', { ascending: false }),
    ])
    if (p.data) setProps(p.data as Prop[])
    if (f.data) setFees(f.data as Fee[])
  }, [])
  useEffect(() => { load() }, [load])

  const latest = (pid: number) => fees.find((f) => f.property_id === pid)

  return (
    <div>
      <h1>清洁费</h1>
      <p className="muted">按房源记录付给清洁公司的价格和向客人收取的价格。改价会新增一条生效日期，旧价格保留作历史。{canEdit ? '' : '只有管理员和财务能改价。'}</p>
      {msg && <div className="ok">{msg}</div>}
      <div className="table-wrap">
        <table style={{ minWidth: 800 }}>
          <thead><tr><th>房源</th><th>付清洁公司：普通</th><th>付清洁公司：深度</th><th>向客人收取</th><th>差额（收 − 付普通）</th><th>生效日期</th><th></th></tr></thead>
          <tbody>
            {props.map((p) => {
              const f = latest(p.id)
              return (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td>{f ? money(f.standard_fee) : '—'}</td><td>{f ? money(f.deep_fee) : '—'}</td><td>{f ? money(f.guest_fee) : '—'}</td>
                  <td>{f ? money(f.guest_fee - f.standard_fee) : '—'}</td><td>{f?.effective_date ?? '未设置'}</td>
                  <td>{canEdit && <button className="ghost" onClick={() => setEditing(p)}>{f ? '改价' : '设置'}</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!props.length && <p className="muted pad">还没有房源。</p>}
      </div>
      {editing && <EditFee prop={editing} cur={latest(editing.id)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg('已保存。'); load() }} />}
    </div>
  )
}

function EditFee({ prop, cur, onClose, onSaved }: { prop: Prop; cur?: Fee; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ std: cur?.standard_fee?.toString() ?? '', deep: cur?.deep_fee?.toString() ?? '', guest: cur?.guest_fee?.toString() ?? '', eff: today() })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    const [a, b, c] = [f.std, f.deep, f.guest].map(Number)
    if ([a, b, c].some((x) => Number.isNaN(x) || x < 0) || !f.std || !f.deep || !f.guest) { setErr('三个价格都要填数字。'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('cleaning_fees').upsert(
      { property_id: prop.id, standard_fee: a, deep_fee: b, guest_fee: c, effective_date: f.eff },
      { onConflict: 'property_id,effective_date' })
    setBusy(false)
    if (error) { setErr(`保存失败：${error.message}`); return }
    onSaved()
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{prop.name} · 清洁费</h2>
        <label>付清洁公司：普通清洁（$）<input value={f.std} onChange={(e) => setF({ ...f, std: e.target.value })} /></label>
        <label>付清洁公司：深度清洁（$）<input value={f.deep} onChange={(e) => setF({ ...f, deep: e.target.value })} /></label>
        <label>向客人收取（$）<input value={f.guest} onChange={(e) => setF({ ...f, guest: e.target.value })} /></label>
        <label>生效日期<input type="date" value={f.eff} onChange={(e) => setF({ ...f, eff: e.target.value })} /></label>
        {err && <div className="err">{err}</div>}
        <div className="btn-row"><button className="primary small-btn" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
