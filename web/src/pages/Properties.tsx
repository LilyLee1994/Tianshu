import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { callApi } from '../lib/api'
import Copy from '../lib/Copy'
import { HistoryModal } from '../lib/History'

interface Details {
  bedrooms: number | null; bathrooms: number | null; max_guests: number | null; beds: string | null; appliances: string[]
  lock_location: string | null; lock_code: string | null; wifi_name: string | null; wifi_password: string | null
  parking: string | null; bin_day: string | null; notes: string | null
}
interface Contract {
  water: string; power: string; gas: string; internet: string; recharge_back: string
  end_date: string | null; base_status: '筹备中' | '运营中'
}
interface Row {
  id: number; name: string; address: string | null; region: string | null; assistant_id: string | null
  airbnb_url: string | null; booking_url: string | null; commission_rate: number | null; airbnb_account: PlatformAccount | null; account_info: { old_accounts: string[] | null } | null; legacy: boolean; hostaway_id: number | null; cleaning_by: string; cleaner_id: string | null; cleaner: { name: string } | null
  assistant: { name: string } | null
  property_details: Details | null
  property_contracts: Contract | null
}
interface Assistant { id: string; name: string }

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
const PAY = ['未填', '房东', '公司代缴']

export function statusOf(c: Contract | null, legacy = false) {
  if (legacy) return '运营中'
  if (!c) return '待登记合同'
  const full = [c.water, c.power, c.gas, c.internet].every((x) => x !== '未填') && !!c.end_date
  if (!full) return '待登记合同'
  return c.base_status === '筹备中' ? '可上线' : '运营中'
}
const statusClass = (s: string) => (s === '待登记合同' ? 'chip amber' : s === '可上线' ? 'chip blue' : 'chip green')

