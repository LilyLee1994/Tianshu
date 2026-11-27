import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { chipOf, money, today } from '../lib/ui'
import { signedUrls } from '../lib/photos'

type OType = '清洁' | '维修' | '除草' | '除虫'
interface Order {
  id: number; property_id: number; type: OType; executor: string | null; description: string | null
  assigned_to: string | null; vendor_name: string | null; planned_date: string | null; done_date: string | null
  status: string; amount: number | null; payer: string; owner_notified: boolean; urgent: boolean; created_at: string
  photos: string[]; damage_photos: string[]; damage_report: string | null; damage_handled?: boolean; property_id?: number
  property: { name: string } | null; worker: { name: string } | null
}
interface Worker { id: string; name: string; role: string }
interface Prop { id: number; name: string }

export const flowOf = (type: OType, exec: string | null) => {
  if (type === '清洁') return ['待派单', '已派单', '已完成']
  if ((type === '除草' || type === '除虫') && exec === '房东自己') return ['待通知房东', '已通知房东', '房东已完成', '已完成']
  if (type === '除草' || type === '除虫') return ['待派单', '已派单', '待确认费用', '已完成']
  return ['待派单', '已派单', '已接单', '待确认费用', '已完成']
}
const FILTERS = ['全部', '清洁', '维修', '除草', '除虫']

export default function Orders() {
  const [rows, setRows] = useState<Order[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [filter, setFilter] = useState('全部')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [o, w, p] = await Promise.all([
      supabase.from('work_orders').select('*, property:properties(name), worker:profiles!assigned_to(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, role').in('role', ['repairman', 'cleaner']).eq('active', true),
      supabase.from('properties').select('id, name').order('name'),
    ])
    if (o.error) setErr(o.error.message); else setRows(o.data as unknown as Order[])
    if (w.data) setWorkers(w.data as Worker[])
    if (p.data) setProps(p.data as Prop[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const update = async (id: number, patch: Record<string, unknown>, ok: string) => {
    setErr(''); setMsg('')
    const { data, error } = await supabase.from('work_orders').update(patch).eq('id', id).select('id')
    if (error || !data?.length) { setErr(error?.message ?? '没有权限：只有这个房源的主责助理、管理员、运营和财务能改这张工单。'); return }
    setMsg(ok); load()
  }

  const list = rows.filter((r) => filter === '全部' || r.type === filter)
  if (loading) return <p className="muted">加载中…</p>

  return (
    <div>
      <div className="title-row"><h1>工单</h1><button className="primary small-btn" onClick={() => setAdding(true)}>＋ 新建工单</button></div>
      <div className="pills">{FILTERS.map((f) => <button key={f} className={f === filter ? 'pill on' : 'pill'} onClick={() => setFilter(f)}>{f}</button>)}</div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err-box">{err}</div>}
      <div className="table-wrap">
        <table style={{ minWidth: 980 }}>
          <thead><tr><th>日期</th><th>房源</th><th>类型</th><th>内容</th><th>执行</th><th>状态</th><th>费用</th><th>操作</th></tr></thead>
          <tbody>
            {list.map((o) => <OrderRow key={o.id} o={o} workers={workers} onUpdate={update} />)}
          </tbody>
        </table>
        {!list.length && <p className="muted pad">还没有工单。</p>}
      </div>
      {adding && <AddOrder props={props} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setMsg('已新建工单。'); load() }} />}
    </div>
  )
}

function OrderRow({ o, workers, onUpdate }: { o: Order; workers: Worker[]; onUpdate: (id: number, patch: Record<string, unknown>, ok: string) => void }) {
  const flow = flowOf(o.type, o.executor)
  const idx = flow.indexOf(o.status)
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : ''
  const nav = useNavigate()
  const [pick, setPick] = useState('')
  const [vendor, setVendor] = useState('')
  const [amt, setAmt] = useState(o.amount?.toString() ?? '')
  const [pics, setPics] = useState<string[] | null>(null)
  const showPics = async () => setPics(await signedUrls([...(o.damage_photos ?? []), ...(o.photos ?? [])]))
  const nPics = (o.photos?.length ?? 0) + (o.damage_photos?.length ?? 0)
  const [payer, setPayer] = useState(o.payer)
  const need = o.type === '清洁' ? 'cleaner' : 'repairman'
  const cands = workers.filter((w) => w.role === need)
  const who = o.worker?.name ?? o.vendor_name ?? o.executor ?? '—'

  let action: React.ReactNode = null
  if (o.status === '待派单') {
    action = (
      <span className="btn-row" style={{ margin: 0 }}>
        {o.type === '除草' || o.type === '除虫'
          ? <input style={{ minHeight: 36, width: 120 }} placeholder="师傅/公司名" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          : <select style={{ minHeight: 36 }} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">选{o.type === '清洁' ? '清洁公司' : '维修师傅'}</option>{cands.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
        <button className="ghost" disabled={!pick && !vendor.trim()} onClick={() => onUpdate(o.id, pick ? { assigned_to: pick, status: next } : { vendor_name: vendor.trim(), status: next }, '已派单。')}>派单 →</button>
      </span>
    )
  } else if (o.status === '待确认费用') {
    action = (
      <span className="btn-row" style={{ margin: 0 }}>
        <input style={{ minHeight: 36, width: 80 }} placeholder="金额" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <select style={{ minHeight: 36 }} value={payer} onChange={(e) => setPayer(e.target.value)}><option>待定</option><option>公司</option><option>房东</option></select>
        <button className="ghost" disabled={!amt.trim() || payer === '待定'} onClick={() => onUpdate(o.id, { amount: Number(amt), payer, status: '已完成', done_date: today() }, '费用已确认，工单完成。')}>确认费用</button>
      </span>
    )
  } else if (o.type === '清洁' && next === '已完成') {
    action = <span className="muted small">等清洁公司提交照片</span>
  } else if (next) {
    action = <button className="ghost" onClick={() => onUpdate(o.id, { status: next, ...(next === '已完成' ? { done_date: today() } : {}) }, `已更新为“${next}”。`)}>→ {next}</button>
  }

  return (
    <tr>
      <td>{o.created_at.slice(5, 10).replace('-', '/')}</td>
      <td><b>{o.property?.name}</b>{o.urgent && <span className="chip amber">次日入住</span>}</td>
      <td>{o.type}</td><td>{o.description ?? '—'}{o.damage_report && (o.damage_handled
        ? <div className="muted small">清洁上报损坏（已处理）：{o.damage_report}</div>
        : <div className="err small">⚠ 清洁上报损坏：{o.damage_report}
            <div className="btn-row" style={{ margin: '6px 0 0' }}>
              <button className="task-btn" onClick={() => nav(`/claims?property=${o.property_id}`)}>去提索赔</button>
              <button className="task-btn" onClick={() => onUpdate(o.id, { damage_handled: true }, '已标记为已处理。')}>已处理</button>
            </div></div>)}</td><td>{who}</td>
      <td><span className={chipOf(o.status)}>{o.status}</span></td>
      <td>{o.type === '清洁' ? '—' : `${money(o.amount)}（${o.payer}）`}</td>
      <td>{action}{nPics > 0 && <button className="ghost" onClick={showPics}>看照片（{nPics}）</button>}
        {pics && <div className="modal-bg" onClick={() => setPics(null)}><div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}><h2>{o.property?.name} · 照片</h2><div className="pics">{pics.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} /></a>)}{!pics.length && <p className="muted">照片加载失败。</p>}</div><button className="ghost" onClick={() => setPics(null)}>关闭</button></div></div>}
      </td>
    </tr>
  )
}

