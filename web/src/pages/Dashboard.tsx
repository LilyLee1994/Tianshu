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
import { useTasks, TaskNote, AddTask, taskLevel } from './TaskList'

type Lv = 'red' | 'orange' | 'yellow' | 'blue'
interface Todo { tag: string; text: string; to: string; cls: string; lv: Lv }
const LV: { k: Lv; label: string; hint: string }[] = [
  { k: 'red', label: '紧急', hint: '差评、订单异常、待派单、合同 7 天内到期、优先级高的待办' },
  { k: 'orange', label: '尽快', hint: '索赔待提交、确认费用、通知房东、合同 30 天内到期、已过期的待办' },
  { k: 'yellow', label: '留意', hint: '确认完成、合同信息没填完、排班变更申请、合同 60 天内到期、优先级中的待办' },
  { k: 'blue', label: '日常', hint: '排班填写提醒、优先级低的待办' },
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
  const { tasks, people, err: taskErr, setErr: setTaskErr, load: loadTasks } = useTasks()
  const [stats, setStats] = useState({ pending: 0, doing: 0, incomplete: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('work_orders').select('status, type, description, property:properties(name)').not('status', 'in', '(已完成,已取消)'),
      supabase.from('properties').select('id, name, assistant_id, property_contracts(*)').eq('legacy', false),
      supabase.from('reviews').select('id, channel_name, rating, reviewed_at, property:properties(name, assistant_id)').not('rating', 'is', null).gte('reviewed_at', new Date(Date.now() - 14 * 86400_000).toISOString()).order('reviewed_at', { ascending: false }).limit(500),
      supabase.from('review_actions').select('review_id, status').limit(5000),
      supabase.from('claims').select('content, property:properties(name, assistant_id)').eq('status', '待提交').limit(50),
      profile?.role === 'assistant' ? supabase.from('shift_months').select('status').eq('user_id', profile.id).eq('month', `${openMonth()}-01`).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('order_alerts').select('kind, detail, property:properties(name, assistant_id)').eq('status', '待处理').limit(200),
      profile?.role === 'admin' ? supabase.from('shift_requests').select('month, reason, user:profiles!shift_requests_user_id_fkey(name)').eq('status', '待审批').limit(50) : Promise.resolve({ data: [] }),
          profile?.role === 'assistant' ? coveredAssistantIds(profile.id) : Promise.resolve(new Set<string>()),
      supabase.from('work_orders').select('id, damage_report, property:properties(name, assistant_id)').not('damage_report', 'is', null).eq('damage_handled', false).neq('status', '已取消'),
      supabase.from('onboarding_steps').select('property_id, seq, name, owner, status, property:properties(name, assistant_id)').order('seq').limit(3000),
    ]).then(async ([o, p, rv, ra, cl, sm, oa, sr, cov, dm, ob]) => {
      const mine = (aid: string | null | undefined) => profile?.role !== 'assistant' || (!!aid && cov.has(aid))
      const tagOf = (aid: string | null | undefined) => (profile?.role === 'assistant' && aid && aid !== profile.id ? '（代班）' : '')
      const t: Todo[] = []
      if (profile?.role === 'assistant' && (sm.data as { status?: string } | null)?.status !== '已提交') {
        const om = openMonth(), isNext = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).slice(0, 7) !== om
        t.push({ tag: '排班', text: isNext ? `${om} 的排班已开放（每月 ${OPEN_DAY} 号开放），请选好 4 天休息、4 天居家办公并提交` : `${om} 的排班还没提交，请选好 4 天休息、4 天居家办公并提交`, to: '/shifts', cls: 'amber', lv: 'blue' })
      }
      for (const r of (sr.data ?? []) as unknown as { month: string; reason: string | null; user: { name: string } | null }[]) t.push({ tag: '排班', text: `${r.user?.name ?? '助理'} 申请变更 ${r.month.slice(0, 7)} 的排班：${r.reason || '（没写原因）'}`, to: '/shifts', cls: 'blue', lv: 'yellow' })
      for (const a of (oa.data ?? []) as unknown as { kind: string; detail: string; property: { name: string; assistant_id: string | null } | null }[]) if (mine(a.property?.assistant_id)) t.push({ tag: '订单异常', text: `${tagOf(a.property?.assistant_id)}${a.property?.name} · ${a.kind}：${a.detail}`, to: '/alerts', cls: 'purple', lv: 'red' })
      // 清洁上报损坏：没点“已处理”之前一直提醒负责这套房的助理
      let dmRows = dm.data
      if (dm.error) { const r = await supabase.from('work_orders').select('id, damage_report, property:properties(name, assistant_id)').not('damage_report', 'is', null).neq('status', '已取消'); dmRows = r.data }  // 还没运行 048 时，不过滤“已处理”
      for (const x of (dmRows ?? []) as unknown as { id: number; damage_report: string; property: { name: string; assistant_id: string | null } | null }[]) {
        if (mine(x.property?.assistant_id ?? null)) t.push({ tag: '清洁上报损坏', text: `${tagOf(x.property?.assistant_id ?? null)}${x.property?.name} · ${x.damage_report}`, to: `/orders?id=${x.id}`, cls: 'amber', lv: 'red' })
      }
      // 新房源上线流程：
      // 1) 管理员：每套还没走完的房源一张便签，写明进度和下一步
      // 2) 每一步指定了对接人的，对接人自己的待办里有一张（状态跟着这一步走，完成后自动消失）
      type ObRow = { property_id: number; name: string; owner: string | null; status: string; property: { name: string; assistant_id: string | null } | null }
      const obRows = (ob.data ?? []) as unknown as ObRow[]
      const obBy = new Map<number, { name: string; aid: string | null; st: { name: string; status: string }[] }>()
      for (const x of obRows) {
        const e = obBy.get(x.property_id) ?? { name: x.property?.name ?? '', aid: x.property?.assistant_id ?? null, st: [] }
        e.st.push({ name: x.name, status: x.status }); obBy.set(x.property_id, e)
      }
      if (profile?.role === 'admin') {
        for (const e of obBy.values()) {
          const left = e.st.filter((s) => s.status !== '已完成')
          if (left.length) t.push({ tag: '上线流程', text: `${e.name} 上线进度 ${e.st.length - left.length}/${e.st.length}，下一步：${left[0].name}`, to: '/onboarding', cls: 'blue', lv: 'yellow' })
        }
      }
      const myName = (profile?.name ?? '').trim().toLowerCase()
      const stepNotes: { pid: number; isLaunch: boolean; todo: Todo }[] = []
      const launchMine = new Set<number>()   // 我是「上线」这一步的对接人的房源
      if (myName) {
        for (const x of obRows) {
          if (x.status === '已完成') continue
          const who = (x.owner ?? '').split(/[、,，/；;]+/).map((n) => n.trim().toLowerCase())
          if (!who.includes(myName)) continue
          if (x.name === '上线') launchMine.add(x.property_id)
          const hint = /guidebook/i.test(x.name) ? '，请填 Guidebook 链接' : /stra/i.test(x.name) ? '，请填 STRA 编号' : /房源档案|个体表/.test(x.name) ? '，请完善房源档案' : ''
          stepNotes.push({ pid: x.property_id, isLaunch: x.name === '上线', todo: { tag: `上线 · ${x.status}`, text: `${x.property?.name} · ${x.name}${hint}`, to: '/onboarding', cls: 'blue', lv: x.status === '进行中' ? 'yellow' : 'orange' } })
        }
      }
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
      const readySet = new Set<number>()   // 已经出了「可上线」便签的房源
      for (const r of (p.data ?? []) as unknown as { id: number; name: string; assistant_id: string | null; property_contracts: never }[]) {
        const c = r.property_contracts as { end_date: string | null } | null
        if (statusOf(c as never) === '待登记合同') { incomplete++; t.push({ tag: '合同', text: `${r.name} 水电燃气信息还没填完整，填完才能上线`, to: '/properties', cls: 'amber', lv: 'yellow' }) }
        // 资料填齐、运营阶段还是“筹备中”：可以上线了，提醒负责的助理去上线
        if (statusOf(c as never) === '可上线' && (mine(r.assistant_id) || launchMine.has(r.id))) { readySet.add(r.id); t.push({ tag: '可上线', text: `${tagOf(r.assistant_id)}${r.name} 资料已填齐，可以上线了；上线后把运营阶段改为“运营中”`, to: `/properties?id=${r.id}`, cls: 'blue', lv: 'orange' }) }
        const d = daysTo(c?.end_date ?? null)
        if (d !== null && d >= 0 && d <= 60) t.push({ tag: '到期', text: `${r.name} 合同 ${d} 天后到期`, to: '/contracts', cls: 'amber', lv: d <= 7 ? 'red' : d <= 30 ? 'orange' : 'yellow' })
      }
      // 「可上线」便签和「上线」步骤便签是同一件事，合并成一张：有「可上线」就不再出「上线」那张
      for (const n of stepNotes) if (!(n.isLaunch && readySet.has(n.pid))) t.push(n.todo)
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
      <div className="title-row"><h2 style={{ margin: 0 }}>待处理</h2>
        <span className="lv-legend">{LV.map((l) => <span key={l.k} className={`lv-dot ${l.k}`} title={l.hint}>{l.label} {todos.filter((t) => t.lv === l.k).length + tasks.filter((t) => taskLevel(t) === l.k).length}</span>)}</span>
      </div>
      <div style={{ margin: '10px 0 0' }}><AddTask people={people} onAdded={loadTasks} onErr={setTaskErr} /></div>
      {taskErr && <p className="error">{taskErr}</p>}
      <div className="notes">
        {[...LV.map((l) => l.k)].flatMap((k) => [
          ...todos.filter((t) => t.lv === k).map((t, i) => (
            <button key={`s${k}${i}`} className={`note ${t.lv}`} onClick={() => nav(t.to)}>
              <span className="note-tag">{t.tag}</span>
              <span className="note-text">{t.text}</span>
            </button>
          )),
          ...tasks.filter((t) => taskLevel(t) === k).sort((a, b) => a.due_at.localeCompare(b.due_at)).map((t) => <TaskNote key={`t${t.id}`} t={t} onChanged={loadTasks} onErr={setTaskErr} />),
        ])}
        {profile?.role === 'admin' && Number(run?.summary?.counts && (run.summary as { counts?: Record<string, unknown> }).counts?.unmatchedCount) > 0 && (
          <button className="note orange" onClick={() => nav('/properties')}>
            <span className="note-tag">Hostaway 房源没对上</span>
            <span className="note-text">Hostaway 里有 {String((run!.summary as { counts: Record<string, unknown> }).counts.unmatchedCount)} 套房在系统里找不到：{((run!.summary as { counts: { unmatchedListings?: string[] } }).counts.unmatchedListings ?? []).slice(0, 6).join('、')}。请在房源档案填 Hostaway 房源 ID，或点“从 Hostaway 同步”新建。</span>
          </button>
        )}
        {!todos.length && !tasks.length && <p className="muted">暂时没有要处理的。</p>}
      </div>
    </div>
  )
}
