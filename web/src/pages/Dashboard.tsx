import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabase as _s } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { startSync, useSync } from '../lib/syncStore'
import { statusOf } from './Properties'
import { daysTo } from './Contracts'
import { badOne } from './Reviews'

interface Todo { tag: string; text: string; to: string; cls: string }

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
      supabase.from('reviews').select('id, channel_name, rating, reviewed_at, property:properties(name)').not('rating', 'is', null).gte('reviewed_at', new Date(Date.now() - 14 * 86400_000).toISOString()).order('reviewed_at', { ascending: false }).limit(500),
      supabase.from('review_actions').select('review_id, status').limit(5000),
      supabase.from('claims').select('content, property:properties(name)').eq('status', '待提交').limit(50),
    ]).then(([o, p, rv, ra, cl]) => {
      const t: Todo[] = []
      let pending = 0, doing = 0
      for (const x of (o.data ?? []) as unknown as { status: string; type: string; description: string; property: { name: string } }[]) {
        const label = `${x.property?.name} · ${x.type} · ${x.description ?? ''}`
        if (x.status === '待派单') { pending++; t.push({ tag: '待派单', text: label, to: '/orders', cls: 'amber' }) }
        else if (x.status === '待确认费用') { pending++; t.push({ tag: '确认费用', text: label, to: '/orders', cls: 'purple' }) }
        else if (x.status === '待通知房东') t.push({ tag: '通知房东', text: label, to: '/orders', cls: 'amber' })
        else if (x.status === '房东已完成') t.push({ tag: '确认', text: `${label}，房东说已完成，请确认`, to: '/orders', cls: 'purple' })
        else doing++
      }
      let incomplete = 0
      for (const r of (p.data ?? []) as unknown as { name: string; property_contracts: never }[]) {
        const c = r.property_contracts as { end_date: string | null } | null
        if (statusOf(c as never) === '待登记合同') { incomplete++; t.push({ tag: '合同', text: `${r.name} 水电燃气信息还没填完整，填完才能上线`, to: '/properties', cls: 'amber' }) }
        const d = daysTo(c?.end_date ?? null)
        if (d !== null && d >= 0 && d <= 60) t.push({ tag: '到期', text: `${r.name} 合同 ${d} 天后到期`, to: '/contracts', cls: 'amber' })
      }
      const done = new Set((ra.data ?? []).filter((a: { status: string }) => a.status !== '待处理').map((a: { review_id: number }) => a.review_id))
      for (const r of (rv.data ?? []) as unknown as { id: number; channel_name: string | null; rating: number; reviewed_at: string; property: { name: string } }[]) {
        if (badOne(r.channel_name, Number(r.rating)) && !done.has(r.id)) t.push({ tag: '差评', text: `${r.property?.name} · ${r.channel_name} ${r.channel_name === 'Airbnb' ? Number(r.rating) / 2 + ' 星' : r.rating + ' 分'} · ${r.reviewed_at.slice(0, 10)}`, to: '/reviews', cls: 'purple' })
      }
      for (const c of (cl.data ?? []) as unknown as { content: string; property: { name: string } }[]) t.push({ tag: '索赔', text: `${c.property?.name} · ${c.content}，还没提交平台`, to: '/claims', cls: 'amber' })
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
      <h2>今天要处理的</h2>
      <div className="todos">
        {todos.map((t, i) => <button key={i} className="todo" onClick={() => nav(t.to)}><span className={`chip ${t.cls}`}>{t.tag}</span>{t.text}</button>)}
        {!todos.length && <p className="muted">暂时没有待办。</p>}
      </div>
    </div>
  )
}
