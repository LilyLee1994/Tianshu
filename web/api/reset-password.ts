import { adminClient, genPassword, requireAdmin, type Req, type Res } from './_lib'

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (!(await requireAdmin(req, res, db))) return
    const userId = String(req.body?.userId ?? '')
    if (!userId) return res.status(400).json({ error: '缺少用户。' })
    const password = genPassword()
    const { error } = await db.auth.admin.updateUserById(userId, { password })
    if (error) return res.status(400).json({ error: `重置失败：${error.message}` })
    return res.status(200).json({ ok: true, password })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
