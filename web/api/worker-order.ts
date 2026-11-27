import { adminClient, requireWorker, type Req, type Res } from './_lib.js'
import { urgencyOf } from './_urgent.js'

// 工单详情。地址和进门方式只在该看的时候给：
// 清洁公司：派单后到完成前；维修师傅：接单后到提交完成前。
export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const me = await requireWorker(req, res, db)
    if (!me) return
    const id = Number(req.body?.orderId)
    const { data: o } = await db.from('work_orders')
      .select('id, property_id, reservation_id, type, description, status, urgent, planned_date, assigned_to, damage_report, property:properties(name, address)')
      .eq('id', id).maybeSingle()
    if (!o || o.assigned_to !== me.id) return res.status(404).json({ error: '找不到这张工单。' })

    const showAccess = me.role === 'cleaner' ? o.status === '已派单' : o.status === '已接单'
    let access: Record<string, string | null> | null = null
    if (showAccess) {
      const { data: d } = await db.from('property_details').select('lock_location, lock_code, notes').eq('property_id', o.property_id).maybeSingle()
      access = d ?? null
    }
    // 清洁公司：派单后到完成前，能看到对应订单的备注（订单备注 / 客人留言 / 房东备注），方便提前知道有没有特殊情况
    let notes: { label: string; text: string }[] = []
    if (me.role === 'cleaner' && o.status === '已派单' && o.reservation_id) {
      const { data: r } = await db.from('reservations').select('c:raw->>comment, g:raw->>guestNote, h:raw->>hostNote').eq('id', o.reservation_id).maybeSingle()
      const x = r as unknown as { c: string | null; g: string | null; h: string | null } | null
      notes = ([['订单备注', x?.c], ['客人留言', x?.g], ['房东备注', x?.h]] as [string, string | null | undefined][]).filter(([, v]) => v && v.trim()).map(([label, v]) => ({ label, text: String(v).trim().slice(0, 500) }))
    }
    const why = o.status === '已完成' ? {} : await urgencyOf(db, [o as never])
    const p = o.property as unknown as { name: string; address: string | null } | null
    return res.status(200).json({
      order: { id: o.id, type: o.type, description: o.description, status: o.status, urgent: o.urgent, planned_date: o.planned_date, damage_report: o.damage_report, urgent_text: why[o.id]?.text ?? null },
      property: { name: p?.name, address: showAccess ? p?.address : null },
      access,
      notes,
      accessHidden: !showAccess,
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
