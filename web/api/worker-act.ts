import { adminClient, authenticate, requireWorker, sydneyToday, type Req, type Res } from './_lib.js'
import { notifyGroup, GROUP_LABEL, type NotifyGroup } from './_notify.js'
import { urgencyOf } from './_urgent.js'

// 师傅 / 清洁公司提交动作：接单、提交完成、上报损坏。
// 另外两个给员工用的通知动作（notify 派单通知、notify-test 测试消息）也放在这里：Vercel 免费版最多 12 个函数，不能再单开文件。
async function staffNotify(req: Req, res: Res, db: ReturnType<typeof adminClient>) {
  const me = await authenticate(req, res, db)
  if (!me) return
  const { orderId, action, group } = req.body ?? {}
  if (action === 'notify-test') {
    if (me.role !== 'admin') return res.status(403).json({ error: '只有管理员能发测试消息。' })
    if (!(group in GROUP_LABEL)) return res.status(400).json({ error: '群类型不对。' })
    const r = await notifyGroup(db, group as NotifyGroup, '天枢测试消息', [`这是发给${GROUP_LABEL[group as NotifyGroup]}的一条测试，收到说明设置成功。`])
    return r.ok ? res.status(200).json({ ok: true }) : res.status(400).json({ error: r.error ?? '发送失败' })
  }
  if (!['admin', 'assistant', 'ops', 'finance'].includes(me.role)) return res.status(403).json({ error: '没有权限。' })
  if (action === 'notify-cleaning') {   // 助理一键派发清洁单后，把这一批汇总发到清洁群（当天有入住的排最前面）
    const ids = (Array.isArray(req.body?.orderIds) ? req.body.orderIds : []).map(Number).filter(Boolean)
    if (!ids.length) return res.status(400).json({ error: '没有选择清洁单。' })
    const { data: os } = await db.from('work_orders').select('id, property_id, type, planned_date, urgent, reservation_id, status, property:properties(name)').in('id', ids).eq('type', '清洁').eq('status', '已派单')
    if (!os?.length) return res.status(200).json({ ok: true, sent: false })
    const why = await urgencyOf(db, os as never)
    const rank = (o: { id: number; urgent: boolean }) => (why[o.id]?.label === '当天入住' ? 0 : o.urgent ? 1 : 2)
    const lines = [...os].sort((x, y) => rank(x as never) - rank(y as never) || String(x.planned_date).localeCompare(String(y.planned_date))).map((o) => {
      const tag = why[o.id]?.label === '当天入住' ? '【最紧急·当天入住】' : why[o.id]?.label === '次日入住' ? '【紧急·次日入住】' : o.urgent ? '【紧急】' : ''
      return `${tag}${(o.property as unknown as { name: string } | null)?.name ?? ''}，退房 ${String(o.planned_date ?? '').slice(5)}`
    })
    const r = await notifyGroup(db, 'cleaner', `新增 ${os.length} 张清洁单`, lines)
    return r.ok ? res.status(200).json({ ok: true, sent: true }) : res.status(400).json({ error: r.error ?? '发送失败' })
  }
  const { data: o } = await db.from('work_orders').select('id, type, description, status, assigned_to, urgent, property:properties(name)').eq('id', Number(orderId)).maybeSingle()
  if (!o || !o.assigned_to || o.status !== '已派单') return res.status(200).json({ ok: true, sent: false })
  const { data: w } = await db.from('profiles').select('name, role').eq('id', o.assigned_to as string).maybeSingle()
  if (!w) return res.status(200).json({ ok: true, sent: false })
  const prop = (o.property as unknown as { name: string } | null)?.name ?? ''
  const desc = String(o.description ?? '').replace(/^【索赔#\d+】/, '') || '请打开天枢查看详情'
  const r = await notifyGroup(db, w.role === 'cleaner' ? 'cleaner' : 'repairman', `新任务 @${w.name}${o.urgent ? '（紧急）' : ''}`, [`房源：${prop}`, `类型：${o.type}`, `内容：${desc}`])
  return res.status(200).json({ ok: true, sent: r.ok })
}

export default async function handler(req: Req, res: Res) {
  try {
    const db = adminClient()
    if (['notify', 'notify-test', 'notify-cleaning'].includes(req.body?.action)) return await staffNotify(req, res, db)
    const me = await requireWorker(req, res, db)
    if (!me) return
    const { orderId, action, amount, photos, text } = req.body ?? {}
    const id = Number(orderId)
    const { data: o } = await db.from('work_orders').select('id, type, status, assigned_to').eq('id', id).maybeSingle()
    if (!o || o.assigned_to !== me.id) return res.status(404).json({ error: '找不到这张工单。' })

    // 师傅有动作时，发到助理群，写明是哪套房的主责助理
    const tellAssistant = async (what: string) => {
      const { data: w } = await db.from('work_orders').select('type, description, property:properties(name, assistant_id)').eq('id', id).maybeSingle()
      const p = (w?.property as unknown as { name: string; assistant_id: string | null } | null)
      if (!p) return
      const ids = [me.id, p.assistant_id].filter(Boolean) as string[]
      const { data: ps } = await db.from('profiles').select('id, name').in('id', ids)
      const nm = (x: string | null) => (ps ?? []).find((q) => q.id === x)?.name ?? ''
      await notifyGroup(db, 'assistant', `${p.name} · ${w?.type}：${what}`, [nm(p.assistant_id) ? `主责助理：@${nm(p.assistant_id)}` : '', `内容：${String(w?.description ?? '').replace(/^【索赔#\d+】/, '')}`, `提交人：${nm(me.id)}`])
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
