import { adminClient, authenticate, type Req, type Res } from './_lib.js'
import { notifyUser } from './_notify.js'

// 助理派单后，通知被派的师傅 / 清洁公司
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: '只支持 POST。' })
    const db = adminClient()
    const me = await authenticate(req, res, db)
    if (!me) return
    if (!['admin', 'assistant', 'ops', 'finance'].includes(me.role)) return res.status(403).json({ error: '没有权限。' })
    const { orderId } = req.body ?? {}
    const { data: o } = await db.from('work_orders').select('id, type, description, status, assigned_to, urgent, property:properties(name)').eq('id', Number(orderId)).maybeSingle()
    if (!o || !o.assigned_to || o.status !== '已派单') return res.status(200).json({ ok: true, sent: false })
    const prop = (o.property as unknown as { name: string } | null)?.name ?? ''
    await notifyUser(db, o.assigned_to as string, `新任务：${prop} · ${o.type}${o.urgent ? '（紧急）' : ''}`, `${prop}<br>${o.type}：${String(o.description ?? '').replace(/^【索赔#\d+】/, '') || '请打开天枢查看详情'}`)
    return res.status(200).json({ ok: true, sent: true })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : '服务器出错' })
  }
}
