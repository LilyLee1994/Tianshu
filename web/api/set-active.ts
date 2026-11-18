import { adminClient, requireAdmin, type Req, type Res } from './_lib'

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const me = await requireAdmin(req, res, db)
    if (!me) return
    const userId = String(req.body?.userId ?? '')
    const active = !!req.body?.active
    if (!userId) return res.status(400).json({ error: '缺少用户。' })
    if (!active) {
      if (userId === me.id) return res.status(400).json({ error: '不能停用你自己。' })
      const { count } = await db.from('properties').select('id', { count: 'exact', head: true }).eq('assistant_id', userId)
      if (count) return res.status(400).json({ error: `他还负责 ${count} 个房源，请先重新分配，再停用。` })
    }
    const { error: ae } = await db.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })
    if (ae) return res.status(400).json({ error: ae.message })
    const { error } = await db.from('profiles').update({ active }).eq('id', userId)
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
