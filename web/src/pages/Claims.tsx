import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { money, today } from '../lib/ui'
import { signedUrls, uploadPhotos } from '../lib/photos'

const STATUSES = ['待提交', '已提交平台', '平台处理中', '已赔付', '被驳回', '放弃'] as const
const PLATFORMS = ['Airbnb', 'Booking.com', '其他'] as const
const chip = (s: string) => (s === '已赔付' ? 'chip green' : s === '被驳回' || s === '放弃' ? 'chip gray' : s === '待提交' ? 'chip amber' : 'chip blue')

interface Claim {
  id: number; property_id: number; platform: string; occurred_date: string; content: string; claimed_amount: number | null
  status: (typeof STATUSES)[number]; paid_amount: number | null; paid_date: string | null; photos: string[]
  property: { name: string } | null; creator: { name: string } | null; created_by: string | null
}
interface Prop { id: number; name: string; assistant_id: string | null }

export default function Claims() {
  const { profile } = useAuth()
  const isAssistant = profile?.role === 'assistant'
  const [rows, setRows] = useState<Claim[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [mine, setMine] = useState(isAssistant)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [upd, setUpd] = useState<Claim | null>(null)
  const [pics, setPics] = useState<string[] | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('claims').select('*, property:properties(name), creator:profiles!created_by(name)').order('occurred_date', { ascending: false }).order('id', { ascending: false }).limit(1000),
      supabase.from('properties').select('id, name, assistant_id').order('name'),
    ])
    if (c.error) setMsg(`读取出错：${c.error.message}`)
    setRows((c.data ?? []) as never); setProps((p.data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => rows.filter((r) => {
    if (mine && r.created_by !== profile?.id) return false
    if (status && r.status !== status) return false
    if (q && !`${r.property?.name} ${r.content}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, mine, status, q, profile])

  const open = shown.filter((r) => ['待提交', '已提交平台', '平台处理中'].includes(r.status)).length
  const paid = shown.filter((r) => r.status === '已赔付').reduce((a, r) => a + Number(r.paid_amount ?? 0), 0)

  return (
    <div>
      <div className="title-row"><h1>索赔</h1><button onClick={() => setAdding(true)}>+ 新增索赔</button></div>
      <p className="muted small">客服在平台上发起索赔后，在这里记一条；跟进人定期查看平台结果，更新状态并填到账金额。<b>已赔付的到账金额会自动进当月房东结算</b>，被驳回或放弃的不进。</p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        {isAssistant && <>
          <button className={mine ? 'pill on' : 'pill'} onClick={() => setMine(true)}>我发起的</button>
          <button className={!mine ? 'pill on' : 'pill'} onClick={() => setMine(false)}>全部</button>
        </>}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="搜索房源或内容" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">跟进中 {open} 条 · 已到账 {money(paid)}</span>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="table-wrap">
        <table style={{ minWidth: 960 }}>
          <thead><tr><th>日期</th><th>房源</th><th>平台</th><th>内容</th><th>发起人</th><th>申报金额</th><th>状态</th><th>到账金额</th><th></th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id}>
              <td>{r.occurred_date.slice(5)}</td><td>{r.property?.name}</td><td>{r.platform}</td>
              <td style={{ maxWidth: 280 }}>{r.content}</td><td>{r.creator?.name ?? '—'}</td>
              <td>{money(r.claimed_amount)}</td><td><span className={chip(r.status)} style={{ marginLeft: 0 }}>{r.status}</span></td>
              <td>{r.status === '已赔付' ? <>{money(r.paid_amount)} <span className="muted small">{r.paid_date?.slice(5)}</span></> : '—'}</td>
              <td className="btn-row" style={{ margin: 0 }}>
                <button className="ghost" onClick={() => setUpd(r)}>更新状态</button>
                {r.photos?.length > 0 && <button className="ghost" onClick={async () => setPics(await signedUrls(r.photos))}>证据</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!shown.length && <p className="muted pad">还没有索赔记录。</p>}
      </div>

      {adding && <AddModal props={props} me={profile?.id ?? ''} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setMsg('已登记。'); load() }} />}
      {upd && <UpdateModal row={upd} onClose={() => setUpd(null)} onSaved={() => { setUpd(null); setMsg('已更新。'); load() }} />}
      {pics && (
        <div className="modal-bg" onClick={() => setPics(null)}>
          <div className="modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2>证据照片</h2>
            {pics.length ? pics.map((u) => <img key={u} src={u} style={{ maxWidth: '100%', borderRadius: 8 }} />) : <p className="muted">照片读取失败。</p>}
            <button className="ghost" onClick={() => setPics(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddModal({ props, me, onClose, onSaved }: { props: Prop[]; me: string; onClose: () => void; onSaved: () => void }) {
  const sorted = useMemo(() => [...props].sort((a, b) => Number(b.assistant_id === me) - Number(a.assistant_id === me) || a.name.localeCompare(b.name)), [props, me])
  const [f, setF] = useState({ property_id: '', platform: 'Airbnb', date: today(), content: '', amount: '' })
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!f.property_id || !f.content.trim()) { setErr('请选房源并写清楚索赔内容。'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('claims').insert({
      property_id: Number(f.property_id), platform: f.platform, occurred_date: f.date, content: f.content.trim(),
      claimed_amount: f.amount.trim() === '' ? null : Number(f.amount), created_by: me,
    }).select('id').single()
    if (error || !data) { setBusy(false); setErr(error?.message ?? '保存失败'); return }
    if (files.length) {
      try {
        const paths = await uploadPhotos(`claim-${data.id}`, files)
        await supabase.from('claims').update({ photos: paths }).eq('id', data.id)
      } catch (e) { setBusy(false); setErr(`索赔已登记，但照片上传失败：${(e as Error).message}`); return }
    }
    setBusy(false); onSaved()
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>新增索赔</h2>
        <label>房源<select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}><option value="">请选择</option>{sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>向哪个平台索赔<select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>发生日期（退房日）<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label>索赔内容<input value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="例如：客人损坏沙发垫" /></label>
        <label>申报金额（$）<input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label>证据照片（可选，可多张）<input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} /></label>
        {err && <div className="err">{err}</div>}
        <div className="btn-row"><button disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}

function UpdateModal({ row, onClose, onSaved }: { row: Claim; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string>(row.status)
  const [paid, setPaid] = useState(row.paid_amount != null ? String(row.paid_amount) : '')
  const [date, setDate] = useState(row.paid_date ?? today())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isPaid = status === '已赔付'
  const save = async () => {
    if (isPaid && (paid.trim() === '' || Number.isNaN(Number(paid)))) { setErr('已赔付要填到账金额。'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('claims').update({
      status, paid_amount: isPaid ? Number(paid) : null, paid_date: isPaid ? date : null, updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{row.property?.name} · 更新索赔</h2>
        <p className="muted small">{row.content}（申报 {money(row.claimed_amount)}）</p>
        <label>状态<select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        {isPaid && <>
          <label>到账金额（$）<input value={paid} onChange={(e) => setPaid(e.target.value)} /></label>
          <label>到账日期（决定进哪个月的房东结算）<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </>}
        {err && <div className="err">{err}</div>}
        <div className="btn-row"><button disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
