import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const [account, setAccount] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr((await signIn(account, pwd)) ?? '')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>天枢</h1>
        <p className="muted">短租运营中台</p>
        <label>账号<input value={account} onChange={(e) => setAccount(e.target.value)} autoFocus autoComplete="username" /></label>
        <label>密码<input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="current-password" /></label>
        {err && <div className="err">{err}</div>}
        <button className="primary" disabled={busy}>{busy ? '登录中…' : '登录'}</button>
        <p className="muted small">忘记密码请联系管理员重置。</p>
      </form>
    </div>
  )
}
