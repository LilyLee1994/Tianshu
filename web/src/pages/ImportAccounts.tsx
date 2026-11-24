import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { callApi } from '../lib/api'

interface Row { duty: string; property: string; login: string; pw: string; gpw: string; verify: string; other: string; old: string[] }
interface Merged { login: string; pw: string; gpw: string; verify: string }

const t = (v: unknown) => String(v ?? '').trim()
// 初始密码：和账号名一样；不足 8 位（系统最低要求）时补数字
const pwOf = (acct: string) => { let p = acct, i = 1; while (p.length < 8) p += String(i++ % 10); return p }
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface CompanyRow { reference: string; account: string; password: string; note: string; extra: string }

function parseAdmin(wb: XLSX.WorkBook): CompanyRow[] {
  const ws = wb.Sheets['admin']
  if (!ws) return []
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
  const out: CompanyRow[] = []
  for (const c of aoa.slice(1)) {
    const row = { reference: t(c[0]), account: t(c[1]), password: t(c[2]), note: t(c[3]), extra: c.slice(4).map(t).filter(Boolean).join('  ｜  ') }
    if (row.reference || row.account || row.password || row.note || row.extra) out.push(row)
  }
  return out
}

const MAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
const OLD_KW = /老账号|老帐号|旧账号|旧帐号/
const hasMail = (x: string) => { MAIL.lastIndex = 0; return MAIL.test(x) }
// 老账号：“旧帐号”那一列里的邮箱，加上任何写着“老账号/旧帐号”的格子里的邮箱。只记邮箱；
// 密码不在这里取，页面上按邮箱去已录入的账号里查（老账号通常也是别的房源在用的账号）。
function oldAccounts(cells: string[], login: string): string[] {
  const out = new Set<string>()
  cells.forEach((x, i) => {
    if (!x || !(i === 0 || OLD_KW.test(x)) || !hasMail(x)) return
    for (const m of x.match(MAIL) ?? []) out.add(m.toLowerCase())
  })
  out.delete(login)
  return [...out]
}

// 已下线账号页：房源、地址、邮箱、密码、Google 密码…；只取邮箱和密码，用来查老账号的密码
function parseOffline(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['已下线账号']
  if (!ws) return []
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
  const by = new Map<string, { login: string; pw: string; gpw: string }>()
  for (const c of aoa) {
    const m = t(c[2]).match(MAIL)?.[0]
    if (!m) continue
    const login = m.toLowerCase(), e = by.get(login) ?? { login, pw: '', gpw: '' }
    e.pw ||= t(c[3]); e.gpw ||= t(c[4])
    by.set(login, e)
  }
  return [...by.values()]
}

function parse(wb: XLSX.WorkBook): Row[] {
  const out: Row[] = []
  for (const sn of ['properties', 'Booking property']) {
    const ws = wb.Sheets[sn]
    if (!ws) continue
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
    for (const c of aoa.slice(1)) {
      const property = t(c[1])
      if (!property) continue
      const col3 = t(c[3])
      const isMail = col3.includes('@')
      const other = [!isMail && col3 ? col3 : '', ...c.slice(7, 17).map(t)].filter(Boolean).join('  ｜  ')
      const login = isMail ? col3.toLowerCase() : ''
      out.push({ duty: t(c[0]), property, login, pw: t(c[4]), gpw: t(c[5]), verify: t(c[6]), other, old: oldAccounts(c.slice(7, 17).map(t), login) })
    }
  }
  return out
}

