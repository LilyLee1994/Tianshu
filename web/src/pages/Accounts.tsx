import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callApi } from '../lib/api'
import { ROLE_LABEL, type Role } from '../lib/auth'

interface User { id: string; account: string; name: string; role: Role; contact: string | null; active: boolean }
interface Prop { id: number; name: string; region: string | null; assistant_id: string | null; cleaning_by: string }

export default function Accounts() {
  const [users, setUsers] = useState<User[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [secret, setSecret] = useState<{ title: string; password: string } | null>(null)

  const load = useCallback(async () => {
    const [u, p] = await Promise.all([
      supabase.from('profiles').select('id, account, name, role, contact, active').order('created_at'),
      supabase.from('properties').select('id, name, region, assistant_id, cleaning_by').order('name'),
    ])
    if (u.data) setUsers(u.data as User[])
    if (p.data) setProps(p.data as Prop[])
  }, [])
  useEffect(() => { load() }, [load])

  const count = (uid: string) => props.filter((p) => p.assistant_id === uid).length
  const assistants = users.filter((u) => u.role === 'assistant' && u.active)

  const reset = async (u: User) => {
    setErr(''); setMsg('')
    const [r, e] = await callApi<{ password: string }>('reset-password', { userId: u.id })
    if (e || !r) { setErr(e ?? '重置失败'); return }
    setSecret({ title: `已重置 ${u.name} 的密码`, password: r.password })
  }
  const toggle = async (u: User) => {
    setErr(''); setMsg('')
    const [, e] = await callApi('set-active', { userId: u.id, active: !u.active })
    if (e) { setErr(e); return }
    setMsg(`${u.active ? '已停用' : '已启用'} ${u.name}`)
    load()
  }
  const setCleaning = async (p: Prop, v: string) => {
    setErr(''); setMsg('')
    const { data, error } = await supabase.from('properties').update({ cleaning_by: v }).eq('id', p.id).select('id')
    if (error || !data?.length) { setErr(error?.message ?? '没有权限。'); return }
    setMsg(`${p.name} 的清洁改为：${v}`)
    load()
  }
  const assign = async (p: Prop, uid: string) => {
    setErr(''); setMsg('')
    const { data, error } = await supabase.from('properties').update({ assistant_id: uid || null }).eq('id', p.id).select('id')
    if (error || !data?.length) { setErr(error?.message ?? '没有权限。'); return }
    setMsg(`已把 ${p.name} 的主责助理改为 ${assistants.find((a) => a.id === uid)?.name ?? '未分配'}`)
    load()
  }

  return (
    <div>
      <div className="title-row"><h1>账号与分配</h1><button className="primary small-btn" onClick={() => setAdding(true)}>＋ 新建账号</button></div>
      <p className="muted">只有管理员能看到这一页。停用后该人马上登不进系统，历史记录保留；助理还负责房源时不能停用，需要先把房源重新分配。</p>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err-box">{err}</div>}
      {secret && (
        <div className="secret">
          <b>{secret.title}</b>
          <div className="pwd">{secret.password}</div>
          <div className="small">这个密码只显示这一次，请马上告诉本人，让他登录后在左下角自己改。</div>
          <button className="ghost" onClick={() => setSecret(null)}>我已记下</button>
        </div>
      )}
      <div className="table-wrap">
        <table style={{ minWidth: 760 }}>
          <thead><tr><th>姓名</th><th>登录账号</th><th>角色</th><th>联系方式</th><th>负责房源</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td><td>{u.account}</td><td>{ROLE_LABEL[u.role]}</td><td>{u.contact ?? '—'}</td>
                <td>{u.role === 'assistant' ? `${count(u.id)} 个` : '—'}</td>
                <td><span className={u.active ? 'chip green' : 'chip gray'}>{u.active ? '启用' : '停用'}</span></td>
                <td className="btn-row" style={{ margin: 0 }}>
                  <button className="ghost" onClick={() => reset(u)}>重置密码</button>
                  <button className="ghost" onClick={() => toggle(u)}>{u.active ? '停用' : '启用'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>房源分配</h2>
      <div className="table-wrap">
        <table style={{ minWidth: 520 }}>
          <thead><tr><th>房源</th><th>区域</th><th>主责助理</th><th>清洁由谁做</th></tr></thead>
          <tbody>
            {props.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b></td><td>{p.region ?? '—'}</td>
                <td><select value={p.assistant_id ?? ''} onChange={(e) => assign(p, e.target.value)}>
                  <option value="">未分配</option>{assistants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></td>
                <td><select value={p.cleaning_by} onChange={(e) => setCleaning(p, e.target.value)}><option value="清洁公司">Alisa</option><option value="房东自己">房东自己</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.length && <p className="muted pad">还没有房源。</p>}
      </div>
      <p className="muted small">分配后，该房源的新工单和通知都发给主责助理。清洁选“房东自己”的房源，退房后不会自动生成清洁单。</p>

      {adding && <AddUser onClose={() => setAdding(false)} onDone={(name, password) => { setAdding(false); setSecret({ title: `已创建账号 ${name}，初始密码`, password }); load() }} />}
    </div>
  )
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: (name: string, password: string) => void }) {
  const [f, setF] = useState({ account: '', name: '', role: 'assistant' as Role, contact: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setBusy(true); setErr('')
    const [r, e] = await callApi<{ password: string }>('create-user', f)
    setBusy(false)
    if (e || !r) { setErr(e ?? '创建失败'); return }
    onDone(f.name, r.password)
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>新建账号</h2>
        <label>登录账号（字母或数字，如 ash）<input autoFocus value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} /></label>
        <label>姓名<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>角色<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select></label>
        <label>联系方式（选填，通知用）<input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
        <p className="muted small">创建后系统生成一个初始密码，只显示一次，你告诉本人，他登录后自己改。</p>
        {err && <div className="err">{err}</div>}
        <div className="btn-row">
          <button className="primary small-btn" disabled={busy} onClick={save}>{busy ? '创建中…' : '创建'}</button>
          <button className="ghost" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}
