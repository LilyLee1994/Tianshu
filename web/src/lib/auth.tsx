import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type Role = 'admin' | 'assistant' | 'ops' | 'finance' | 'repairman' | 'cleaner'
export interface Profile { id: string; account: string; name: string; role: Role; active: boolean }

export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员', assistant: '客服助理', ops: '运营/审核', finance: '财务', repairman: '维修师傅', cleaner: '清洁公司',
}

interface AuthState {
  loading: boolean
  profile: Profile | null
  signIn: (account: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthState>(null as never)
export const useAuth = () => useContext(Ctx)

// 用户只输入账号，系统内部拼成邮箱交给 Supabase
const toEmail = (account: string) => `${account.trim().toLowerCase()}@tianshu.local`

async function loadProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('id, account, name, role, active').eq('id', user.id).maybeSingle()
  return data && data.active ? (data as Profile) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setProfile(data.session ? await loadProfile() : null)
      setLoading(false)
    })
  }, [])

  const signIn = async (account: string, password: string) => {
    if (!account.trim() || !password) return '请输入账号和密码。'
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(account), password })
    if (error) return '账号或密码不对。'
    const p = await loadProfile()
    if (!p) { await supabase.auth.signOut(); return '账号已停用或还没开通，请联系管理员。' }
    setProfile(p)
    return null
  }
  const signOut = async () => { await supabase.auth.signOut(); setProfile(null) }

  return <Ctx.Provider value={{ loading, profile, signIn, signOut }}>{children}</Ctx.Provider>
}
