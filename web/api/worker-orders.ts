import { adminClient, requireWorker, type Req, type Res } from './_lib.js'
import { urgencyOf } from './_urgent.js'

// 列出派给我的工单（不含地址和密码）
export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const me = await requireWorker(req, res, db)
    if (!me) return
    const { data, error } = await db.from('work_orders')
      .select('id, property_id, reservation_id, type, description, status, urgent, planned_date, done_date, created_at, property:properties(name, address)')
      .eq('assigned_to', me.id).order('created_at', { ascending: false }).limit(100)
    if (error) return res.status(400).json({ error: error.message })
    const why = await urgencyOf(db, (data ?? []).filter((o) => !['已完成', '已取消'].includes(o.status)) as never)
    return res.status(200).json({ orders: (data ?? []).map((o) => {
      // 地址和详情页一样的规则：清洁公司在“已派单”阶段能看，做完就隐藏；维修师傅接单前不给
      const p = o.property as unknown as { name: string; address: string | null } | null
      const showAddr = me.role === 'cleaner' && o.status === '已派单'
      return { ...o, property: p ? { name: p.name, address: showAddr ? p.address : null } : null, urgent_label: why[o.id]?.label ?? null }
    }) })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
