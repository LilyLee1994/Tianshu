import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout, { NAV } from './layout/Layout'
import Login from './pages/Login'
import Properties from './pages/Properties'
import Placeholder from './pages/Placeholder'
import Accounts from './pages/Accounts'
import Orders from './pages/Orders'
import Fees from './pages/Fees'
import Contracts from './pages/Contracts'
import Dashboard from './pages/Dashboard'
import Reviews from './pages/Reviews'
import Statements from './pages/Statements'
import DataCheck from './pages/DataCheck'
import WorkerApp from './pages/WorkerApp'

const PAGES: Record<string, React.ReactElement> = {
  '/': <Dashboard />, '/properties': <Properties />, '/orders': <Orders />, '/fees': <Fees />, '/contracts': <Contracts />, '/accounts': <Accounts />, '/data': <DataCheck />, '/reviews': <Reviews />, '/statements': <Statements />,
}

function Gate() {
  const { loading, profile } = useAuth()
  if (loading) return <p className="muted pad">加载中…</p>
  if (!profile) return <Login />
  if (profile.role === 'repairman' || profile.role === 'cleaner') return <WorkerApp />
  return (
    <Routes>
      <Route element={<Layout />}>
        {NAV.filter((n) => n.roles.includes(profile.role)).map((n) => (
          <Route key={n.to} path={n.to} element={PAGES[n.to] ?? <Placeholder title={n.label} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><Gate /></AuthProvider></BrowserRouter>
}
