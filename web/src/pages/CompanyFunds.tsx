import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { coveredAssistantIds } from '../lib/cover'
import { today } from '../lib/ui'

const PLATFORMS = ['Airbnb', 'Booking.com', 'Vrbo', 'Terri Scheer', 'Turvi', '直订', '线下', '其他']
const KINDS = ['收款', '押金收取', '线下转账', '退款', '协商退款', '清洁问题退款', '押金退还', '线下转出', '平台扣款', '赔付房东', '垫付费用']
const OUT_KINDS = ['退款', '协商退款', '清洁问题退款', '押金退还', '线下转出', '平台扣款', '赔付房东', '垫付费用']  // 这几种是支出，金额存成负数
const EFFECTS = ['无', '补房东', '扣房东']
const CATS = ['房费', '清洁费', '早入住', '晚退房', '加人/加晚', '延长入住', '取消订单', '投诉补偿', '预防差评', '删差评', '清洁问题', '钥匙/门禁', '房东报销', '索赔', '押金', '其他']
const PAYERS = ['公司', '房东', '清洁公司', '客人', '平台', '无责任']
const m = (n: number) => `$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Row {
  id: number; property_id: number; occurred_date: string; platform: string; order_ref: string | null; guest_name: string | null
  check_in: string | null; check_out: string | null; kind: string; category: string; amount: number; reason: string | null
  payer: string | null; affects_owner: boolean; owner_effect: string; reconciled: boolean; claim_id?: number | null
  property: { name: string; assistant_id: string | null } | null
}
interface Prop { id: number; name: string; assistant_id: string | null }

export default function CompanyFunds() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const isAssistant = profile?.role === 'assistant'
  const isAdmin = profile?.role === 'admin'
  const canReconcile = isAdmin || profile?.role === 'finance'
  const [cover, setCover] = useState<Set<string>>(new Set())
  useEffect(() => { if (isAssistant && profile) coveredAssistantIds(profile.id).then(setCover) }, [profile?.id, isAssistant]) // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<Row[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [platform, setPlatform] = useState('')
  const [kind, setKind] = useState('')
  const [rec, setRec] = useState('')
  const [q, setQ] = useState('')
  // 上面填的是“条件”，点“搜索”才生效（回车也行）
  const [ap, setAp] = useState({ from: '', to: '', platform: '', kind: '', rec: '', q: '' })
  const doSearch = () => setAp({ from, to, platform, kind, rec, q })
  const reset = () => { setFrom(''); setTo(''); setPlatform(''); setKind(''); setRec(''); setQ(''); setAp({ from: '', to: '', platform: '', kind: '', rec: '', q: '' }) }
  const quick = (a: string, b: string) => { setFrom(a); setTo(b); setAp({ from: a, to: b, platform, kind, rec, q }) }
  const [edit, setEdit] = useState<Row | 'new' | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [l, p] = await Promise.all([
      supabase.from('ledger').select('*, property:properties(name, assistant_id)').order('occurred_date', { ascending: false }).order('id', { ascending: false }).limit(3000),
      supabase.from('properties').select('id, name, assistant_id').order('name'),
    ])
    if (l.error) setMsg(`读取出错：${l.error.message}（是否已运行 038 迁移？）`)
    setRows((l.data ?? []) as never); setProps((p.data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])

  const myProps = useMemo(() => isAssistant ? props.filter((x) => !!x.assistant_id && cover.has(x.assistant_id)) : props, [props, isAssistant, cover])
  const shown = useMemo(() => rows.filter((r) => {
    if (isAssistant && !(r.property?.assistant_id && cover.has(r.property.assistant_id))) return false
    if (ap.from && r.occurred_date < ap.from) return false
    if (ap.to && r.occurred_date > ap.to) return false
    if (ap.platform && r.platform !== ap.platform) return false
    if (ap.kind && r.kind !== ap.kind) return false
    if (ap.rec === 'no' && r.reconciled) return false
    if (ap.rec === 'yes' && !r.reconciled) return false
    if (ap.q && !`${r.property?.name} ${r.guest_name ?? ''} ${r.order_ref ?? ''} ${r.reason ?? ''}`.toLowerCase().includes(ap.q.toLowerCase())) return false
    return true
  }), [rows, isAssistant, cover, ap])
  const visible = rows.filter((r) => !isAssistant || (r.property?.assistant_id && cover.has(r.property.assistant_id))).length
  const inn = shown.filter((r) => r.amount > 0).reduce((n, r) => n + Number(r.amount), 0)
  const out = shown.filter((r) => r.amount < 0).reduce((n, r) => n - Number(r.amount), 0)
  const todo = shown.filter((r) => !r.reconciled).length

  const toggleRec = async (r: Row) => {
    const { error } = await supabase.from('ledger').update({ reconciled: !r.reconciled }).eq('id', r.id)
    if (error) setMsg(error.message); else load()
  }

  const exportCsv = () => {
    const head = ['日期', '房源', '平台', '客人', '订单号', '入住', '退房', '类型', '类别', '金额', '责任方', '对房东结算', '已对账', '原因']
    const lines = shown.map((r) => [r.occurred_date, r.property?.name ?? '', r.platform, r.guest_name ?? '', r.order_ref ?? '', r.check_in ?? '', r.check_out ?? '', r.kind, r.category, r.amount, r.payer ?? '', r.owner_effect, r.reconciled ? '是' : '否', r.reason ?? ''])
    const csv = '\ufeff' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `公司款项${ap.from || ap.to ? `_${ap.from || '起'}至${ap.to || '今'}` : ''}.csv`; a.click()
  }

  return (
    <div>
      <div className="title-row"><h1>公司款项</h1><button onClick={() => setEdit('new')}>+ 新增款项</button></div>
      <p className="muted small">记录每一笔和订单相关的收款、退款、押金、线下转账。支出类型有：退款、协商退款、清洁问题退款、退押金、线下转出、平台扣款、赔付房东、垫付费用，金额都填正数，系统自动记成支出。“对房东结算”选“补房东”或“扣房东”的，会自动计入当月房东结算（选“无”表示公司自己消化，或已在 Hostaway 订单里改好）。</p>
      <div className="btn-row" style={{ marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted small">日期</span>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(e.target.value) }} />
        <span className="muted small">到</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); if (from && from > e.target.value) setFrom(e.target.value) }} />
        <button className="ghost" onClick={() => { const n = new Date(), y = n.getFullYear(), m = n.getMonth(); const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; quick(f(new Date(y, m, 1)), f(new Date(y, m + 1, 0))) }}>本月</button>
        <button className="ghost" onClick={() => { const n = new Date(), y = n.getFullYear(), m = n.getMonth(); const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; quick(f(new Date(y, m - 1, 1)), f(new Date(y, m, 0))) }}>上个月</button>
      </div>
      <div className="btn-row" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">全部平台</option>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">全部类型</option>{KINDS.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={rec} onChange={(e) => setRec(e.target.value)}><option value="">对账：全部</option><option value="no">未对账</option><option value="yes">已对账</option></select>
        <input placeholder="搜索房源、客人、订单号、原因" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} style={{ minWidth: 240 }} />
        <button onClick={doSearch}>搜索</button>
        <button className="ghost" onClick={reset}>重置</button>
        <button className="ghost" onClick={exportCsv}>导出 CSV</button>
      </div>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        {shown.length} 条 · 收入 <span style={{ color: '#1f6b34' }}>{m(inn)}</span> · 支出 <span style={{ color: '#a3271c' }}>{m(out)}</span> · 合计 {inn - out < 0 ? '−' : ''}{m(inn - out)} · 未对账 {todo} 条
      </p>
      {msg && <p className="err">{msg}</p>}
      <div className="table-wrap">
        <table style={{ minWidth: 1100 }}>
          <thead><tr><th>日期</th><th>房源</th><th>平台</th><th>客人 / 订单号</th><th>类型 · 类别</th><th style={{ textAlign: 'right' }}>金额</th><th>责任方</th><th>对房东结算</th><th>已对账</th><th>原因</th><th></th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.occurred_date.slice(5)}</td><td>{r.property?.name}</td><td>{r.platform}</td>
              <td>{r.guest_name ?? '—'}{r.order_ref && <div className="muted small">{r.order_ref}</div>}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.kind} · {r.category}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: r.amount > 0 ? '#1f6b34' : '#a3271c' }}>{r.amount > 0 ? '+' : '−'}{m(Number(r.amount))}</td>
              <td>{r.payer ?? '—'}</td>
              <td>{r.owner_effect !== '无' ? <span className="chip amber" style={{ marginLeft: 0 }}>{r.owner_effect}</span> : '—'}</td>
              <td>{canReconcile ? <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={r.reconciled} onChange={() => toggleRec(r)} /> : r.reconciled ? '✓' : '—'}</td>
              <td style={{ maxWidth: 260 }}>{r.reason ?? ''}</td>
              <td>{r.claim_id ? <button className="task-btn" onClick={() => nav(`/claims?id=${r.claim_id}`)}>来自索赔</button> : <button className="task-btn" onClick={() => setEdit(r)}>编辑</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        {!shown.length && <p className="muted pad">{visible ? `没有符合当前条件的记录（你能看到的一共 ${visible} 条）。点“重置”可以清空条件。` : '系统里还没有任何款项记录，点右上角“+ 新增款项”开始记。'}</p>}
      </div>
      {edit && <EditModal row={edit === 'new' ? null : edit} props={myProps} isAdmin={isAdmin} onClose={() => setEdit(null)} onSaved={(t) => { setEdit(null); setMsg(''); void t; load() }} />}
    </div>
  )
}

function EditModal({ row, props, isAdmin, onClose, onSaved }: { row: Row | null; props: Prop[]; isAdmin: boolean; onClose: () => void; onSaved: (t: string) => void }) {
  const [f, setF] = useState({
    property_id: row ? String(row.property_id) : '', occurred_date: row?.occurred_date ?? today(), platform: row?.platform ?? 'Airbnb',
    order_ref: row?.order_ref ?? '', guest_name: row?.guest_name ?? '', check_in: row?.check_in ?? '', check_out: row?.check_out ?? '',
    kind: row?.kind ?? '收款', category: row?.category ?? '房费', amount: row ? String(Math.abs(Number(row.amount))) : '',
    payer: row?.payer ?? '', owner_effect: row?.owner_effect ?? '无', reason: row?.reason ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    const n = Number(f.amount)
    if (!f.property_id) { setErr('请选房源。'); return }
    if (!f.amount.trim() || Number.isNaN(n) || n <= 0) { setErr('金额填正数就行，退款、退押金系统会自动记成支出。'); return }
    setBusy(true); setErr('')
    const body = {
      property_id: Number(f.property_id), occurred_date: f.occurred_date, platform: f.platform, order_ref: f.order_ref.trim() || null, guest_name: f.guest_name.trim() || null,
      check_in: f.check_in || null, check_out: f.check_out || null, kind: f.kind, category: f.category,
      amount: OUT_KINDS.includes(f.kind) ? -Math.abs(n) : Math.abs(n), payer: f.payer || null, owner_effect: f.owner_effect, affects_owner: f.owner_effect !== '无', reason: f.reason.trim() || null,
    }
    const { error } = row ? await supabase.from('ledger').update(body).eq('id', row.id) : await supabase.from('ledger').insert(body)
    setBusy(false)
    if (error) { setErr(`保存失败：${error.message}`); return }
    onSaved('ok')
  }
  const del = async () => {
    if (!row || !window.confirm('删除这条款项？')) return
    const { error } = await supabase.from('ledger').delete().eq('id', row.id)
    if (error) { setErr(error.message); return }
    onSaved('del')
  }
  const out = OUT_KINDS.includes(f.kind)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{row ? '编辑款项' : '新增款项'}</h2>
        <label>房源<select value={f.property_id} onChange={(e) => set('property_id', e.target.value)}><option value="">请选择</option>{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <div className="form-grid">
          <label>日期<input type="date" value={f.occurred_date} onChange={(e) => set('occurred_date', e.target.value)} /></label>
          <label>平台<select value={f.platform} onChange={(e) => set('platform', e.target.value)}>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>客人姓名<input value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} /></label>
          <label>订单号<input value={f.order_ref} onChange={(e) => set('order_ref', e.target.value)} /></label>
          <label>入住日期<input type="date" value={f.check_in} onChange={(e) => set('check_in', e.target.value)} /></label>
          <label>退房日期<input type="date" value={f.check_out} onChange={(e) => set('check_out', e.target.value)} /></label>
          <label>款项类型<select value={f.kind} onChange={(e) => set('kind', e.target.value)}><optgroup label="收入">{KINDS.filter((x) => !OUT_KINDS.includes(x)).map((x) => <option key={x}>{x}</option>)}</optgroup><optgroup label="支出">{OUT_KINDS.map((x) => <option key={x}>{x}</option>)}</optgroup></select></label>
          <label>类别<select value={f.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>金额（$，填正数）<input inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></label>
          <label>责任方<select value={f.payer} onChange={(e) => set('payer', e.target.value)}><option value="">不填</option>{PAYERS.map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>这一笔记为 <b style={{ color: out ? '#a3271c' : '#1f6b34' }}>{out ? '支出' : '收入'}</b>。</p>
        <label>对房东结算<select value={f.owner_effect} onChange={(e) => set('owner_effect', e.target.value)}>{EFFECTS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <p className="muted small" style={{ margin: 0 }}>无＝公司自己消化，或已在 Hostaway 订单里改好；补房东＝要多给房东这笔钱；扣房东＝要从房东款里扣掉这笔钱。金额都按上面填的数计算。</p>
        <label>原因说明<input value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="例如：客人投诉，退部分房费" /></label>
        {err && <div className="err">{err}</div>}
        <div className="btn-row">
          <button disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          <button className="ghost" onClick={onClose}>取消</button>
          {row && isAdmin && <button className="ghost" style={{ marginLeft: 'auto' }} onClick={del}>删除</button>}
        </div>
      </div>
    </div>
  )
}