export default function Properties() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isAssistant = profile?.role === 'assistant'
  const [rows, setRows] = useState<Row[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncErr, setSyncErr] = useState('')
  const [syncKeys, setSyncKeys] = useState('')

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase.from('properties')
        .select('id, name, address, region, assistant_id, airbnb_url, booking_url, commission_rate, legacy, hostaway_id, cleaning_by, airbnb_account:platform_accounts!airbnb_account_id(id, login, needs_verification, note, password, google_password), account_info:property_account_info(old_accounts), assistant:profiles!assistant_id(name), property_details(*), property_contracts(*)')
        .order('name'),
      supabase.from('profiles').select('id, name').eq('role', 'assistant').eq('active', true).order('name'),
    ])
    if (p.error) setErr(p.error.message)
    else setRows(p.data as unknown as Row[])
    if (a.data) setAssistants(a.data as Assistant[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const list = useMemo(() => {
    const base = isAssistant && scope === 'mine' ? rows.filter((r) => r.assistant_id === profile?.id) : rows
    const k = norm(q)
    return k ? base.filter((r) => norm(r.name).includes(k) || norm(r.address ?? '').includes(k)) : base
  }, [rows, q, scope, isAssistant, profile])
  const cur = list.find((r) => r.id === sel) ?? list[0]
  const canEdit = !!cur && (isAdmin || (isAssistant && cur.assistant_id === profile?.id))

  if (loading) return <p className="muted">加载中…</p>
  if (err) return <p className="err">读取失败：{err}</p>

  const sync = async () => {
    setSyncing(true); setSyncErr(''); setMsg('')
    const [r, e] = await callApi<{ total: number; created: number; updated: number; skipped: string[]; sampleKeys: string[] }>('hostaway-sync', {})
    setSyncing(false)
    if (e || !r) { setSyncErr(e ?? '同步失败'); return }
    setMsg(`Hostaway 同步完成：共 ${r.total} 个，新增 ${r.created}，更新 ${r.updated}${r.skipped.length ? `，跳过 ${r.skipped.length}（${r.skipped.slice(0, 3).join('；')}）` : ''}。`)
    setSyncKeys(r.sampleKeys.join('、'))
    await load()
  }

  const afterSave = async (text: string) => { setEditing(false); setAdding(false); setMsg(text); await load() }

  return (
    <div>
      <div className="title-row">
        <h1>房源档案</h1>
        {isAdmin && <span className="btn-row" style={{ margin: 0 }}><button className="ghost" disabled={syncing} onClick={sync}>{syncing ? '同步中…' : '从 Hostaway 同步'}</button><button className="primary small-btn" onClick={() => { setAdding(true); setEditing(false) }}>＋ 新增房源</button></span>}
      </div>
      {msg && <div className="ok">{msg}</div>}
      {syncErr && <div className="err-box">{syncErr}</div>}
      {syncKeys && <details className="muted small" style={{ marginBottom: 12 }}><summary>Hostaway 返回的字段（排查用，可以复制发给开发）</summary><div style={{ wordBreak: 'break-all' }}>{syncKeys}</div></details>}
      {isAssistant && (
        <div className="pills">
          <button className={scope === 'mine' ? 'pill on' : 'pill'} onClick={() => { setScope('mine'); setEditing(false) }}>自己的房源</button>
          <button className={scope === 'all' ? 'pill on' : 'pill'} onClick={() => { setScope('all'); setEditing(false) }}>全部房源</button>
        </div>
      )}
      <input className="search" placeholder="输入房源名或地址，边打边筛" value={q} onChange={(e) => setQ(e.target.value)} />

      {isAssistant && scope === 'all' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>房源</th><th>地址</th><th>主责助理</th><th>锁盒位置 / 密码</th><th>WiFi / 密码</th><th>停车</th><th>垃圾日</th><th>注意事项</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const d = r.property_details
                return (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td><td>{dash(r.address)}</td><td>{dash(r.assistant?.name)}</td>
                    <td>{dash(d?.lock_location)} / {dash(d?.lock_code)}</td><td>{dash(d?.wifi_name)} / {dash(d?.wifi_password)}</td>
                    <td>{dash(d?.parking)}</td><td>{dash(d?.bin_day)}</td><td>{dash(d?.notes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <p className="muted pad">没有匹配的房源。</p>}
        </div>
      ) : (
        <div className="split">
          <div className="side-list">
            {list.map((r) => (
              <button key={r.id} className={cur?.id === r.id ? 'item on' : 'item'} onClick={() => { setSel(r.id); setEditing(false); setMsg('') }}>
                <span>{r.name}</span><span className={statusClass(statusOf(r.property_contracts, r.legacy))}>{statusOf(r.property_contracts, r.legacy)}</span>
              </button>
            ))}
            {!list.length && <p className="muted pad">{isAssistant ? '你还没有被分配房源。' : '还没有房源，点右上角“新增房源”。'}</p>}
          </div>
          {cur && (editing
            ? <EditForm key={cur.id} row={cur} isAdmin={isAdmin} assistants={assistants} onCancel={() => setEditing(false)} onSaved={() => afterSave('已保存。')} />
            : <Detail row={cur} canEdit={canEdit} isAdmin={isAdmin} onEdit={() => { setEditing(true); setMsg('') }} />)}
        </div>
      )}

      {adding && <AddModal assistants={assistants} onClose={() => setAdding(false)} onSaved={(n) => afterSave(`已新增房源 ${n}，请补充基本情况和合同。`)} />}
    </div>
  )
}

interface PlatformAccount { id: number; login: string; needs_verification: boolean; note: string | null; password: string | null; google_password: string | null }

function AccountBlock({ a, old }: { a: PlatformAccount; old: string[] }) {
  // 老账号的密码：按邮箱去已录入的账号里查
  const [found, setFound] = useState<Record<string, { password: string | null; google_password: string | null }>>({})
  const key = old.join(',')
  useEffect(() => {
    if (!old.length) { setFound({}); return }
    supabase.from('platform_accounts').select('login, password, google_password').in('login', old).then(({ data }) => {
      setFound(Object.fromEntries((data ?? []).map((x) => [String(x.login).toLowerCase(), x])))
    })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="plat" style={{ display: 'block', marginTop: 12 }}>
      <b>平台账号（Airbnb）</b>
      <dl style={{ marginTop: 8 }}>
        <dt>登录邮箱</dt><dd>{a.login}<Copy text={a.login} /></dd>
        <dt>Airbnb 密码</dt><dd>{a.password ? <>{a.password}<Copy text={a.password} /></> : '—'}</dd>
        <dt>Google 密码</dt><dd>{a.google_password ? <>{a.google_password}<Copy text={a.google_password} /></> : '—'}</dd>
        {old.map((email) => {
          const f = found[email.toLowerCase()]
          return (
            <div key={email} style={{ display: 'contents' }}>
              <dt>老账号</dt>
              <dd style={{ whiteSpace: 'nowrap' }}>
                {email}<Copy text={email} />
                {f?.password && <><span className="muted small">　密码 </span>{f.password}<Copy text={f.password} /></>}
                {f?.google_password && f.google_password !== f.password && <><span className="muted small">　Google </span>{f.google_password}<Copy text={f.google_password} /></>}
                {!f && <span className="muted small">　（没有找到这个账号的密码）</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function Detail({ row: r, canEdit, isAdmin, onEdit }: { row: Row; canEdit: boolean; isAdmin: boolean; onEdit: () => void }) {
  const [hist, setHist] = useState(false)
  const [rt, setRt] = useState<Record<string, { n: number; avg: number }>>({})
  useEffect(() => {
    supabase.from('review_stats').select('channel_name, n, avg_rating').eq('property_id', r.id).then(({ data }) => {
      const m: Record<string, { n: number; avg: number }> = {}
      for (const x of data ?? []) m[x.channel_name ?? ''] = { n: x.n, avg: Number(x.avg_rating) }
      setRt(m)
    })
  }, [r.id])
  const ratingText = (ch: string, five: boolean) => rt[ch] ? `评分 ${five ? (rt[ch].avg / 2).toFixed(2) + ' 星' : rt[ch].avg.toFixed(2) + ' 分'}（${rt[ch].n} 条评价）` : '暂无评价'
  const d = r.property_details, c = r.property_contracts, st = statusOf(c, r.legacy)
  return (
    <section className="card">
      <div className="title-row">
        <h2>{r.name} <span className={statusClass(st)}>{st}</span></h2>
        <span className="btn-row" style={{ margin: 0 }}>{canEdit && <button className="ghost" onClick={onEdit}>编辑</button>}{isAdmin && <button className="ghost" onClick={() => setHist(true)}>修改记录</button>}</span>
      </div>
      <dl>
        <dt>地址</dt><dd>{dash(r.address)}</dd>
        <dt>区域</dt><dd>{dash(r.region)}</dd>
        <dt>主责助理</dt><dd>{dash(r.assistant?.name)}</dd>
        <dt>清洁由谁做</dt><dd>{r.cleaning_by === '房东自己' ? '房东自己' : 'Alisa'}</dd>
        <dt>户型</dt><dd>{dash(d?.bedrooms)} 房 {dash(d?.bathrooms)} 卫 · 可住 {dash(d?.max_guests)} 人</dd>
        <dt>床</dt><dd>{dash(d?.beds)}</dd>
        <dt>家电设施</dt><dd>{d?.appliances?.length ? d.appliances.join('、') : '—'}</dd>
        <dt>锁盒</dt><dd>{dash(d?.lock_location)} / {dash(d?.lock_code)}</dd>
        <dt>WiFi</dt><dd>{dash(d?.wifi_name)} / {dash(d?.wifi_password)}</dd>
        <dt>停车 / 垃圾日</dt><dd>{dash(d?.parking)} / {dash(d?.bin_day)}</dd>
        <dt>注意事项</dt><dd>{dash(d?.notes)}</dd>
        {!r.legacy && <>
          <dt>水电燃气网络</dt>
          <dd>水 {dash(c?.water)} · 电 {dash(c?.power)} · 燃气 {dash(c?.gas)} · 网络 {dash(c?.internet)}</dd>
          <dt>合同</dt><dd>到期 {dash(c?.end_date)} · 代缴费用是否扣回 {dash(c?.recharge_back)}</dd>
        </>}
      </dl>
      <div className="plats">
        <div className="plat"><b>Airbnb</b>{r.airbnb_url ? <a href={r.airbnb_url.startsWith('http') ? r.airbnb_url : `https://${r.airbnb_url}`} target="_blank" rel="noreferrer">打开房源页</a> : <span className="muted">还没填链接</span>}<span className="muted small">{ratingText('Airbnb', true)}</span></div>
        <div className="plat"><b>Booking</b>{r.booking_url ? <a href={r.booking_url.startsWith('http') ? r.booking_url : `https://${r.booking_url}`} target="_blank" rel="noreferrer">打开房源页</a> : <span className="muted">还没填链接</span>}<span className="muted small">{ratingText('Booking.com', false)}</span></div>
      </div>
      {r.airbnb_account && <AccountBlock a={r.airbnb_account} old={r.account_info?.old_accounts ?? []} />}
      {hist && <HistoryModal title={r.name} filters={[{ table: 'properties', id: r.id }, { table: 'property_details', id: r.id }, { table: 'property_contracts', id: r.id }, { table: 'property_account_info', id: r.id }]} onClose={() => setHist(false)} />}
      {st === '待登记合同' && <p className="warn">水电燃气网络和合同到期日填完整后，房源才算“运营中”。</p>}
    </section>
  )
}

function EditForm({ row, isAdmin, assistants, onCancel, onSaved }: { row: Row; isAdmin: boolean; assistants: Assistant[]; onCancel: () => void; onSaved: () => void }) {
  const d = row.property_details, c = row.property_contracts
  const [p, setP] = useState({ name: row.name, address: row.address ?? '', region: row.region ?? '', assistant_id: row.assistant_id ?? '', airbnb_url: row.airbnb_url ?? '', booking_url: row.booking_url ?? '', hostaway_id: row.hostaway_id?.toString() ?? '', cleaning_by: row.cleaning_by ?? '清洁公司', commission: row.commission_rate != null ? String(Math.round(Number(row.commission_rate) * 10000) / 100) : '15' })
  const [dt, setDt] = useState({
    bedrooms: d?.bedrooms?.toString() ?? '', bathrooms: d?.bathrooms?.toString() ?? '', max_guests: d?.max_guests?.toString() ?? '',
    beds: d?.beds ?? '', appliances: (d?.appliances ?? []).join('，'),
    lock_location: d?.lock_location ?? '', lock_code: d?.lock_code ?? '', wifi_name: d?.wifi_name ?? '', wifi_password: d?.wifi_password ?? '',
    parking: d?.parking ?? '', bin_day: d?.bin_day ?? '', notes: d?.notes ?? '',
  })
  const [ct, setCt] = useState({
    water: c?.water ?? '未填', power: c?.power ?? '未填', gas: c?.gas ?? '未填', internet: c?.internet ?? '未填',
    recharge_back: c?.recharge_back ?? '未填', end_date: c?.end_date ?? '', base_status: c?.base_status ?? '运营中',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  const txt = (v: string) => (v.trim() === '' ? null : v.trim())

  const save = async () => {
    if (!p.name.trim()) { setErr('房源名称不能为空。'); return }
    setBusy(true); setErr('')
    const jobs = [
      supabase.from('property_details').update({
        bedrooms: num(dt.bedrooms), bathrooms: num(dt.bathrooms), max_guests: num(dt.max_guests), beds: txt(dt.beds),
        appliances: dt.appliances.split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
        lock_location: txt(dt.lock_location), lock_code: txt(dt.lock_code), wifi_name: txt(dt.wifi_name), wifi_password: txt(dt.wifi_password),
        parking: txt(dt.parking), bin_day: txt(dt.bin_day), notes: txt(dt.notes),
      }).eq('property_id', row.id).select('property_id'),
    ]
    if (!row.legacy) jobs.push(supabase.from('property_contracts').update({ ...ct, end_date: ct.end_date || null }).eq('property_id', row.id).select('property_id'))
    if (isAdmin) jobs.push(supabase.from('properties').update({
      name: p.name.trim(), address: txt(p.address), region: txt(p.region), assistant_id: p.assistant_id || null, airbnb_url: txt(p.airbnb_url), booking_url: txt(p.booking_url), hostaway_id: num(p.hostaway_id), cleaning_by: p.cleaning_by, commission_rate: Math.min(100, Math.max(0, Number(p.commission) || 15)) / 100,
    }).eq('id', row.id).select('id'))
    const res = await Promise.all(jobs)
    setBusy(false)
    const bad = res.find((r) => r.error || !r.data?.length)
    if (bad) { setErr(bad.error ? `保存失败：${bad.error.message}` : '保存失败：没有权限，或这条记录不存在。'); return }
    onSaved()
  }

  const f = (label: string, value: string, on: (v: string) => void, multi = false) => (
    <label>{label}{multi ? <textarea rows={2} value={value} onChange={(e) => on(e.target.value)} /> : <input value={value} onChange={(e) => on(e.target.value)} />}</label>
  )
  const sel = (label: string, value: string, opts: string[], on: (v: string) => void) => (
    <label>{label}<select value={value} onChange={(e) => on(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{o === '清洁公司' ? 'Alisa' : o}</option>)}</select></label>
  )

  return (
    <section className="card">
      <h2>编辑 {row.name}</h2>
      <div className="form-grid">
        {isAdmin && <>
          {f('房源名称', p.name, (v) => setP({ ...p, name: v }))}
          {f('地址', p.address, (v) => setP({ ...p, address: v }))}
          {f('区域', p.region, (v) => setP({ ...p, region: v }))}
          {sel('清洁由谁做（房东自己做的，不自动派清洁单）', p.cleaning_by, ['清洁公司', '房东自己'], (v) => setP({ ...p, cleaning_by: v }))}
          {f('佣金比例（%，房东结算用）', p.commission, (v) => setP({ ...p, commission: v }))}
          {f('Airbnb 房源链接', p.airbnb_url, (v) => setP({ ...p, airbnb_url: v }))}
          {f('Booking 房源链接', p.booking_url, (v) => setP({ ...p, booking_url: v }))}
          {!row.legacy && f('Hostaway 房源 ID（选填：房源在 Hostaway 上架后填，同步时就能对上）', p.hostaway_id, (v) => setP({ ...p, hostaway_id: v }))}
          <label>主责助理<select value={p.assistant_id} onChange={(e) => setP({ ...p, assistant_id: e.target.value })}>
            <option value="">未分配</option>{assistants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
        </>}
        {f('几房', dt.bedrooms, (v) => setDt({ ...dt, bedrooms: v }))}
        {f('几卫', dt.bathrooms, (v) => setDt({ ...dt, bathrooms: v }))}
        {f('可住人数', dt.max_guests, (v) => setDt({ ...dt, max_guests: v }))}
        {f('床（几张、什么床）', dt.beds, (v) => setDt({ ...dt, beds: v }))}
        {f('家电与设施（逗号隔开）', dt.appliances, (v) => setDt({ ...dt, appliances: v }), true)}
        {f('锁盒位置', dt.lock_location, (v) => setDt({ ...dt, lock_location: v }))}
        {f('锁盒密码', dt.lock_code, (v) => setDt({ ...dt, lock_code: v }))}
        {f('WiFi 名称', dt.wifi_name, (v) => setDt({ ...dt, wifi_name: v }))}
        {f('WiFi 密码', dt.wifi_password, (v) => setDt({ ...dt, wifi_password: v }))}
        {f('停车', dt.parking, (v) => setDt({ ...dt, parking: v }))}
        {f('收垃圾日', dt.bin_day, (v) => setDt({ ...dt, bin_day: v }))}
        {f('注意事项', dt.notes, (v) => setDt({ ...dt, notes: v }), true)}
      </div>
      {!row.legacy && <><h3>合同与水电燃气</h3>
      <div className="form-grid">
        {sel('水', ct.water, PAY, (v) => setCt({ ...ct, water: v }))}
        {sel('电', ct.power, PAY, (v) => setCt({ ...ct, power: v }))}
        {sel('燃气', ct.gas, PAY, (v) => setCt({ ...ct, gas: v }))}
        {sel('网络', ct.internet, PAY, (v) => setCt({ ...ct, internet: v }))}
        {sel('代缴费用是否从房东结算里扣回', ct.recharge_back, ['未填', '是', '否'], (v) => setCt({ ...ct, recharge_back: v }))}
        <label>合同到期日<input type="date" value={ct.end_date} onChange={(e) => setCt({ ...ct, end_date: e.target.value })} /></label>
        {sel('运营阶段', ct.base_status, ['筹备中', '运营中'], (v) => setCt({ ...ct, base_status: v as Contract['base_status'] }))}
      </div></>}
      {err && <div className="err">{err}</div>}
      <div className="btn-row">
        <button className="primary small-btn" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
        <button className="ghost" onClick={onCancel}>取消</button>
      </div>
    </section>
  )
}

function AddModal({ assistants, onClose, onSaved }: { assistants: Assistant[]; onClose: () => void; onSaved: (name: string) => void }) {
  const [f, setF] = useState({ name: '', address: '', region: '', assistant_id: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!f.name.trim()) { setErr('请填房源名称。'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('properties').insert({
      name: f.name.trim(), address: f.address.trim() || null, region: f.region.trim() || null, assistant_id: f.assistant_id || null,
    })
    setBusy(false)
    if (error) { setErr(error.code === '23505' ? '这个房源名称已经有了。' : `保存失败：${error.message}`); return }
    onSaved(f.name.trim())
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>新增房源</h2>
        <label>房源名称（必填）<input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>地址<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <label>区域<input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></label>
        <label>主责助理<select value={f.assistant_id} onChange={(e) => setF({ ...f, assistant_id: e.target.value })}>
          <option value="">先不分配</option>{assistants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        {err && <div className="err">{err}</div>}
        <div className="btn-row">
          <button className="primary small-btn" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          <button className="ghost" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}
