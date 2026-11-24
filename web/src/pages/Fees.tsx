import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { money, today } from '../lib/ui'
import * as XLSX from 'xlsx'

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
      <StandardCheck isAdmin={profile?.role === 'admin'} />
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

// ====== 标准清洁费 vs Hostaway 订单里的实际清洁费 ======
interface Std { property_id: number; std_clean_airbnb: number | null; std_clean_alisa: number | null; std_clean_guests: number | null; std_clean_sofa: boolean | null }
interface Res { property_id: number; cleaning_fee: number | null; status: string | null }
const norm = (x: unknown) => String(x ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
const DEAD = /cancel|declin|expire|inquir|void|reject/i
const DAYS = 120

function StandardCheck({ isAdmin }: { isAdmin: boolean }) {
  const [props, setProps] = useState<{ id: number; name: string; cleaning_by: string }[]>([])
  const [std, setStd] = useState<Map<number, Std>>(new Map())
  const [res, setRes] = useState<Res[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [onlyBad, setOnlyBad] = useState(true)
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10)
    const [p, d, r] = await Promise.all([
      supabase.from('properties').select('id, name, cleaning_by').order('name').limit(2000),
      supabase.from('property_details').select('property_id, std_clean_airbnb, std_clean_alisa, std_clean_guests, std_clean_sofa').limit(2000),
      supabase.from('reservations').select('property_id, cleaning_fee, status').gte('arrival_date', since).limit(10000),
    ])
    if (d.error) { setMsg(`读取出错：${d.error.message}（是否已运行 026 迁移？）`); return }
    setProps((p.data ?? []) as never)
    setStd(new Map(((d.data ?? []) as Std[]).map((x) => [x.property_id, x])))
    setRes((r.data ?? []) as Res[])
  }, [])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const by = new Map<number, Res[]>()
    for (const r of res) if (!DEAD.test(r.status ?? '')) (by.get(r.property_id) ?? by.set(r.property_id, []).get(r.property_id)!).push(r)
    return props.map((p) => {
      const s = std.get(p.id)
      const a = s?.std_clean_airbnb ?? null, l = s?.std_clean_alisa ?? null
      const list = by.get(p.id) ?? []
      const cnt = new Map<number, number>()
      for (const r of list) { const v = Number(r.cleaning_fee) || 0; cnt.set(v, (cnt.get(v) ?? 0) + 1) }
      const ok = (v: number) => (a != null && Math.abs(v - a) < 0.5) || (l != null && Math.abs(v - l) < 0.5)
      const bad = [...cnt.entries()].filter(([v]) => !ok(v)).reduce((n, [, c]) => n + c, 0)
      const actual = [...cnt.entries()].sort((x, y) => y[1] - x[1]).map(([v, c]) => `${v}×${c}`).join('、')
      const status = a == null && l == null ? '没有标准' : !list.length ? '近期无订单' : bad ? '不一致' : '一致'
      return { p, a, l, n: list.length, bad, actual, status }
    })
  }, [props, std, res])

  const nBad = rows.filter((r) => r.status === '不一致').length
  const nNone = rows.filter((r) => r.status === '没有标准').length
  const shown = rows.filter((r) => (onlyBad ? r.status === '不一致' : true))

  const onFile = async (f: File) => {
    setBusy(true); setMsg('')
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames.find((n) => { const a = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: '' }); return a.slice(0, 5).some((r) => (r as unknown[]).includes('Listing')) }) ?? '']
      if (!ws) { setMsg('没有找到带 Listing 列的表。'); setBusy(false); return }
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const hi = aoa.findIndex((r) => r.includes('Listing'))
      const H = aoa[hi] as string[]
      const col = (k: string) => H.findIndex((h) => String(h).trim().toUpperCase() === k)
      const cL = col('LISTING'), cG = H.findIndex((h) => String(h).includes('入住人数')), cS = H.findIndex((h) => String(h).includes('sofa')), cA = col('AIRBNB'), cB = col('ALISA')
      const { data: ps } = await supabase.from('properties').select('id, name').limit(2000)
      const byName = new Map((ps ?? []).map((x) => [norm(x.name), x.id as number]))
      const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null)
      let ok = 0, own = 0
      const miss: string[] = []
      for (const r of aoa.slice(hi + 1)) {
        const name = String(r[cL] ?? '').trim()
        if (!name) continue
        const pid = byName.get(norm(name))
        if (!pid) { miss.push(name); continue }
        const a = num(r[cA]), l = num(r[cB])
        const patch = { std_clean_airbnb: a, std_clean_alisa: l, std_clean_guests: num(r[cG]), std_clean_sofa: r[cS] === 'Y' ? true : r[cS] === 'N' ? false : null }
        const { error } = await supabase.from('property_details').upsert({ property_id: pid, ...patch }, { onConflict: 'property_id' })
        if (error) { setMsg(`写入 ${name} 失败：${error.message}（是否已运行 026 迁移？）`); setBusy(false); return }
        ok++
        if (r.some((x) => typeof x === 'string' && x.includes('房东自己'))) { await supabase.from('properties').update({ cleaning_by: '房东自己' }).eq('id', pid); own++ }
      }
      setMsg(`导入了 ${ok} 个房源的标准清洁费${own ? `，其中 ${own} 个标记为“房东自己清洁”` : ''}。${miss.length ? `系统里找不到这 ${miss.length} 个：${miss.join('、')}` : ''}`)
      await load()
    } catch (e) { setMsg(`读取失败：${(e as Error).message}`) }
    setBusy(false)
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="title-row">
        <h3 style={{ margin: 0 }}>标准清洁费 vs Hostaway 实际（近 {DAYS} 天订单）</h3>
        <span className="btn-row" style={{ margin: 0 }}>
          {isAdmin && <label className="ghost" style={{ cursor: 'pointer' }}>{busy ? '导入中…' : '导入清洁费表'}<input type="file" accept=".xlsx,.xls" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} /></label>}
          <button className="ghost" onClick={() => setOpen(!open)}>{open ? '收起' : '展开'}</button>
        </span>
      </div>
      <p className="muted small">每个房源存了表里的 AIRBNB、ALISA 两个金额。订单的清洁费如果和这两个都对不上，就算“不一致”。取消和未成交的订单不算。已经 {rows.length - nNone} 个房源有标准，{nNone} 个还没有。</p>
      {msg && <p className="muted">{msg}</p>}
      {open && <>
        <p><b style={{ color: nBad ? '#b3261e' : undefined }}>{nBad}</b> 个房源不一致　<label className="small"><input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> 只看不一致</label></p>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="tight" style={{ width: 'auto', minWidth: 0 }}>
            <thead><tr><th>房源</th><th>标准 AIRBNB</th><th>标准 ALISA</th><th>Hostaway 实际（金额×单数）</th><th>订单数</th><th>对不上</th><th>结果</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.p.id}>
                <td><b>{r.p.name}</b>{r.p.cleaning_by === '房东自己' && <span className="muted small"> 房东自己清洁</span>}</td>
                <td>{r.a ?? '—'}</td><td>{r.l ?? '—'}</td><td className="small">{r.actual || '—'}</td><td>{r.n}</td><td>{r.bad || ''}</td>
                <td><span className={r.status === '不一致' ? 'chip amber' : r.status === '一致' ? 'chip green' : 'chip gray'}>{r.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
          {!shown.length && <p className="muted pad">{onlyBad ? '没有不一致的房源。' : '没有数据。'}</p>}
        </div>
      </>}
    </section>
  )
}
