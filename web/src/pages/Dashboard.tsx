import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabase as _s } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { startSync, useSync } from '../lib/syncStore'
import { statusOf } from './Properties'
import { daysTo } from './Contracts'
import { badOne } from './Reviews'
import { openMonth, OPEN_DAY } from './Shifts'
import { coveredAssistantIds } from '../lib/cover'

type Lv = 'red' | 'orange' | 'yellow' | 'blue'
interface Todo { tag: string; text: string; to: string; cls: string; lv: Lv }
const LV: { k: Lv; label: string; hint: string }[] = [
  { k: 'red', label: '紧急', hint: '差评、订单异常、待派单、合同 7 天内到期' },
  { k: 'orange', label: '尽快', hint: '索赔待提交、确认费用、通知房东、合同 30 天内到期' },
  { k: 'yellow', label: '留意', hint: '确认完成、合同信息没填完、排班变更申请、合同 60 天内到期' },
  { k: 'blue', label: '日常', hint: '排班填写提醒' },
]

export default function Dashboard() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const [run, setRun] = useState<{ started_at: string; ok: boolean | null; error: string | null; summary: Record<string, unknown> | null } | null>(null)
  const sync = useSync()
  const loadRun = () => _s.from('sync_runs').select('started_at, ok, error, summary').order('started_at', { ascending: false }).limit(1).then(({ data }) => setRun(data?.[0] ?? null))
  useEffect(() => { loadRun() }, [])
  const syncNow = () => startSync(loadRun)
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState({ pending: 0, doing: 0, incomplete: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('work_orders').select('status, type, description, property:properties(name)').not('status', 'in', '(已完成,已取消)'),
      supabase.from('properties').select('name, property_contracts(*)').eq('legacy', false),
      supabase.from('reviews').select('id, channel_name, rating, reviewed_at, property:properties(name, assistant_id)').not('rating', 'is', null).gte('reviewed_at', new Date(Date.now() - 14 * 86400_000).toISOString()).order('reviewed_at', { ascending: false }).limit(500),
      supabase.from('review_actions').select('review_id, status').limit(5000),
      supabase.from('claims').select('content, property:properties(name, assistant_id)').eq('status', '待提交').limit(50),
      profile?.role === 'assistant' ? supabase.from('shift_months').select('status').eq('user_id', profile.id).eq('month', `${openMonth()}-01`).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('order_alerts').select('kind, detail, property:properties(name, assistant_id)').eq('status', '待处理').limit(200),
      profile?.role === 'admin' ? supabase.from('shift_requests').select('month, reason, user:profiles!shift_requests_user_id_fkey(name)').eq('status', '待审批').limit(50) : Promise.resolve({ data: [] }),
          profile?.role === 'assistant' ? coveredAssistantIds(profile.id) : Promise.resolve(new Set<string>()),
    ]).then(([o, p, rv, ra, cl, sm, oa, sr, cov]) => {
      const mine = (aid: string | null | undefined) => profile?.role !== 'assistant' || (!!aid && cov.has(aid))
      const tagOf = (aid: string | null | undefined) => (profile?.role === 'assistant' && aid && aid !== profile.id ? '（代班）' : '')
      const t: Todo[] = []
      if (profile?.role === 'assistant' && (sm.data as { status?: string } | null)?.status !== '已提交') {
        const om = openMonth(), isNext = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).slice(0, 7) !== om
        t.push({ tag: '排班', text: isNext ? `${om} 的排班已开放（每月 ${OPEN_DAY} 号开放），请选好 4 天休息、4 天居家办公并提交` : `${om} 的排班还没提交，请选好 4 天休息、4 天居家办公并提交`, to: '/shifts', cls: 'amber', lv: 'blue' })
      }
      for (const r of (sr.data ?? []) as unknown as { month: string; reason: string | null; user: { name: string } | null }[]) t.push({ tag: '排班', text: `${r.user?.name ?? '助理'} 申请变更 ${r.month.slice(0, 7)} 的排班：${r.reason || '（没写原因）'}`, to: '/shifts', cls: 'blue', lv: 'yellow' })
      for (const a of (oa.data ?? []) as unknown as { kind: string; detail: string; property: { name: string; assistant_id: string | null } | null }[]) if (mine(a.property?.assistant_id)) t.push({ tag: '订单异常', text: `${tagOf(a.property?.assistant_id)}${a.property?.name} · ${a.kind}：${a.detail}`, to: '/alerts', cls: 'purple', lv: 'red' })
      let pending = 0, doing = 0
      for (const x of (o.data ?? []) as unknown as { status: string; type: string; description: string; property: { name: string } }[]) {
        const label = `${x.property?.name} · ${x.type} · ${x.description ?? ''}`
        if (x.status === '待派单') { pending++; t.push({ tag: '待派单', text: label, to: '/orders', cls: 'amber', lv: 'red' }) }
        else if (x.status === '待确认费用') { pending++; t.push({ tag: '确认费用', text: label, to: '/orders', cls: 'purple', lv: 'orange' }) }
        else if (x.status === '待通知房东') t.push({ tag: '通知房东', text: label, to: '/orders', cls: 'amber', lv: 'orange' })
        else if (x.status === '房东已完成') t.push({ tag: '确认', text: `${label}，房东说已完成，请确认`, to: '/orders', cls: 'purple', lv: 'yellow' })
        else doing++
      }
      let incomplete = 0
      for (const r of (p.data ?? []) as unknown as { name: string; property_contracts: never }[]) {
        const c = r.property_contracts as { end_date: string | null } | null
        if (statusOf(c as never) === '待登记合同') { incomplete++; t.push({ tag: '合同', text: `${r.name} 水电燃气信息还没填完整，填完才能上线`, to: '/properties', cls: 'amber', lv: 'yellow' }) }
        const d = daysTo(c?.end_date ?? null)
        if (d !== null && d >= 0 && d <= 60) t.push({ tag: '到期', text: `${r.name} 合同 ${d} 天后到期`, to: '/contracts', cls: 'amber', lv: d <= 7 ? 'red' : d <= 30 ? 'orange' : 'yellow' })
      }
      const done = new Set((ra.data ?? []).filter((a: { status: string }) => a.status !== '待处理').map((a: { review_id: number }) => a.review_id))
      for (const r of (rv.data ?? []) as unknown as { id: number; channel_name: string | null; rating: number; reviewed_at: string; property: { name: string; assistant_id: string | null } }[]) {
        if (!mine(r.property?.assistant_id)) continue
        if (badOne(r.channel_name, Number(r.rating)) && !done.has(r.id)) t.push({ tag: '差评', text: `${tagOf(r.property?.assistant_id)}${r.property?.name} · ${r.channel_name} ${r.channel_name === 'Airbnb' ? Number(r.rating) / 2 + ' 星' : r.rating + ' 分'} · ${r.reviewed_at.slice(0, 10)}`, to: '/reviews', cls: 'purple', lv: 'red' })
      }
      for (const c of (cl.data ?? []) as unknown as { content: string; property: { name: string; assistant_id: string | null } }[]) if (mine(c.property?.assistant_id)) t.push({ tag: '索赔', text: `${tagOf(c.property?.assistant_id)}${c.property?.name} · ${c.content}，还没提交平台`, to: '/claims', cls: 'amber', lv: 'orange' })
      const rank: Record<Lv, number> = { red: 0, orange: 1, yellow: 2, blue: 3 }
      t.sort((a, b) => rank[a.lv] - rank[b.lv])
      setTodos(t); setStats({ pending, doing, incomplete }); setLoading(false)
    })
  }, [])

  if (loading) return <p className="muted">加载中…</p>
  return (
    <div>
      <h1>总览</h1>
      <div className="stats">
        <div className="stat"><div className="n">{stats.pending}</div>待派单 / 待确认费用</div>
        <div className="stat"><div className="n">{stats.doing}</div>进行中的工单</div>
        <div className="stat"><div className="n">{stats.incomplete}</div>待登记完整的合同</div>
      </div>
      {profile?.role === 'admin' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="title-row"><h3 style={{ margin: 0 }}>Hostaway 每日数据同步</h3><button className="ghost" disabled={sync.running} onClick={syncNow}>{sync.running ? '同步中…' : '立即同步一次'}</button></div>
          <p className="muted small" style={{ margin: 0 }}>{run ? `上次：${new Date(run.started_at).toLocaleString('zh-CN')} · ${run.ok === null ? '进行中或中断' : run.ok ? '成功' : `失败：${run.error}`}` : '还没有同步记录。每天悉尼凌晨自动跑一次。'}</p>
          {sync.msg && <p className="small" style={{ margin: '8px 0 0' }}>{sync.msg}</p>}
        </div>
      )}
      <div className="title-row"><h2 style={{ margin: 0 }}>今天要处理的</h2>
        <span className="lv-legend">{LV.map((l) => <span key={l.k} className={`lv-dot ${l.k}`} title={l.hint}>{l.label} {todos.filter((t) => t.lv === l.k).length}</span>)}</span>
      </div>
      <div className="notes">
        {todos.map((t, i) => (
          <button key={i} className={`note ${t.lv}`} onClick={() => nav(t.to)}>
            <span className="note-tag">{t.tag}</span>
            <span className="note-text">{t.text}</span>
          </button>
        ))}
        {!todos.length && <p className="muted">暂时没有待办。</p>}
      </div>
    </div>
  )
}
