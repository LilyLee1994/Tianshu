import JSZip from 'jszip'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { coveredAssistantIds } from '../lib/cover'
import { money, today } from '../lib/ui'
import { signedUrls, uploadPhotos } from '../lib/photos'

const PAID: string[] = ['已赔付', '客人直接赔付']
const STATUSES = ['待提交', '联系客人中', '客人直接赔付', '已提交平台', '平台处理中', '已赔付', '被驳回', '放弃'] as const
const PLATFORMS = ['Airbnb', 'Booking.com', 'Terri Scheer', 'Turvi', '其他'] as const
const chip = (s: string) => (s === '已赔付' || s === '客人直接赔付' ? 'chip green' : s === '被驳回' || s === '放弃' ? 'chip gray' : s === '待提交' ? 'chip amber' : 'chip blue')

interface Claim {
  id: number; property_id: number; guest_name?: string | null; platform: string; occurred_date: string; content: string; claimed_amount: number | null
  status: (typeof STATUSES)[number]; paid_amount: number | null; paid_date: string | null; photos: string[]
  property: { name: string; assistant_id: string | null } | null; creator: { name: string } | null; created_by: string | null
}
interface Prop { id: number; name: string; assistant_id: string | null }

export default function Claims() {
  const { profile } = useAuth()
  const [cover, setCover] = useState<Set<string>>(new Set())
  useEffect(() => { if (profile?.role === 'assistant') coveredAssistantIds(profile.id).then(setCover) }, [profile?.id, profile?.role])
  const isAssistant = profile?.role === 'assistant'
  const [rows, setRows] = useState<Claim[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [status, setStatus] = useState('')
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const onlyProp = Number(sp.get('property')) || null
  const focusId = Number(sp.get('id')) || null
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [upd, setUpd] = useState<Claim | null>(null)
  const [evid, setEvid] = useState<Claim | null>(null)
  const [msg, setMsg] = useState('')
  const makeRepair = async (r: Claim) => {
    const tag = `【索赔#${r.id}】`
    const ex = await supabase.from('work_orders').select('id').eq('type', '维修').like('description', `${tag}%`).limit(1)
    if (ex.data?.length) { nav(`/orders?id=${ex.data[0].id}`); return }
    const { data, error } = await supabase.from('work_orders').insert({
      property_id: r.property_id, type: '维修', description: `${tag}${r.content.replace('【清洁上报损坏】', '')}`,
      status: '待派单', damage_photos: r.photos ?? [],
    }).select('id').single()
    if (error || !data) { setMsg(`生成失败：${error?.message ?? ''}`); return }
    nav(`/orders?id=${data.id}`)
  }

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('claims').select('*, property:properties(name, assistant_id), creator:profiles!created_by(name)').order('occurred_date', { ascending: false }).order('id', { ascending: false }).limit(1000),
      supabase.from('properties').select('id, name, assistant_id').order('name'),
    ])
    if (c.error) setMsg(`读取出错：${c.error.message}`)
    setRows((c.data ?? []) as never); setProps((p.data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => { if (focusId) document.getElementById(`cl-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [focusId, rows.length])
  const shown = useMemo(() => rows.filter((r) => {
    if (isAssistant && !(r.property?.assistant_id && cover.has(r.property.assistant_id))) return false
    if (onlyProp && r.property_id !== onlyProp) return false
    if (status && r.status !== status) return false
    if (q && !`${r.property?.name} ${r.guest_name ?? ''} ${r.content}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, isAssistant, status, q, profile, onlyProp, cover])

  const open = shown.filter((r) => ['待提交', '联系客人中', '已提交平台', '平台处理中'].includes(r.status)).length
  const paid = shown.filter((r) => PAID.includes(r.status)).reduce((a, r) => a + Number(r.paid_amount ?? 0), 0)

  return (
    <div>
      <div className="title-row"><h1>索赔</h1><button onClick={() => setAdding(true)}>+ 新增索赔</button></div>
      <p className="muted small">流程：清洁工上报损坏 → 客服联系客人（联系客人中）→ 客人愿意赔就记“客人直接赔付”，不愿意再整理证据提交平台。<b>已赔付 / 客人直接赔付的到账金额会自动进当月房东结算</b>，被驳回或放弃的不进。</p>
      {onlyProp && <p className="btn-row" style={{ alignItems: 'center' }}><span className="chip blue" style={{ marginLeft: 0 }}>只看：{props.find((x) => x.id === onlyProp)?.name ?? '这个房源'}</span><button className="ghost" onClick={() => setSp({})}>看全部房源</button></p>}
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="搜索房源或内容" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">跟进中 {open} 条 · 已到账 {money(paid)}</span>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="table-wrap">
        <table style={{ minWidth: 1040 }}>
          <thead><tr><th>日期</th><th>房源</th><th>入住人</th><th>平台</th><th>内容</th><th>发起人</th><th>申报金额</th><th>状态</th><th>到账金额</th><th></th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} id={`cl-${r.id}`} className={r.id === focusId ? 'focus-row' : undefined}>
              <td>{r.occurred_date.slice(5)}</td><td>{r.property?.name}</td><td>{r.guest_name || '—'}</td><td>{r.platform}</td>
              <td style={{ maxWidth: 280 }}>{r.content}</td><td>{r.creator?.name ?? '—'}</td>
              <td>{money(r.claimed_amount)}</td><td><span className={chip(r.status)} style={{ marginLeft: 0 }}>{r.status}</span></td>
              <td>{PAID.includes(r.status) ? <>{money(r.paid_amount)} <span className="muted small">{r.paid_date?.slice(5)}</span></> : '—'}</td>
              <td className="btn-row" style={{ margin: 0 }}>
                <button className="ghost" onClick={() => setUpd(r)}>更新状态</button>
                <button className="ghost" onClick={() => makeRepair(r)}>生成维修工单</button>
                <button className="ghost" onClick={() => setEvid(r)}>证据</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!shown.length && <p className="muted pad">还没有索赔记录。</p>}
      </div>

      {adding && <AddModal defaultProp={onlyProp} props={isAssistant ? props.filter((x) => !!x.assistant_id && cover.has(x.assistant_id)) : props} me={profile?.id ?? ''} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setMsg('已登记。'); load() }} />}
      {upd && <UpdateModal row={upd} onClose={() => setUpd(null)} onSaved={() => { setUpd(null); setMsg('已更新。'); load() }} />}
      {evid && <EvidenceModal claim={evid} onClose={() => setEvid(null)} />}
    </div>
  )
}

