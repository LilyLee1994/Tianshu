import { supabase } from './supabase'

// 今天（悉尼）我要负责哪些助理的房源：自己的，加上今天休息、由我代班的搭档/被指定备选的人。
// 规则和排班页一致：本人休息 → 搭档；搭档也休息 → 备选；都不行 → 转管理员（管理员本来就能看全部）。
export async function coveredAssistantIds(me: string): Promise<Set<string>> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date())
  const [p, s] = await Promise.all([
    supabase.from('profiles').select('id, partner_id, backup_id').eq('role', 'assistant').eq('active', true),
    supabase.from('shifts').select('user_id').eq('date', today).eq('kind', '休息'),
  ])
  const rest = new Set((s.data ?? []).map((x) => x.user_id as string))
  const out = new Set<string>([me])
  for (const m of (p.data ?? []) as { id: string; partner_id: string | null; backup_id: string | null }[]) {
    if (m.id === me || !rest.has(m.id)) continue
    const who = m.partner_id && !rest.has(m.partner_id) ? m.partner_id : m.backup_id && !rest.has(m.backup_id) ? m.backup_id : null
    if (who === me) out.add(m.id)
  }
  return out
}
