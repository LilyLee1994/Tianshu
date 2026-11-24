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
// 老账号：“旧帐号”那一列里的邮箱，加上任何写着“老账号/旧帐号”的格子里的邮箱（只取邮箱，不带旁边的密码）
function oldAccounts(cells: string[], login: string): string[] {
  const out = new Set<string>()
  const add = (x: string) => { for (const m of x.match(MAIL) ?? []) out.add(m.toLowerCase()) }
  add(cells[0] ?? '')
  for (const x of cells) if (OLD_KW.test(x)) add(x)
  out.delete(login)
  return [...out]
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

export default function ImportAccounts() {
  const [rows, setRows] = useState<Row[]>([])
  const [admin, setAdmin] = useState<CompanyRow[]>([])
  const [adminMsg, setAdminMsg] = useState('')
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
    setRows(r); setAdmin(parseAdmin(wb)); setAdminMsg(''); await loadUsers()
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
        const { error } = await supabase.from('property_account_info').upsert({ property_id: p.id, raw: r.other || null, old_accounts: r.old }, { onConflict: 'property_id' })
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
      {log.map((l, i) => <p key={i} className="error">{l}</p>)}
    </div>
  )
}
