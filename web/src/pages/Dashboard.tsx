import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabase as _s } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { callApi } from '../lib/api'
import { statusOf } from './Properties'
import { daysTo } from './Contracts'

interface Todo { tag: string; text: string; to: string; cls: string }

export default function Dashboard() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const [run, setRun] = useState<{ started_at: string; ok: boolean | null; error: string | null; summary: Record<string, unknown> | null } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const loadRun = () => _s.from('sync_runs').select('started_at, ok, error, summary').order('started_at', { ascending: false }).limit(1).then(({ data }) => setRun(data?.[0] ?? null))
  useEffect(() => { loadRun() }, [])
  const syncNow = async () => {
    setSyncing(true)
    let fails = 0
    for (let i = 0; i < 40; i++) {
      setSyncMsg(`正在同步…（第 ${i + 1} 轮，每轮最长约 1 分钟，请不要关页面）`)
      const [r, e] = await callApi<{ done: boolean; phase?: string; calOffset?: number; resOffset?: number; revOffset?: number; total?: number; summary?: Record<string, unknown> }>('cron-hostaway', {})
      if (e || !r) {
        // 超时之类的临时错误：进度已经存了，自动接着再来，连续失败 4 次才放弃
        if (++fails >= 4) { setSyncMsg(`同步失败：${e}。可以稍后再点一次，会接着上次的进度做。`); break }
        setSyncMsg(`这一轮出错（${e}），自动重试第 ${fails} 次…`); continue
      }
      fails = 0
      if (r.done) { setSyncMsg(`同步完成：${JSON.stringify(r.summary)}`); break }
      const names: Record<string, string> = { reservations: `订单（已拉 ${r.resOffset} 条）`, cleaning: '自动派清洁', reviews: `评价（已拉 ${r.revOffset} 条）`, calendar: `日历价格 ${r.calOffset}/${r.total}` }
      setSyncMsg(`正在同步：${names[r.phase ?? ''] ?? r.phase}…`)
    }
    setSyncing(false)
    loadRun()
  }
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState({ pending: 0, doing: 0, incomplete: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('work_orders').select('status, type, description, property:properties(name)').not('status', 'in', '(已完成,已取消)'),
      supabase.from('properties').select('name, property_contracts(*)').eq('legacy', false),
    ]).then(([o, p]) => {
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
          <div className="title-row"><h3 style={{ margin: 0 }}>Hostaway 每日数据同步</h3><button className="ghost" disabled={syncing} onClick={syncNow}>{syncing ? '同步中…' : '立即同步一次'}</button></div>
          <p className="muted small" style={{ margin: 0 }}>{run ? `上次：${new Date(run.started_at).toLocaleString('zh-CN')} · ${run.ok === null ? '进行中或中断' : run.ok ? '成功' : `失败：${run.error}`}` : '还没有同步记录。每天悉尼凌晨自动跑一次。'}</p>
          {syncMsg && <p className="small" style={{ margin: '8px 0 0' }}>{syncMsg}</p>}
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
