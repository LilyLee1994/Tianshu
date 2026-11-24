import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CopyVal } from '../lib/Copy'

interface Company { id: number; reference: string; account: string; password: string | null; note: string | null; extra: string | null }
interface Plat { id: number; platform: string; login: string; password: string | null; google_password: string | null; needs_verification: boolean; note: string | null; properties: { name: string }[] }

export default function Vault() {
  const [tab, setTab] = useState<'company' | 'platform'>('company')
  const [q, setQ] = useState('')
  const [company, setCompany] = useState<Company[]>([])
  const [plat, setPlat] = useState<Plat[]>([])
  const [msg, setMsg] = useState('')
  const [editC, setEditC] = useState<Partial<Company> | null>(null)
  const [editP, setEditP] = useState<Plat | null>(null)

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('company_accounts').select('*').order('id').limit(1000),
      supabase.from('platform_accounts').select('id, platform, login, password, google_password, needs_verification, note, properties:properties!airbnb_account_id(name)').order('login').limit(1000),
    ])
    if (c.error) setMsg(`读取出错：${c.error.message}`)
    setCompany((c.data ?? []) as never); setPlat((p.data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])

  const has = (s: unknown) => String(s ?? '').toLowerCase().includes(q.toLowerCase())
  const cShown = useMemo(() => company.filter((r) => !q || [r.reference, r.account, r.note, r.extra].some(has)), [company, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const pShown = useMemo(() => plat.filter((r) => !q || has(r.login) || has(r.note) || r.properties.some((x) => has(x.name))), [plat, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveC = async (r: Partial<Company>) => {
    const row = { reference: (r.reference ?? '').trim(), account: (r.account ?? '').trim(), password: r.password?.trim() || null, note: r.note?.trim() || null, extra: r.extra?.trim() || null }
    const { error } = r.id ? await supabase.from('company_accounts').update(row).eq('id', r.id) : await supabase.from('company_accounts').insert(row)
    if (error) { setMsg(error.code === '23505' ? '名称和账号都相同的记录已经有了。' : error.message); return }
    setEditC(null); setMsg('已保存。'); load()
  }
  const delC = async (r: Company) => {
    if (!window.confirm(`删除“${r.reference || r.account}”？`)) return
    const { error } = await supabase.from('company_accounts').delete().eq('id', r.id)
    if (error) setMsg(error.message); else { setMsg('已删除。'); load() }
  }
  const saveP = async (r: Plat) => {
    const { error } = await supabase.from('platform_accounts').update({ password: r.password?.trim() || null, google_password: r.google_password?.trim() || null, needs_verification: r.needs_verification, note: r.note?.trim() || null }).eq('id', r.id)
    if (error) { setMsg(error.message); return }
    setEditP(null); setMsg('已保存。'); load()
  }

  return (
    <div>
      <div className="title-row"><h1>账号库</h1>{tab === 'company' && <button onClick={() => setEditC({})}>+ 新增</button>}</div>
      <p className="muted small">只有管理员能看到这一页。这里是公司通用账号和所有 Airbnb 平台账号，明文显示，点复制即可。助理在自己房源的档案里能看到该房源的平台账号。</p>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className={tab === 'company' ? 'pill on' : 'pill'} onClick={() => setTab('company')}>公司通用账号（{company.length}）</button>
        <button className={tab === 'platform' ? 'pill on' : 'pill'} onClick={() => setTab('platform')}>Airbnb 平台账号（{plat.length}）</button>
        <input placeholder="搜索" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {msg && <p className="muted">{msg}</p>}

      {tab === 'company' && (
        <div className="table-wrap">
          <table style={{ minWidth: 900 }}>
            <thead><tr><th>名称</th><th>账号</th><th>密码</th><th>备注</th><th>其他列（原表）</th><th></th></tr></thead>
            <tbody>{cShown.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'pre-wrap' }}>{r.reference || <span className="muted">（无名称）</span>}</td>
                <td><CopyVal v={r.account || null} /></td><td><CopyVal v={r.password} /></td>
                <td style={{ maxWidth: 260, wordBreak: 'break-all' }}>{r.note ?? ''}</td><td style={{ maxWidth: 220, wordBreak: 'break-all' }}>{r.extra ?? ''}</td>
                <td className="btn-row" style={{ margin: 0 }}><button className="ghost" onClick={() => setEditC(r)}>编辑</button><button className="ghost" onClick={() => delC(r)}>删除</button></td>
              </tr>
            ))}</tbody>
          </table>
          {!cShown.length && <p className="muted pad">还没有记录。到“导入旧表”导入 admin 页。</p>}
        </div>
      )}

      {tab === 'platform' && (
        <div className="table-wrap">
          <table style={{ minWidth: 1000 }}>
            <thead><tr><th>登录邮箱</th><th>Airbnb 密码</th><th>Google 密码</th><th>电话验证</th><th>房源</th><th></th></tr></thead>
            <tbody>{pShown.map((r) => (
              <tr key={r.id}>
                <td><CopyVal v={r.login} /></td><td><CopyVal v={r.password} /></td><td><CopyVal v={r.google_password} /></td>
                <td>{r.needs_verification ? <span className="chip amber" style={{ marginLeft: 0 }}>需要</span> : '—'}{r.note && <div className="muted small">{r.note}</div>}</td>
                <td style={{ maxWidth: 320 }}>{r.properties.length} 个：{r.properties.map((x) => x.name).join('、')}</td>
                <td><button className="ghost" onClick={() => setEditP(r)}>编辑</button></td>
              </tr>
            ))}</tbody>
          </table>
          {!pShown.length && <p className="muted pad">还没有记录。到“导入旧表”导入 Account 表。</p>}
        </div>
      )}

      {editC && <CompanyModal r={editC} onClose={() => setEditC(null)} onSave={saveC} />}
      {editP && <PlatModal r={editP} onClose={() => setEditP(null)} onSave={saveP} />}
    </div>
  )
}

function CompanyModal({ r, onClose, onSave }: { r: Partial<Company>; onClose: () => void; onSave: (r: Partial<Company>) => void }) {
  const [f, setF] = useState<Partial<Company>>(r)
  const set = (k: keyof Company, v: string) => setF({ ...f, [k]: v })
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{r.id ? '编辑' : '新增'}公司账号</h2>
        <label>名称<input value={f.reference ?? ''} onChange={(e) => set('reference', e.target.value)} placeholder="例如：Hostaway" /></label>
        <label>账号<input value={f.account ?? ''} onChange={(e) => set('account', e.target.value)} /></label>
        <label>密码<input value={f.password ?? ''} onChange={(e) => set('password', e.target.value)} /></label>
        <label>备注<input value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} /></label>
        <label>其他<input value={f.extra ?? ''} onChange={(e) => set('extra', e.target.value)} /></label>
        <div className="btn-row"><button onClick={() => onSave(f)}>保存</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}

function PlatModal({ r, onClose, onSave }: { r: Plat; onClose: () => void; onSave: (r: Plat) => void }) {
  const [f, setF] = useState<Plat>(r)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{r.login}</h2>
        <label>Airbnb 密码<input value={f.password ?? ''} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label>Google 密码<input value={f.google_password ?? ''} onChange={(e) => setF({ ...f, google_password: e.target.value })} /></label>
        <label><span><input type="checkbox" checked={f.needs_verification} onChange={(e) => setF({ ...f, needs_verification: e.target.checked })} /> 需要电话验证</span></label>
        <label>备注<input value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <div className="btn-row"><button onClick={() => onSave(f)}>保存</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