const normName = (x: unknown) => String(x ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

// 清洁费表：AIRBNB 列 = 向客人收取，ALISA 列 = 付 Alisa；标了“房东自己”的房源改成房东自己清洁
function CleaningImport() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const onFile = async (f: File) => {
    setBusy(true); setMsg('')
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames.find((n) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: '' }).slice(0, 5).some((r) => (r as unknown[]).includes('Listing'))) ?? '']
      if (!ws) { setMsg('没有找到带 Listing 列的表。'); setBusy(false); return }
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const hi = aoa.findIndex((r) => r.includes('Listing'))
      const H = aoa[hi] as string[]
      const col = (k: string) => H.findIndex((h) => String(h).trim().toUpperCase() === k)
      const cL = col('LISTING'), cA = col('AIRBNB'), cB = col('ALISA')
      const { data: ps } = await supabase.from('properties').select('id, name').limit(2000)
      const byName = new Map((ps ?? []).map((x) => [normName(x.name), x.id as number]))
      const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null)
      const today = new Date().toISOString().slice(0, 10)
      let ok = 0, own = 0
      const miss: string[] = []
      for (const r of aoa.slice(hi + 1)) {
        const name = String(r[cL] ?? '').trim()
        if (!name) continue
        const pid = byName.get(normName(name))
        if (!pid) { miss.push(name); continue }
        const a = num(r[cA]), l = num(r[cB])
        if (a != null || l != null) {
          const { error } = await supabase.from('cleaning_fees').upsert({ property_id: pid, guest_fee: a, standard_fee: l, effective_date: today }, { onConflict: 'property_id,effective_date' })
          if (error) { setMsg(`写入 ${name} 失败：${error.message}（是否已运行 028 迁移？）`); setBusy(false); return }
          ok++
        }
        if (r.some((x) => typeof x === 'string' && x.includes('房东自己'))) { await supabase.from('properties').update({ cleaning_by: '房东自己' }).eq('id', pid); own++ }
      }
      setMsg(`导入了 ${ok} 个房源的清洁费${own ? `，${own} 个标为房东自己清洁` : ''}。${miss.length ? `系统里找不到这 ${miss.length} 个：${miss.join('、')}` : ''}`)
    } catch (e) { setMsg(`读取失败：${(e as Error).message}`) }
    setBusy(false)
  }
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>6. 清洁费表</h3>
      <p className="muted small">选清洁费那张表（有 Listing、AIRBNB、ALISA 列）。AIRBNB 列记为“向客人收取”，ALISA 列记为“付 Alisa”，标了“房东自己清洁”的房源改成房东自己。向客人收取的价格之后会随 Hostaway 自动更新。</p>
      <label className="ghost" style={{ cursor: 'pointer' }}>{busy ? '导入中…' : '选择清洁费表'}<input type="file" accept=".xlsx,.xls" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} /></label>
      {msg && <p>{msg}</p>}
    </section>
  )
}