function AddModal({ props, me, defaultProp, onClose, onSaved }: { props: Prop[]; me: string; defaultProp: number | null; onClose: () => void; onSaved: () => void }) {
  const sorted = useMemo(() => [...props].sort((a, b) => Number(b.assistant_id === me) - Number(a.assistant_id === me) || a.name.localeCompare(b.name)), [props, me])
  const [f, setF] = useState({ property_id: defaultProp && props.some((x) => x.id === defaultProp) ? String(defaultProp) : '', platform: 'Airbnb', date: today(), guest: '', content: '', amount: '' })
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  type Resv = { id: number; guest_name: string | null; arrival_date: string; departure_date: string; channel_name: string | null; nights: number | null }
  const [resvs, setResvs] = useState<Resv[]>([])
  const [resvId, setResvId] = useState<number | null>(null)
  // 选了房源后，列出这套房最近一个月的订单（已经入住过的、一个月内退房的），勾选后自动填入住人、退房日和平台
  useEffect(() => {
    setResvs([]); setResvId(null)
    if (!f.property_id) return
    const t = today(), from = new Date(new Date(t).getTime() - 30 * 86400_000).toISOString().slice(0, 10)
    supabase.from('reservations').select('id, guest_name, arrival_date, departure_date, channel_name, nights')
      .eq('property_id', Number(f.property_id)).gte('departure_date', from).lte('arrival_date', t)
      .not('status', 'in', '(cancelled,declined,expired,inquiry,inquiryPreapproved,inquiryDenied,inquiryTimedout,inquiryNotPossible,ownerStay)')
      .order('departure_date', { ascending: false }).limit(30)
      .then(({ data }) => setResvs((data ?? []) as Resv[]))
  }, [f.property_id])
  const pickResv = (r: Resv) => {
    if (resvId === r.id) { setResvId(null); return }
    setResvId(r.id)
    const ch = (r.channel_name ?? '').toLowerCase()
    setF((x) => ({ ...x, guest: r.guest_name ?? x.guest, date: r.departure_date, platform: ch.includes('airbnb') ? 'Airbnb' : ch.includes('booking') ? 'Booking.com' : x.platform }))
  }
  const save = async () => {
    if (!f.property_id || !f.content.trim()) { setErr('请选房源并写清楚索赔内容。'); return }
    if (!f.guest.trim()) { setErr('请填入住人姓名。'); return }
    setBusy(true); setErr('')
    const body: Record<string, unknown> = {
      property_id: Number(f.property_id), guest_name: f.guest.trim(), platform: f.platform, occurred_date: f.date, content: f.content.trim(),
      claimed_amount: f.amount.trim() === '' ? null : Number(f.amount), created_by: me,
    }
    let { data, error } = await supabase.from('claims').insert(resvId ? { ...body, reservation_id: resvId } : body).select('id').single()
    if (error && resvId) ({ data, error } = await supabase.from('claims').insert(body).select('id').single())   // 还没运行 059 时，不记订单也要能保存
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
        {f.property_id && (
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>{resvs.length ? '这套房最近一个月的订单（勾选后自动填入住人、退房日和平台）' : '这套房最近一个月没有已入住的订单，可以直接手填下面的信息。'}</div>
            {resvs.map((r) => (
              <label key={r.id} className="check" style={{ marginBottom: 4 }}>
                <input type="checkbox" checked={resvId === r.id} onChange={() => pickResv(r)} />
                {r.guest_name || '（没有姓名）'} · {r.arrival_date.slice(5)} → {r.departure_date.slice(5)}{r.nights ? `（${r.nights} 晚）` : ''} · {r.channel_name ?? '—'}
              </label>
            ))}
          </div>
        )}
        <label>向谁索赔（平台或保险）<select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>发生日期（退房日）<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label>入住人姓名<input value={f.guest} onChange={(e) => setF({ ...f, guest: e.target.value })} placeholder="订单上的客人姓名" /></label>
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
  const isPaid = PAID.includes(status)
  const save = async () => {
    if (isPaid && (paid.trim() === '' || Number.isNaN(Number(paid)))) { setErr('已赔付 / 客人直接赔付，要填到账金额。'); return }
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

// 证据：入住前最近一次清洁照 + 入住后清洁照 + 清洁工上报的损坏照；可一键打包下载
function EvidenceModal({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  type Grp = { title: string; note?: string; paths: string[] }
  const [groups, setGroups] = useState<Grp[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      type W = { id: number; done_date: string | null; created_at: string; photos: string[] | null; damage_photos: string[] | null }
      let w: W | null = null
      const wid = (claim as unknown as { work_order_id?: number | null }).work_order_id
      if (wid) w = ((await supabase.from('work_orders').select('id, done_date, created_at, photos, damage_photos').eq('id', wid).maybeSingle()).data as W | null)
      const ref = w?.done_date ?? claim.occurred_date
      const prev = (await supabase.from('work_orders').select('id, done_date, photos').eq('property_id', claim.property_id).eq('type', '清洁').eq('status', '已完成')
        .lt('done_date', ref).order('done_date', { ascending: false }).limit(5)).data as { id: number; done_date: string; photos: string[] | null }[] | null
      const before = (prev ?? []).find((x) => x.id !== w?.id && (x.photos?.length ?? 0) > 0)
      const g: Grp[] = []
      g.push({ title: '入住前最近一次清洁', note: before ? `${before.done_date} 清洁完成` : '没有找到入住前的清洁照片', paths: before?.photos ?? [] })
      g.push({ title: '清洁工上报的损坏照', paths: (w?.damage_photos?.length ? w.damage_photos : claim.photos) ?? [] })
      setGroups(g)
      const all = g.flatMap((x) => x.paths)
      const u = await signedUrls(all)
      setUrls(Object.fromEntries(all.map((p, i) => [p, u[i]])))
    })()
  }, [claim])

  const total = (groups ?? []).reduce((n, g) => n + g.paths.length, 0)
  const download = async () => {
    setBusy(true); setErr('')
    try {
            const zip = new JSZip()
      let n = 0
      for (const g of groups ?? []) {
        const f = zip.folder(g.title)!
        let i = 0
        for (const p of g.paths) {
          const u = urls[p]; if (!u) continue
          const r = await fetch(u)
          if (!r.ok) throw new Error(`有照片下载失败（${r.status}），请关掉重开再试。`)
          f.file(`${++i}.jpg`, await r.blob()); n++
        }
      }
      if (!n) throw new Error('没有可下载的照片。')
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `索赔证据-${(claim.property?.name ?? '').replace(/[\\/:*?"<>|]/g, ' ')}-${claim.occurred_date}.zip`; a.click(); URL.revokeObjectURL(a.href)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
        <h2>证据照片 · {claim.property?.name}{claim.guest_name ? ` · ${claim.guest_name}` : ''}</h2>
        <p className="muted small">提交平台需要：入住前的清洁照 + 清洁工上报的损坏照。</p>
        {!groups && <p className="muted">加载中…</p>}
        {(groups ?? []).map((g) => (
          <div key={g.title} style={{ marginBottom: 12 }}>
            <b>{g.title}</b> <span className="muted small">{g.note ?? ''}{g.paths.length ? `（${g.paths.length} 张）` : ''}</span>
            <div className="pics">{g.paths.map((p) => urls[p] && <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} /></a>)}{!g.paths.length && <p className="muted small">暂无</p>}</div>
          </div>
        ))}
        {err && <p className="err">{err}</p>}
        <div className="btn-row">
          <button onClick={download} disabled={busy || !total}>{busy ? '打包中…' : `一键下载全部（${total} 张）`}</button>
          <button className="ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
