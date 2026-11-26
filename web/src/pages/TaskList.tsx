import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface Task { priority: string; closed_at: string | null; id: number; due_at: string; title: string; status: string; assignee_id: string | null; created_by: string; assignee: { name: string } | null; creator: { name: string } | null }
interface Person { id: string; name: string }
const STATUS = ['未开始', '进行中', '已完成']
const PRIO = ['高', '中', '低']
const PRIO_STYLE: Record<string, { background: string; color: string }> = { 高: { background: '#fde3e1', color: '#a3271c' }, 中: { background: '#fff6c9', color: '#7a6400' }, 低: { background: '#e1effb', color: '#14507a' } }
// 北京现在的时间，格式 2026-11-26T14:30，用来判断有没有过期（时间都按北京时间填）
const nowBJ = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T')
const show = (s: string) => s.slice(5, 16).replace('T', ' ')

// 总览页的待办清单：时间、事项、状态，可以指给某个人
export default function TaskList() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Task[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [view, setView] = useState<'mine' | 'all' | 'done'>('mine')
  const [f, setF] = useState({ due: '', title: '', assignee: '', priority: '中' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      supabase.from('team_tasks').select('id, priority, closed_at, due_at, title, status, assignee_id, created_by, assignee:profiles!assignee_id(name), creator:profiles!created_by(name)').order('due_at').limit(1000),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'assistant', 'ops', 'finance']).eq('active', true).order('name'),
    ])
    if (t.error) setErr(`读取出错：${t.error.message}（是否已运行 033 迁移？）`)
    setRows((t.data ?? []) as never); setPeople((p.data ?? []) as Person[])
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (profile && !f.assignee) setF((x) => ({ ...x, assignee: profile.id })) }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!f.due || !f.title.trim()) { setErr('时间和事项都要填。'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('team_tasks').insert({ due_at: f.due, title: f.title.trim(), assignee_id: f.assignee || null, priority: f.priority })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setF({ ...f, title: '' }); load()
  }
  const setStatus = async (t: Task, status: string) => {
    const { error } = await supabase.from('team_tasks').update({ status, done_at: status === '已完成' ? new Date().toISOString() : null }).eq('id', t.id)
    if (error) setErr(error.message); else load()
  }
  const close = async (t: Task) => {
    const { error } = await supabase.from('team_tasks').update({ closed_at: new Date().toISOString() }).eq('id', t.id)
    if (error) setErr(error.message); else load()
  }
  const del = async (t: Task) => {
    if (!window.confirm(`删除「${t.title}」？`)) return
    const { error } = await supabase.from('team_tasks').delete().eq('id', t.id)
    if (error) setErr(error.message); else load()
  }

  const now = nowBJ()
  const open = useMemo(() => rows.filter((r) => !r.closed_at), [rows])
  const shown = useMemo(() => open.filter((r) => view === 'done' ? r.status === '已完成' : r.status !== '已完成' && (view === 'all' || r.assignee_id === profile?.id))
    .sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority) || a.due_at.localeCompare(b.due_at)),
    [open, view, profile?.id])
  const nMine = open.filter((r) => r.status !== '已完成' && r.assignee_id === profile?.id).length
  const nAll = open.filter((r) => r.status !== '已完成').length

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="title-row">
        <h2 style={{ margin: 0 }}>待办清单</h2>
        <span className="btn-row" style={{ margin: 0 }}>
          <button className={view === 'mine' ? 'pill on' : 'pill'} onClick={() => setView('mine')}>我的 {nMine}</button>
          <button className={view === 'all' ? 'pill on' : 'pill'} onClick={() => setView('all')}>全部未完成 {nAll}</button>
          <button className={view === 'done' ? 'pill on' : 'pill'} onClick={() => setView('done')}>已完成</button>
        </span>
      </div>
      <div className="btn-row" style={{ margin: '12px 0', alignItems: 'center' }}>
        <input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} title="北京时间" />
        <input style={{ flex: 1, minWidth: 180 }} placeholder="要做什么" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} title="优先级">{PRIO.map((x) => <option key={x} value={x}>优先级：{x}</option>)}</select>
        <select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
          <option value="">不指定</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === profile?.id ? '（我）' : ''}</option>)}
        </select>
        <button disabled={busy} onClick={add}>添加</button>
      </div>
      <p className="muted small" style={{ margin: '0 0 8px' }}>时间按北京时间填。未完成的按优先级（高、中、低）再按时间排。每条只有新建的人和被指派的人能看到，两个人都可以改状态；完成后由新建的人点“关闭”，这一条就从两边消失。</p>
      {err && <p className="error">{err}</p>}
      <div className="table-wrap" style={{ border: 0 }}>
        <table className="tight" style={{ width: '100%' }}>
          <thead><tr><th>优先级</th><th>时间（北京）</th><th>事项</th><th>负责人</th><th>状态</th><th></th></tr></thead>
          <tbody>{shown.map((t) => {
            const late = t.status !== '已完成' && t.due_at.slice(0, 16) < now
            const can = true
            const mineCreated = t.created_by === profile?.id
            return (
              <tr key={t.id}>
                <td><span className="chip" style={{ marginLeft: 0, ...PRIO_STYLE[t.priority] }}>{t.priority}</span></td>
                <td style={{ whiteSpace: 'nowrap', color: late ? '#b3261e' : undefined, fontWeight: late ? 600 : undefined }}>{show(t.due_at)}{late && <span className="small"> 已过期</span>}</td>
                <td style={{ textDecoration: t.status === '已完成' ? 'line-through' : undefined, opacity: t.status === '已完成' ? 0.6 : 1 }}>{t.title}<span className="muted small"> · {mineCreated ? '我新建的' : `${t.creator?.name ?? ''}指派给你`}</span></td>
                <td>{t.assignee?.name ?? <span className="muted">未指定</span>}</td>
                <td>{can ? <select value={t.status} onChange={(e) => setStatus(t, e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select> : <span className="chip gray" style={{ marginLeft: 0 }}>{t.status}</span>}</td>
                <td className="btn-row" style={{ margin: 0 }}>{mineCreated && t.status === '已完成' && <button onClick={() => close(t)}>关闭</button>}{mineCreated && t.status !== '已完成' && <button className="ghost" onClick={() => del(t)}>删除</button>}</td>
              </tr>
            )
          })}</tbody>
        </table>
        {!shown.length && <p className="muted pad">{view === 'done' ? '还没有完成的。' : view === 'mine' ? '你名下没有未完成的待办。' : '没有未完成的待办。'}</p>}
      </div>
    </section>
  )
}
