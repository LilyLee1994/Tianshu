import { NavLink, Outlet } from 'react-router-dom'
import { ROLE_LABEL, useAuth, type Role } from '../lib/auth'

const ALL: Role[] = ['admin', 'assistant', 'ops', 'finance']
export const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: '总览', roles: ALL },
  { to: '/properties', label: '房源档案', roles: ALL },
  { to: '/orders', label: '工单', roles: ALL },
  { to: '/claims', label: '索赔', roles: ALL },
  { to: '/reviews', label: '差评', roles: ALL },
  { to: '/fees', label: '清洁费', roles: ALL },
  { to: '/contracts', label: '合同财务', roles: ALL },
  { to: '/shifts', label: '排班', roles: ALL },
  { to: '/assets', label: '公用物品', roles: ALL },
  { to: '/statements', label: '房东结算（财务）', roles: ALL },
  { to: '/company', label: '公司款项', roles: ALL },
  { to: '/accounts', label: '账号与分配', roles: ['admin'] },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  if (!profile) return null
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
          <button onClick={signOut}>退出登录</button>
        </div>
      </aside>
      <main><Outlet /></main>
    </div>
  )
}
