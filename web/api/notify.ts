import { adminClient, authenticate, type Req, type Res } from './_lib.js'
import { notifyGroup, GROUP_LABEL, type NotifyGroup } from './_notify.js'

// 助理派单后，通知被派的师傅 / 清洁公司所在的群；管理员也可以发一条测试消息
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: '只支持 POST。' })
    const db = adminClient()
    const me = await authenticate(req, res, db)
    if (!me) return
    const { orderId, test } = req.body ?? {}

    if (test) {
      if (me.role !== 'admin') return res.status(403).json({ error: '只有管理员能发测试消息。' })
      if (!(test in GROUP_LABEL)) return res.status(400).json({ error: '群类型不对。' })
      const r = await notifyGroup(db, test as NotifyGroup, '天枢测试消息', [`这是发给${GROUP_LABEL[test as NotifyGroup]}的一条测试，收到说明设置成功。`])
      return r.ok ? res.status(200).json({ ok: true }) : res.status(400).json({ error: r.error ?? '发送失败' })
    }

    if (!['admin', 'assistant', 'ops', 'finance'].includes(me.role)) return res.status(403).json({ error: '没有权限。' })
    const { data: o } = await db.from('work_orders').select('id, type, description, status, assigned_to, urgent, property:properties(name)').eq('id', Number(orderId)).maybeSingle()
    if (!o || !o.assigned_to || o.status !== '已派单') return res.status(200).json({ ok: true, sent: false })
    const { data: w } = await db.from('profiles').select('name, role').eq('id', o.assigned_to as string).maybeSingle()
    if (!w) return res.status(200).json({ ok: true, sent: false })
    const prop = (o.property as unknown as { name: string } | null)?.name ?? ''
    const desc = String(o.description ?? '').replace(/^【索赔#\d+】/, '') || '请打开天枢查看详情'
    const r = await notifyGroup(db, w.role === 'cleaner' ? 'cleaner' : 'repairman', `新任务 @${w.name}${o.urgent ? '（紧急）' : ''}`, [`房源：${prop}`, `类型：${o.type}`, `内容：${desc}`])
    return res.status(200).json({ ok: true, sent: r.ok })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : '服务器出错' })
  }
}
