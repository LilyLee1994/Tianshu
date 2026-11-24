import { adminClient, emailOf, genPassword, requireAdmin, type Req, type Res } from './_lib.js'

const ROLES = ['admin', 'assistant', 'ops', 'finance', 'repairman', 'cleaner']

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (!(await requireAdmin(req, res, db))) return
    const { account, name, role, contact, password: given } = req.body ?? {}
    const acc = String(account ?? '').trim().toLowerCase()
    if (!/^[a-z0-9_-]{2,30}$/.test(acc)) return res.status(400).json({ error: '登录账号只能用字母、数字、下划线、短横线，2–30 位。' })
    if (!String(name ?? '').trim()) return res.status(400).json({ error: '请填姓名。' })
    if (!ROLES.includes(role)) return res.status(400).json({ error: '角色不对。' })

    if (given !== undefined && (typeof given !== 'string' || given.length < 8)) return res.status(400).json({ error: '密码至少 8 位。' })
    const password = typeof given === 'string' ? given : genPassword()
    const { data, error } = await db.auth.admin.createUser({ email: emailOf(acc), password, email_confirm: true })
    if (error || !data.user) {
      return res.status(400).json({ error: /already|exists|registered/i.test(error?.message ?? '') ? '这个账号已经有人用了。' : `创建失败：${error?.message}` })
    }
    const { error: pe } = await db.from('profiles').insert({
      id: data.user.id, account: acc, name: String(name).trim(), role, contact: String(contact ?? '').trim() || null,
    })
    if (pe) {
      await db.auth.admin.deleteUser(data.user.id)
      return res.status(400).json({ error: `创建失败：${pe.message}` })
    }
    return res.status(200).json({ ok: true, userId: data.user.id, password })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
