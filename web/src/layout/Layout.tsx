import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, useAuth, type Role } from '../lib/auth'

const ALL: Role[] = ['admin', 'assistant', 'ops', 'finance']
export const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: '总览', roles: ALL },
  { to: '/properties', label: '房源档案', roles: ALL },
  { to: '/orders', label: '工单', roles: ALL },
  { to: '/onboarding', label: '新房源上线', roles: ALL },
  { to: '/alerts', label: '订单异常', roles: ALL },
  { to: '/claims', label: '索赔', roles: ALL },
  { to: '/reviews', label: '差评', roles: ALL },
  { to: '/fees', label: '清洁费', roles: ['admin'] },
  { to: '/contracts', label: '合同财务', roles: ALL },
  { to: '/shifts', label: '排班', roles: ALL },
  { to: '/statements', label: '房东结算', roles: ALL },
  { to: '/company', label: '公司款项', roles: ALL },
  { to: '/accounts', label: '账号与分配', roles: ['admin'] },
  { to: '/vault', label: '账号库', roles: ['admin'] },
  { to: '/import', label: '导入旧表', roles: ['admin'] },
  { to: '/data', label: '同步数据检查', roles: ['admin'] },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const [pw, setPw] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState('')
  if (!profile) return null
  const savePw = async () => {
    if ((pw ?? '').length < 8) { setPwMsg('密码至少 8 位。'); return }
    const { error } = await supabase.auth.updateUser({ password: pw! })
    if (error) { setPwMsg(`修改失败：${error.message}`); return }
    setPw(null); setPwMsg('')
    alert('密码已修改。')
  }
  return (
    <div className="shell">
      <aside>
        <div className="brand">天枢</div>
        <nav>
          {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <div>{profile.name}</div>
          <div className="small">{ROLE_LABEL[profile.role]}</div>
          <button onClick={() => { setPw(''); setPwMsg('') }}>修改密码</button>
          <button onClick={signOut}>退出登录</button>
        </div>
      </aside>
      <main><Outlet /></main>
      {pw !== null && (
        <div className="modal-bg" onClick={() => setPw(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>修改密码</h2>
            <label>新密码（至少 8 位）<input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            {pwMsg && <div className="err">{pwMsg}</div>}
            <div className="btn-row"><button className="primary small-btn" onClick={savePw}>保存</button><button className="ghost" onClick={() => setPw(null)}>取消</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
