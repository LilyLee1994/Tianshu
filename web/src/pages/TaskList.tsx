import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export type Lv = 'red' | 'orange' | 'yellow' | 'blue'
export interface Task { priority: string; closed_at: string | null; id: number; due_at: string; title: string; status: string; assignee_id: string | null; created_by: string; assignee: { name: string } | null; creator: { name: string } | null }
export interface Person { id: string; name: string }
const STATUS = ['未开始', '进行中', '已完成']
const PRIO = ['高', '中', '低']
// 北京现在的时间，格式 2026-11-26T14:30，用来判断有没有过期（时间都按北京时间填）
const nowBJ = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T')
const show = (s: string) => s.slice(5, 16).replace('T', ' ')

// 便签颜色：优先级高=红，中=黄，低=蓝；过了时间还没完成的，中、低升一档到橙色
export function taskLevel(t: Task): Lv {
  const late = t.status !== '已完成' && t.due_at.slice(0, 16) < nowBJ()
  if (t.priority === '高') return 'red'
  if (late) return 'orange'
  return t.priority === '中' ? 'yellow' : 'blue'
}

export function useTasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      supabase.from('team_tasks').select('id, priority, closed_at, due_at, title, status, assignee_id, created_by, assignee:profiles!assignee_id(name), creator:profiles!created_by(name)').is('closed_at', null).order('due_at').limit(1000),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'assistant', 'ops', 'finance']).eq('active', true).order('name'),
    ])
    if (t.error) setErr(`待办读取出错：${t.error.message}（是否已运行 033、034、035 迁移？）`)
    // 已完成的只留给新建的人（等她点“关闭”）；被指派的人完成后就看不到了
    setTasks(((t.data ?? []) as never as Task[]).filter((x) => x.status !== '已完成' || x.created_by === profile?.id))
    setPeople((p.data ?? []) as Person[])
  }, [profile?.id])
  useEffect(() => { load() }, [load])
  return { tasks, people, err, setErr, load }
}

// 一张待办便签：能改状态；已完成的由新建的人点“关闭”；没完成的新建人可以删除
export function TaskNote({ t, onChanged, onErr }: { t: Task; onChanged: () => void; onErr: (m: string) => void }) {
  const { profile } = useAuth()
  const mine = t.created_by === profile?.id
  const late = t.status !== '已完成' && t.due_at.slice(0, 16) < nowBJ()
  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) onErr(error.message); else onChanged() }
  return (
    <div className={`note task ${taskLevel(t)}`} style={t.status === '已完成' ? { opacity: 0.65 } : undefined}>
      <span className="note-tag">待办 · 优先级{t.priority}{late && ' · 已过期'}</span>
      <span className="note-text" style={{ textDecoration: t.status === '已完成' ? 'line-through' : undefined }}>{t.title}</span>
      <span className="small" style={{ opacity: 0.8 }}>{show(t.due_at)}（北京）· {t.assignee?.name ?? '未指定'}{mine ? '' : ` · ${t.creator?.name ?? ''}指派`}</span>
      <span className="btn-row" style={{ margin: 0, gap: 6 }}>
        <select value={t.status} onChange={(e) => run(supabase.from('team_tasks').update({ status: e.target.value, done_at: e.target.value === '已完成' ? new Date().toISOString() : null }).eq('id', t.id))}>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {mine && t.status === '已完成' && <button onClick={() => run(supabase.from('team_tasks').update({ closed_at: new Date().toISOString() }).eq('id', t.id))}>关闭</button>}
        {mine && t.status !== '已完成' && <button className="ghost" onClick={() => window.confirm(`删除「${t.title}」？`) && run(supabase.from('team_tasks').delete().eq('id', t.id))}>删除</button>}
      </span>
    </div>
  )
}

// 新建待办：时间（北京时间）、事项、优先级、负责人
export function AddTask({ people, onAdded, onErr }: { people: Person[]; onAdded: () => void; onErr: (m: string) => void }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ due: '', title: '', assignee: '', priority: '中' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (profile && !f.assignee) setF((x) => ({ ...x, assignee: profile.id })) }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    if (!f.due || !f.title.trim()) { onErr('时间和事项都要填。'); return }
    setBusy(true)
    const { error } = await supabase.from('team_tasks').insert({ due_at: f.due, title: f.title.trim(), assignee_id: f.assignee || null, priority: f.priority })
    setBusy(false)
    if (error) { onErr(error.message); return }
    onErr(''); setF({ ...f, title: '' }); setOpen(false); onAdded()
  }
  if (!open) return <button onClick={() => setOpen(true)}>+ 新建待办</button>
  return (
    <div className="btn-row" style={{ margin: '0 0 12px', alignItems: 'center' }}>
      <input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} title="北京时间" />
      <input style={{ flex: 1, minWidth: 180 }} placeholder="要做什么" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIO.map((x) => <option key={x} value={x}>优先级：{x}</option>)}</select>
      <select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
        <option value="">不指定</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === profile?.id ? '（我）' : ''}</option>)}
      </select>
      <button disabled={busy} onClick={add}>添加</button>
      <button className="ghost" onClick={() => setOpen(false)}>取消</button>
    </div>
  )
}
