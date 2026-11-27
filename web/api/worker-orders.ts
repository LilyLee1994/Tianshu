import { adminClient, requireWorker, type Req, type Res } from './_lib.js'
import { urgencyOf } from './_urgent.js'

// 列出派给我的工单（不含地址和密码）
export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const me = await requireWorker(req, res, db)
    if (!me) return
    const { data, error } = await db.from('work_orders')
      .select('id, property_id, reservation_id, type, description, status, urgent, planned_date, done_date, created_at, property:properties(name)')
      .eq('assigned_to', me.id).order('created_at', { ascending: false }).limit(100)
    if (error) return res.status(400).json({ error: error.message })
    const why = await urgencyOf(db, (data ?? []).filter((o) => !['已完成', '已取消'].includes(o.status)) as never)
    return res.status(200).json({ orders: (data ?? []).map((o) => ({ ...o, urgent_label: why[o.id]?.label ?? null })) })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
