import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout, { NAV } from './layout/Layout'
import Login from './pages/Login'
import Properties from './pages/Properties'
import Placeholder from './pages/Placeholder'

function Gate() {
  const { loading, profile } = useAuth()
  if (loading) return <p className="muted pad">加载中…</p>
  if (!profile) return <Login />
  if (profile.role === 'repairman' || profile.role === 'cleaner') {
    return <div className="login-wrap"><div className="login-card"><h1>天枢</h1><p>维修师傅和清洁公司请用发给你的手机链接，不用登录这里。</p></div></div>
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
          <Route key={n.to} path={n.to} element={n.to === '/properties' ? <Properties /> : <Placeholder title={n.label} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><Gate /></AuthProvider></BrowserRouter>
}