export default function ImportAccounts() {
  const [rows, setRows] = useState<Row[]>([])
  const [admin, setAdmin] = useState<CompanyRow[]>([])
  const [adminMsg, setAdminMsg] = useState('')
  const [offline, setOffline] = useState<{ login: string; pw: string; gpw: string }[]>([])
  const [offMsg, setOffMsg] = useState('')
  const [users, setUsers] = useState<{ id: string; account: string; name: string }[]>([])
  const [log, setLog] = useState<string[]>([])
  const [created, setCreated] = useState<{ account: string; pw: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ accounts: number; linked: number; assigned: number; unmatched: string[] } | null>(null)

  const duties = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.duty) m.set(r.duty.toLowerCase(), (m.get(r.duty.toLowerCase()) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])
  const logins = useMemo(() => new Set(rows.map((r) => r.login).filter(Boolean)).size, [rows])

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, account, name').eq('role', 'assistant')
    setUsers((data ?? []) as never)
    return (data ?? []) as { id: string; account: string; name: string }[]
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setDone(null); setCreated([]); setLog([])
    const wb = XLSX.read(await f.arrayBuffer())
    const r = parse(wb)
    setRows(r); setAdmin(parseAdmin(wb)); setAdminMsg(''); setOffline(parseOffline(wb)); setOffMsg(''); await loadUsers()
    if (!r.length) setLog(['没有读到房源，请确认上传的是 Account 表（里面要有 properties 这一页）。'])
  }

  const accountOf = (duty: string) => users.find((u) => u.account.toLowerCase() === duty || u.name.toLowerCase() === duty)

  const createAssistants = async () => {
    setBusy(true); setLog([])
    const made: { account: string; pw: string }[] = []
    const msgs: string[] = []
    for (const [duty] of duties) {
      if (accountOf(duty)) continue
      const acct = duty.replace(/[^a-z0-9_-]/g, '')
      const pw = pwOf(acct)
      const [, e] = await callApi('create-user', { account: acct, name: titleCase(duty), role: 'assistant', password: pw })
      if (e) msgs.push(`${duty}：${e}`); else made.push({ account: acct, pw })
    }
    setCreated(made); setLog(msgs.length ? msgs : made.length ? [] : ['助理账号都已经存在，不需要创建。'])
    await loadUsers(); setBusy(false)
  }

  const importAll = async () => {
    setBusy(true); setLog([]); setDone(null)
    const us = await loadUsers()
    const find = (d: string) => us.find((u) => u.account.toLowerCase() === d || u.name.toLowerCase() === d)
    // 同一个邮箱的多行合并成一个账号
    const merged = new Map<string, Merged>()
    for (const r of rows) {
      if (!r.login) continue
      const m = merged.get(r.login) ?? { login: r.login, pw: '', gpw: '', verify: '' }
      m.pw ||= r.pw; m.gpw ||= r.gpw; m.verify ||= r.verify
      merged.set(r.login, m)
    }
    const ids = new Map<string, number>()
    for (const m of merged.values()) {
      const { data, error } = await supabase.from('platform_accounts').upsert({
        platform: 'Airbnb', login: m.login, password: m.pw || null, google_password: m.gpw || null,
        note: null, other_info: null,
      }, { onConflict: 'platform,login' }).select('id').single()
      if (error || !data) { setLog([`写入账号 ${m.login} 失败：${error?.message}`]); setBusy(false); return }
      ids.set(m.login, data.id as number)
    }
    const { data: props } = await supabase.from('properties').select('id, name, assistant_id').limit(2000)
    const byName = new Map((props ?? []).map((p) => [String(p.name).trim().toLowerCase(), p]))
    let linked = 0, assigned = 0
    const unmatched: string[] = []
    for (const r of rows) {
      const p = byName.get(r.property.toLowerCase())
      if (!p) { unmatched.push(r.property); continue }
      const patch: Record<string, unknown> = {}
      if (r.login && ids.has(r.login)) { patch.airbnb_account_id = ids.get(r.login); linked++ }
      const u = find(r.duty.toLowerCase())
      if (u && !p.assistant_id) { patch.assistant_id = u.id; assigned++ }
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('properties').update(patch).eq('id', p.id)
        if (error) { setLog([`更新房源 ${r.property} 失败：${error.message}`]); setBusy(false); return }
      }
      if (r.other || r.old.length) {
        const { error } = await supabase.from('property_account_info').upsert({ property_id: p.id, raw: r.other || null, old_list: [], old_accounts: r.old }, { onConflict: 'property_id' })
        if (error) { setLog([`保存 ${r.property} 的原表备注失败：${error.message}`]); setBusy(false); return }
      }
    }
    setDone({ accounts: merged.size, linked, assigned, unmatched: [...new Set(unmatched)] })
    setBusy(false)
  }

  const importAdmin = async () => {
    setBusy(true); setAdminMsg('')
    const { data: have } = await supabase.from('company_accounts').select('reference, account').limit(2000)
    const seen = new Set((have ?? []).map((x) => `${x.reference}\u0000${x.account}`))
    const fresh = admin.filter((r) => { const k = `${r.reference}\u0000${r.account}`; if (seen.has(k)) return false; seen.add(k); return true })
    if (fresh.length) {
      const { error } = await supabase.from('company_accounts').insert(fresh.map((r) => ({ reference: r.reference, account: r.account, password: r.password || null, note: r.note || null, extra: r.extra || null })))
      if (error) { setAdminMsg(`导入失败：${error.message}`); setBusy(false); return }
    }
    setAdminMsg(`导入 ${fresh.length} 条${admin.length - fresh.length ? `，${admin.length - fresh.length} 条已经有了，没动` : ''}。到“账号库”查看。`)
    setBusy(false)
  }

  const importOffline = async () => {
    setBusy(true); setOffMsg('')
    const { data: have } = await supabase.from('platform_accounts').select('login').limit(5000)
    const seen = new Set((have ?? []).map((x) => String(x.login).toLowerCase()))
    const fresh = offline.filter((o) => !seen.has(o.login))
    for (let i = 0; i < fresh.length; i += 100) {
      const { error } = await supabase.from('platform_accounts').insert(fresh.slice(i, i + 100).map((o) => ({ platform: 'Airbnb', login: o.login, password: o.pw || null, google_password: o.gpw || null, status: '已下线' })))
      if (error) { setOffMsg(`导入失败：${error.message}`); setBusy(false); return }
    }
    setOffMsg(`导入 ${fresh.length} 个已下线账号${offline.length - fresh.length ? `，${offline.length - fresh.length} 个已经有了，没动` : ''}。`)
    setBusy(false)
  }

  const missing = duties.filter(([d]) => !accountOf(d))

  return (
    <div>
      <h1>导入旧表</h1>
      <p className="muted small">导入「Account」表：把平台账号（邮箱、密码）挂到房源上，按表里的 Duty 分配负责助理。文件只在你的浏览器里读取，直接写进系统，不经过别人。</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>1. 选择文件</h3>
        <input type="file" accept=".xls,.xlsx" onChange={(e) => onFile(e.target.files?.[0])} />
        {rows.length > 0 && <p>读到 <b>{rows.length}</b> 个房源，<b>{logins}</b> 个不同的 Airbnb 账号邮箱，<b>{rows.filter((r) => r.old.length).length}</b> 个房源写了老账号。</p>}
      </section>

      {rows.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>2. 助理账号</h3>
          <p className="muted small">表里的 Duty 对应到助理：账号名就是名字（小写），初始密码和账号名一样；系统要求密码至少 8 位，不够的在后面补数字。</p>
          <div className="table-wrap" style={{ border: 0 }}>
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>Duty</th><th>房源数</th><th>账号</th><th>初始密码</th><th>状态</th></tr></thead>
              <tbody>{duties.map(([d, n]) => {
                const u = accountOf(d), acct = d.replace(/[^a-z0-9_-]/g, '')
                return <tr key={d}><td>{d}</td><td>{n}</td><td>{u?.account ?? acct}</td><td>{u ? '—' : pwOf(acct)}</td><td>{u ? '已有账号' : '待创建'}</td></tr>
              })}</tbody>
            </table>
          </div>
          {missing.length > 0 && <div className="btn-row"><button disabled={busy} onClick={createAssistants}>{busy ? '创建中…' : `创建 ${missing.length} 个助理账号`}</button></div>}
          {created.length > 0 && <p className="small">已创建：{created.map((c) => `${c.account} / ${c.pw}`).join('；')}。请告诉对应的助理，登录后自己改密码。</p>}
        </section>
      )}

      {rows.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>3. 导入账号并分配房源</h3>
          <p className="muted small">按房源名称匹配：把 Airbnb 账号（邮箱、密码、Google 密码）挂到房源上，并把每个房源在原表里那一行后面的内容（旧账号、Vrbo、Booking、备注等）原样存下来；还没有负责助理的房源，按 Duty 分配。已经有负责人的不会改。可以重复点，不会重复建账号。</p>
          <div className="btn-row"><button disabled={busy || missing.length > 0} onClick={importAll}>{busy ? '导入中…' : '开始导入'}</button>{missing.length > 0 && <span className="muted small">先完成第 2 步创建助理账号</span>}</div>
          {done && (
            <div style={{ marginTop: 12 }}>
              <p>完成：导入 <b>{done.accounts}</b> 个账号，挂到 <b>{done.linked}</b> 个房源上，分配负责助理 <b>{done.assigned}</b> 个房源。</p>
              {done.unmatched.length > 0 && <p className="small" style={{ color: '#8a5a00' }}>有 {done.unmatched.length} 个房源在系统里找不到同名的，没导入（名字写法不同，或是已下线的）：{done.unmatched.slice(0, 40).join('、')}{done.unmatched.length > 40 ? '…' : ''}</p>}
            </div>
          )}
        </section>
      )}
      {admin.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>4. 公司通用账号（admin 页）</h3>
          <p className="muted small">读到 {admin.length} 条（Google Drive、Gmail、各平台总账号、Hostaway、VPN 等）。原样导入：名称、账号、密码、备注，后面多出来的列合在“其他列”里。已经有的（名称和账号相同）不会覆盖，可以重复点。只有管理员能在“账号库”看到。</p>
          <div className="btn-row"><button disabled={busy} onClick={importAdmin}>{busy ? '导入中…' : `导入 ${admin.length} 条`}</button></div>
          {adminMsg && <p>{adminMsg}</p>}
        </section>
      )}
      <CleaningImport />
      {offline.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>5. 已下线账号（用来查老账号的密码）</h3>
          <p className="muted small">读到 {offline.length} 个已下线的账号邮箱。导入后标记为“已下线”，不挂在任何房源上，只是让房源里的老账号能按邮箱查到密码。已经有的不会覆盖，可以重复点。</p>
          <div className="btn-row"><button disabled={busy} onClick={importOffline}>{busy ? '导入中…' : `导入 ${offline.length} 个`}</button></div>
          {offMsg && <p>{offMsg}</p>}
        </section>
      )}
      {log.map((l, i) => <p key={i} className="error">{l}</p>)}
    </div>
  )
}
