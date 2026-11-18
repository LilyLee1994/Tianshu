import { adminClient, requireWorker, sydneyToday, type Req, type Res } from './_lib'

// 师傅 / 清洁公司提交动作：接单、提交完成、上报损坏
export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    const me = await requireWorker(req, res, db)
    if (!me) return
    const { orderId, action, amount, photos, text } = req.body ?? {}
    const id = Number(orderId)
    const { data: o } = await db.from('work_orders').select('id, type, status, assigned_to').eq('id', id).maybeSingle()
    if (!o || o.assigned_to !== me.id) return res.status(404).json({ error: '找不到这张工单。' })

    // 照片路径必须是这张工单自己的目录，防止塞别人的文件
    const paths: string[] = Array.isArray(photos) ? photos.map(String) : []
    if (paths.some((p) => !p.startsWith(`${id}/`) || p.includes('..'))) return res.status(400).json({ error: '照片不对。' })

    if (action === 'accept') {
      if (me.role !== 'repairman' || o.status !== '已派单') return res.status(400).json({ error: '现在不能接单。' })
      await db.from('work_orders').update({ status: '已接单' }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    if (action === 'complete') {
      if (me.role === 'repairman') {
        if (o.status !== '已接单') return res.status(400).json({ error: '要先接单才能提交完成。' })
        const n = Number(amount)
        if (amount === '' || amount === undefined || Number.isNaN(n) || n < 0) return res.status(400).json({ error: '请填实际费用（数字）。' })
        if (!paths.length) return res.status(400).json({ error: '请至少上传一张前后对比照片。' })
        await db.from('work_orders').update({ status: '待确认费用', amount: n, photos: paths, done_date: sydneyToday() }).eq('id', id)
      } else {
        if (o.status !== '已派单') return res.status(400).json({ error: '这张任务现在不能提交。' })
        if (!paths.length) return res.status(400).json({ error: '请至少上传一张清洁照片。' })
        await db.from('work_orders').update({ status: '已完成', photos: paths, done_date: sydneyToday() }).eq('id', id)
      }
      return res.status(200).json({ ok: true })
    }
    if (action === 'damage') {
      if (me.role !== 'cleaner' || o.status !== '已派单') return res.status(400).json({ error: '现在不能上报。' })
      if (!String(text ?? '').trim() || !paths.length) return res.status(400).json({ error: '请写清楚损坏情况，并至少上传一张照片。' })
      await db.from('work_orders').update({ damage_report: String(text).trim(), damage_photos: paths }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: '未知操作。' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
