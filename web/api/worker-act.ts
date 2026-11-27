import { adminClient, requireWorker, sydneyToday, type Req, type Res } from './_lib.js'
import { notifyUser } from './_notify.js'

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

    // 师傅有动作时，微信通知这套房的主责助理
    const tellAssistant = async (what: string) => {
      const { data: w } = await db.from('work_orders').select('type, description, property:properties(name, assistant_id)').eq('id', id).maybeSingle()
      const p = (w?.property as unknown as { name: string; assistant_id: string | null } | null)
      if (p?.assistant_id) await notifyUser(db, p.assistant_id, `${p.name} · ${w?.type}：${what}`, `${p.name}<br>${w?.type}：${String(w?.description ?? '').replace(/^【索赔#\d+】/, '')}<br>${what}`)
    }

    // 照片路径必须是这张工单自己的目录，防止塞别人的文件
    const paths: string[] = Array.isArray(photos) ? photos.map(String) : []
    if (paths.some((p) => !p.startsWith(`${id}/`) || p.includes('..'))) return res.status(400).json({ error: '照片不对。' })

    if (action === 'accept') {
      if (me.role !== 'repairman' || o.status !== '已派单') return res.status(400).json({ error: '现在不能接单。' })
      const u = await db.from('work_orders').update({ status: '已接单' }).eq('id', id)
      if (u.error) return res.status(400).json({ error: `保存失败：${u.error.message}` })
      await tellAssistant('师傅已接单')
      return res.status(200).json({ ok: true })
    }
    if (action === 'complete') {
      if (me.role === 'repairman') {
        if (o.status !== '已接单') return res.status(400).json({ error: '要先接单才能提交完成。' })
        const n = Number(amount)
        if (amount === '' || amount === undefined || Number.isNaN(n) || n < 0) return res.status(400).json({ error: '请填实际费用（数字）。' })
        if (!paths.length) return res.status(400).json({ error: '请至少上传一张前后对比照片。' })
        const u = await db.from('work_orders').update({ status: '待确认费用', amount: n, photos: paths, done_date: sydneyToday() }).eq('id', id)
        if (u.error) return res.status(400).json({ error: `保存失败：${u.error.message}` })
      } else {
        if (o.status !== '已派单') return res.status(400).json({ error: '这张任务现在不能提交。' })
        if (!paths.length) return res.status(400).json({ error: '请至少上传一张清洁照片。' })
        const u = await db.from('work_orders').update({ status: '已完成', photos: paths, done_date: sydneyToday() }).eq('id', id)
        if (u.error) return res.status(400).json({ error: `保存失败：${u.error.message}` })
      }
      await tellAssistant(me.role === 'repairman' ? '师傅已完成，请确认费用' : '清洁已完成')
      return res.status(200).json({ ok: true })
    }
    if (action === 'damage') {
      if (me.role !== 'cleaner' || o.status !== '已派单') return res.status(400).json({ error: '现在不能上报。' })
      if (!String(text ?? '').trim() || !paths.length) return res.status(400).json({ error: '请写清楚损坏情况，并至少上传一张照片。' })
      const u = await db.from('work_orders').update({ damage_report: String(text).trim(), damage_photos: paths }).eq('id', id)
      if (u.error) return res.status(400).json({ error: `保存失败：${u.error.message}` })
      // 同时在“索赔”里生成一条待提交的草稿（带照片），助理在索赔页处理
      const { data: wo } = await db.from('work_orders').select('property_id, reservation_id').eq('id', id).maybeSingle()
      if (wo) {
        let guest: string | null = null
        if (wo.reservation_id) guest = ((await db.from('reservations').select('guest_name').eq('id', wo.reservation_id).maybeSingle()).data?.guest_name as string | null) ?? null
        const row = { property_id: wo.property_id, platform: 'Airbnb', occurred_date: sydneyToday(), content: `【清洁上报损坏】${String(text).trim()}`, status: '待提交', photos: paths }
        const ex = await db.from('claims').select('id').eq('work_order_id', id).maybeSingle()
        const r = ex.data ? await db.from('claims').update({ content: row.content, photos: paths }).eq('id', ex.data.id)
          : await db.from('claims').insert({ ...row, work_order_id: id, guest_name: guest })
        if (r.error) await db.from('claims').insert(row) // 还没运行 049 / 051 时，不带关联和入住人也要生成
        await db.from('work_orders').update({ damage_handled: true }).eq('id', id)
      }
      await tellAssistant('清洁上报了损坏，请到索赔里处理')
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: '未知操作。' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