function AddOrder({ props, onClose, onSaved }: { props: Prop[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ property_id: '', type: '维修' as OType, description: '', executor: '公司派人', planned_date: '', urgent: false, owner_notified: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!f.property_id) { setErr('请选房源。'); return }
    if (!f.description.trim()) { setErr('请写一下内容。'); return }
    const lawn = f.type === '除草' || f.type === '除虫'
    const executor = lawn ? f.executor : null
    setBusy(true); setErr('')
    const { error } = await supabase.from('work_orders').insert({
      property_id: Number(f.property_id), type: f.type, description: f.description.trim(), executor,
      planned_date: f.planned_date || null, urgent: f.urgent, owner_notified: f.type === '维修' ? f.owner_notified : false,
      status: flowOf(f.type, executor)[0],
    })
    setBusy(false)
    if (error) { setErr(`保存失败：${error.message}`); return }
    onSaved()
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>新建工单</h2>
        <label>房源<select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}><option value="">请选择</option>{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>类型<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as OType })}><option>维修</option><option>清洁</option><option>除草</option><option>除虫</option></select></label>
        {(f.type === '除草' || f.type === '除虫') && <label>谁来做<select value={f.executor} onChange={(e) => setF({ ...f, executor: e.target.value })}><option>公司派人</option><option>房东自己</option></select></label>}
        <label>内容<textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label>计划日期（选填）<input type="date" value={f.planned_date} onChange={(e) => setF({ ...f, planned_date: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} />次日有客人入住（紧急）</label>
        {f.type === '维修' && <label className="check"><input type="checkbox" checked={f.owner_notified} onChange={(e) => setF({ ...f, owner_notified: e.target.checked })} />已经通知房东</label>}
        {err && <div className="err">{err}</div>}
        <div className="btn-row"><button className="primary small-btn" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
