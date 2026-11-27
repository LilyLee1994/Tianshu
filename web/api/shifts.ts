import { adminClient, authenticate, type Req, type Res } from './_lib.js'

// 每月 27 号（悉尼时间）开放下个月的排班填写；27 号之前只能填当月
const SYD_OPEN_DAY = 27
function openMonth(): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()).split('-').map(Number)
  const t = d >= SYD_OPEN_DAY ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m]
  return `${t[0]}-${String(t[1]).padStart(2, '0')}`
}
const isMonth = (m: unknown) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01` }
const inMonth = (d: unknown, m: string) => typeof d === 'string' && d.startsWith(`${m}-`) && !Number.isNaN(Date.parse(d))

export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: '只支持 POST。' })
    const db = adminClient()
    const c = await authenticate(req, res, db)
    if (!c) return
    const { action, month, rest, home, reason, id, approve, user_id, date, kind, partner_id, backup_id } = req.body ?? {}
    const admin = c.role === 'admin'

    // 本人提交下月（或当月）的休息日和居家办公日，提交后锁定
    if (action === 'submit') {
      if (c.role !== 'assistant') return res.status(403).json({ error: '只有客服助理需要填排班。' })
      if (!isMonth(month)) return res.status(400).json({ error: '月份格式不对。' })
      if (month > openMonth()) return res.status(400).json({ error: `${month} 的排班要等上个月 ${SYD_OPEN_DAY} 号才开放填写。` })
      const R: string[] = Array.isArray(rest) ? rest : [], H: string[] = Array.isArray(home) ? home : []
      if (![...R, ...H].every((d) => inMonth(d, month))) return res.status(400).json({ error: '有日期不在这个月内。' })
      if (new Set(R).size !== 4 || new Set(H).size !== 4) return res.status(400).json({ error: `必须正好选 4 天休息和 4 天居家办公才能提交（现在是休息 ${new Set(R).size} 天、居家 ${new Set(H).size} 天）。` })
      if (R.some((d) => H.includes(d))) return res.status(400).json({ error: '同一天不能既休息又居家。' })
      const { data: m } = await db.from('shift_months').select('status').eq('user_id', c.id).eq('month', `${month}-01`).maybeSingle()
      if (m?.status === '已提交') return res.status(400).json({ error: '这个月已经提交并锁定，要改请先申请变更。' })
      // 搭档 / 备选跟着提交一起保存（页面传了才处理）
      if (partner_id !== undefined || backup_id !== undefined) {
        const pid = partner_id || null, bid = backup_id || null
        if (pid === c.id || bid === c.id) return res.status(400).json({ error: '搭档和备选不能是自己。' })
        if (pid && pid === bid) return res.status(400).json({ error: '搭档和备选不能是同一个人。' })
        for (const id of [pid, bid].filter(Boolean)) {
          const { data: pr } = await db.from('profiles').select('role, active').eq('id', id).maybeSingle()
          if (!pr || pr.role !== 'assistant' || !pr.active) return res.status(400).json({ error: '搭档只能选在职的客服助理。' })
        }
        const { error: pe } = await db.from('profiles').update({ partner_id: pid, backup_id: bid }).eq('id', c.id)
        if (pe) return res.status(500).json({ error: pe.message })
      }
      const from = `${month}-01`, to = nextMonth(month)
      await db.from('shifts').delete().eq('user_id', c.id).gte('date', from).lt('date', to)
      const rows = [...R.map((d) => ({ user_id: c.id, date: d, kind: '休息' })), ...H.map((d) => ({ user_id: c.id, date: d, kind: '居家' }))]
      if (rows.length) { const { error } = await db.from('shifts').insert(rows); if (error) return res.status(500).json({ error: error.message }) }
      await db.from('shift_months').upsert({ user_id: c.id, month: from, status: '已提交', submitted_at: new Date().toISOString() }, { onConflict: 'user_id,month' })
      return res.status(200).json({ ok: true })
    }

    // 已锁定后申请变更
    if (action === 'request') {
      if (!isMonth(month)) return res.status(400).json({ error: '月份格式不对。' })
      const from = `${month}-01`
      const { data: m } = await db.from('shift_months').select('status').eq('user_id', c.id).eq('month', from).maybeSingle()
      if (m?.status !== '已提交') return res.status(400).json({ error: '这个月还没提交，直接修改即可。' })
      const { data: pend } = await db.from('shift_requests').select('id').eq('user_id', c.id).eq('month', from).eq('status', '待审批').maybeSingle()
      if (pend) return res.status(400).json({ error: '已经有一条待审批的变更申请。' })
      await db.from('shift_requests').insert({ user_id: c.id, month: from, reason: reason || null })
      return res.status(200).json({ ok: true })
    }

    // 搭档/备选：助理自己选自己的，管理员可以改任何人
    if (action === 'set_partner') {
      const target = admin ? user_id : c.id
      if (!admin && user_id && user_id !== c.id) return res.status(403).json({ error: '只能设置自己的搭档。' })
      if (!target || partner_id === target || backup_id === target) return res.status(400).json({ error: '搭档和备选不能是自己。' })
      if (partner_id && partner_id === backup_id) return res.status(400).json({ error: '搭档和备选不能是同一个人。' })
      for (const id of [partner_id, backup_id].filter(Boolean)) {
        const { data: pr } = await db.from('profiles').select('role, active').eq('id', id).maybeSingle()
        if (!pr || pr.role !== 'assistant' || !pr.active) return res.status(400).json({ error: '搭档只能选在职的客服助理。' })
      }
      const { error } = await db.from('profiles').update({ partner_id: partner_id || null, backup_id: backup_id || null }).eq('id', target)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (!admin) return res.status(403).json({ error: '只有管理员可以做这个操作。' })

    // 批准：解锁该月让本人修改后重新提交；驳回：保持锁定
    if (action === 'decide') {
      const { data: rq } = await db.from('shift_requests').select('*').eq('id', id).maybeSingle()
      if (!rq || rq.status !== '待审批') return res.status(400).json({ error: '找不到待审批的申请。' })
      await db.from('shift_requests').update({ status: approve ? '已批准' : '已驳回', decided_at: new Date().toISOString() }).eq('id', id)
      if (approve) await db.from('shift_months').update({ status: '草稿' }).eq('user_id', rq.user_id).eq('month', rq.month)
      return res.status(200).json({ ok: true })
    }

    // 管理员直接改某人某天（用来解决搭档撞休息日）
    if (action === 'admin_set') {
      if (!user_id || typeof date !== 'string' || Number.isNaN(Date.parse(date))) return res.status(400).json({ error: '参数不对。' })
      if (!kind) await db.from('shifts').delete().eq('user_id', user_id).eq('date', date)
      else if (kind === '休息' || kind === '居家') await db.from('shifts').upsert({ user_id, date, kind }, { onConflict: 'user_id,date' })
      else return res.status(400).json({ error: '类型不对。' })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: '未知操作。' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
