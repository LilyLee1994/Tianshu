import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

const STATUSES = ['未完成', '进行中', '已完成']
interface Step { id: number; property_id: number; seq: number; name: string; owner: string | null; status: string; note: string | null; done_at: string | null }
interface Prop { id: number; name: string; assistant_id: string | null; assistant: { name: string } | null }
const stColor = (s: string) => (s === '已完成' ? '#1f6b34' : s === '进行中' ? '#14507a' : '#9a5a00')

export default function Onboarding() {
  const { profile } = useAuth()
  const [steps, setSteps] = useState<Step[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [show, setShow] = useState<'doing' | 'done'>('doing')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [stra, setStra] = useState<Record<number, string>>({})
  const [missing, setMissing] = useState<Record<number, string[]>>({})
  const nav = useNavigate()

  const load = useCallback(async () => {
    const [s, p, d] = await Promise.all([
      supabase.from('onboarding_steps').select('*').order('property_id').order('seq').limit(5000),
      supabase.from('properties').select('id, name, assistant_id, assistant:profiles!assistant_id(name)').order('name').limit(2000),
      supabase.from('property_details').select('property_id, stra_number').not('stra_number', 'is', null).limit(3000),
    ])
    if (s.error) setErr(`读取出错：${s.error.message}（是否已运行 039 迁移？）`); else setErr('')
    setStra(Object.fromEntries(((d.data ?? []) as { property_id: number; stra_number: string }[]).map((x) => [x.property_id, x.stra_number]))); setSteps((s.data ?? []) as Step[]); setProps((p.data ?? []) as never as Prop[])
    // 房源档案还缺什么（个体表 = 房源详情，Bill = 水电燃气网络和合同到期日）
    const ids = [...new Set(((s.data ?? []) as Step[]).map((x) => x.property_id))]
    if (ids.length) {
      const [dd, cc] = await Promise.all([
        supabase.from('property_details').select('*').in('property_id', ids),
        supabase.from('property_contracts').select('*').in('property_id', ids),
      ])
      const dm = new Map((dd.data ?? []).map((x: Record<string, unknown>) => [x.property_id as number, x]))
      const cm = new Map((cc.data ?? []).map((x: Record<string, unknown>) => [x.property_id as number, x]))
      const out: Record<number, string[]> = {}
      for (const id of ids) {
        const d = dm.get(id) ?? {}, c = cm.get(id) ?? {}, m: string[] = []
        const miss = (v: unknown) => v === null || v === undefined || v === ''
        if (miss(d.bedrooms)) m.push('卧室数'); if (miss(d.bathrooms)) m.push('卫生间数'); if (miss(d.max_guests)) m.push('可住人数'); if (miss(d.beds)) m.push('床')
        if (miss(d.lock_code)) m.push('锁盒密码'); if (miss(d.wifi_name)) m.push('WiFi 名'); if (miss(d.wifi_password)) m.push('WiFi 密码')
        for (const [k, l] of [['water', '水'], ['power', '电'], ['gas', '燃气'], ['internet', '网络']] as const) if (miss(c[k]) || c[k] === '未填') m.push(`${l}谁交费`)
        if (miss(c.end_date)) m.push('合同到期日')
        out[id] = m
      }
      setMissing(out)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const byProp = useMemo(() => {
    const m = new Map<number, Step[]>()
    for (const x of steps) m.set(x.property_id, [...(m.get(x.property_id) ?? []), x])
    return m
  }, [steps])
  const flows = useMemo(() => [...byProp.entries()].map(([pid, st]) => ({ prop: props.find((x) => x.id === pid), steps: st, done: st.filter((x) => x.status === '已完成').length }))
    .filter((f) => f.prop && (show === 'done' ? f.done === f.steps.length : f.done < f.steps.length))
    .sort((a, b) => a.prop!.name.localeCompare(b.prop!.name)), [byProp, props, show])
  const free = props.filter((p) => !byProp.has(p.id))

  const patch = async (id: number, v: Partial<Step>) => {
    const body: Record<string, unknown> = { ...v }
    if (v.status) body.done_at = v.status === '已完成' ? new Date().toISOString() : null
    setSteps((x) => x.map((s) => s.id === id ? { ...s, ...v, ...(v.status ? { done_at: v.status === '已完成' ? new Date().toISOString() : null } : {}) } : s))
    const { error } = await supabase.from('onboarding_steps').update(body).eq('id', id)
    if (error) { setErr(error.message); load() }
  }
  // 「完善房源档案」这一步：档案填齐了自动标完成，没填齐不能手动标完成
  const isProfile = (s: Step) => /房源档案|个体表/.test(s.name)
  useEffect(() => {
    for (const s of steps) if (isProfile(s) && s.status !== '已完成' && missing[s.property_id] && missing[s.property_id].length === 0) patch(s.id, { status: '已完成' })
  }, [steps, missing]) // eslint-disable-line react-hooks/exhaustive-deps
  // 注册 STRA 这一步：填了编号就同步到房源档案，并自动标为已完成；没编号不能标完成
  const isStra = (s: Step) => /stra/i.test(s.name)
  const saveStra = async (s: Step, v: string) => {
    const val = v.trim()
    if (val === (stra[s.property_id] ?? '')) return
    const { error } = await supabase.rpc('set_stra_number', { p_property: s.property_id, p_stra: val })
    if (error) { setErr(error.code === '42703' || error.code === '42883' || error.code === 'PGRST202' ? '保存失败：还没运行 040 迁移。' : `STRA 保存失败：${error.message}`); return }
    setErr(''); setStra((x) => ({ ...x, [s.property_id]: val }))
    if (val && s.status !== '已完成') patch(s.id, { status: '已完成' })
  }
  const changeStatus = (s: Step, status: string) => {
    if (isStra(s) && status === '已完成' && !stra[s.property_id]) { setErr('完成「注册 STRA」要先填 STRA 编号。'); return }
    if (isProfile(s) && status === '已完成' && (missing[s.property_id]?.length ?? 1) > 0) { setErr(`房源档案还没填齐：${(missing[s.property_id] ?? []).join('、')}。`); return }
    setErr(''); patch(s.id, { status })
  }
  const start = async (pid: number) => {
    const { data: tpl, error } = await supabase.from('onboarding_template').select('seq, name, owner').order('seq')
    if (error || !tpl?.length) { setErr(error?.message ?? '上线步骤模板是空的。'); return }
    const { error: e2 } = await supabase.from('onboarding_steps').insert(tpl.map((t) => ({ property_id: pid, seq: t.seq, name: t.name, owner: t.owner })))
    if (e2) { setErr(e2.message); return }
    setAdding(false); setShow('doing'); setOpen(pid); load()
  }
  const addStep = async (pid: number) => {
    const name = window.prompt('新增一个步骤，写步骤名称：')?.trim()
    if (!name) return
    const seq = Math.max(0, ...(byProp.get(pid) ?? []).map((x) => x.seq)) + 1
    const { error } = await supabase.from('onboarding_steps').insert({ property_id: pid, seq, name })
    if (error) setErr(error.message); else load()
  }
  const delStep = async (s: Step) => {
    if (!window.confirm(`删除步骤「${s.name}」？`)) return
    const { error } = await supabase.from('onboarding_steps').delete().eq('id', s.id)
    if (error) setErr(error.message); else load()
  }
  const cancel = async (pid: number, name: string) => {
    if (!window.confirm(`取消「${name}」的上线流程？这套房的所有步骤记录都会删掉。`)) return
    const { error } = await supabase.from('onboarding_steps').delete().eq('property_id', pid)
    if (error) setErr(error.message); else { setOpen(null); load() }
  }

  return (
    <div>
      <div className="title-row"><h1>新房源上线</h1><button onClick={() => setAdding(true)}>+ 开始上线新房源</button></div>
      <p className="muted small">新房源先在“房源档案”里新增，再在这里点“开始上线新房源”，系统会按标准流程生成每一步，逐项跟进到上线。</p>
      <div className="pills">
        <button className={`pill ${show === 'doing' ? 'on' : ''}`} onClick={() => setShow('doing')}>进行中</button>
        <button className={`pill ${show === 'done' ? 'on' : ''}`} onClick={() => setShow('done')}>已全部完成</button>
      </div>
      {err && <p className="err">{err}</p>}
      {!flows.length && <p className="muted">{show === 'doing' ? '现在没有正在上线的房源。' : '还没有走完全部流程的房源。'}</p>}
      <div className="ob-list">
        {flows.map(({ prop, steps: st, done }) => {
          const isOpen = open === prop!.id
          const next = st.find((x) => x.status !== '已完成')
          const canEdit = profile?.role !== 'repairman' && profile?.role !== 'cleaner'
          return (
            <div key={prop!.id} className="ob-card">
              <button className="ob-head" onClick={() => setOpen(isOpen ? null : prop!.id)}>
                <span className="ob-name">{prop!.name}</span>
                <span className="muted small">{prop!.assistant?.name ?? '未分配助理'}</span>
                <span className="ob-bar"><i style={{ width: `${(done / st.length) * 100}%` }} /></span>
                <span className="small">{done}/{st.length}</span>
                <span className="muted small ob-next">{next ? `下一步：${next.name}` : '全部完成'}</span>
              </button>
              {isOpen && (
                <div className="ob-body">
                  <table className="ob-tbl">
                    <colgroup><col style={{ width: 40 }} /><col style={{ width: 200 }} /><col style={{ width: 190 }} /><col style={{ width: 130 }} /><col /><col style={{ width: 76 }} /></colgroup>
                    <thead><tr><th>#</th><th>步骤</th><th>对接人 / 跟进人</th><th>进度</th><th>备注</th><th></th></tr></thead>
                    <tbody>{st.map((s) => (
                      <tr key={s.id}>
                        <td>{s.seq}</td><td>{s.name}</td>
                        <td><input defaultValue={s.owner ?? ''} disabled={!canEdit} onBlur={(e) => e.target.value !== (s.owner ?? '') && patch(s.id, { owner: e.target.value.trim() || null })} /></td>
                        <td><select value={s.status} disabled={!canEdit} style={{ color: stColor(s.status), fontWeight: 600 }} onChange={(e) => changeStatus(s, e.target.value)}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
                          {s.done_at && <div className="muted small">{s.done_at.slice(5, 10)}</div>}</td>
                        <td>
                          {isStra(s) && <input key={`stra${stra[s.property_id] ?? ''}`} style={{ marginBottom: 6, fontWeight: 600 }} defaultValue={stra[s.property_id] ?? ''} disabled={!canEdit} placeholder="填 STRA 编号（会同步到房源档案）" onBlur={(e) => saveStra(s, e.target.value)} />}
                          {isProfile(s) && (
                            <div className="small" style={{ marginBottom: 6 }}>
                              {missing[s.property_id]?.length ? <span style={{ color: '#9a5a00' }}>还缺：{missing[s.property_id].join('、')}</span> : <span style={{ color: '#1f6b34' }}>档案已填齐</span>}
                              {' '}<button className="task-btn" onClick={() => nav(`/properties?id=${s.property_id}`)}>去房源档案填写</button>
                            </div>
                          )}
                          <input defaultValue={s.note ?? ''} disabled={!canEdit} placeholder="备注" onBlur={(e) => e.target.value !== (s.note ?? '') && patch(s.id, { note: e.target.value.trim() || null })} /></td>
                        <td><button className="task-btn" onClick={() => delStep(s)}>删除</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="ghost" onClick={() => addStep(prop!.id)}>+ 加一步</button>
                    {profile?.role === 'admin' && <button className="ghost" onClick={() => cancel(prop!.id, prop!.name)}>取消这套房的上线流程</button>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {adding && <StartModal props={free} onClose={() => setAdding(false)} onStart={start} />}
    </div>
  )
}

function StartModal({ props, onClose, onStart }: { props: Prop[]; onClose: () => void; onStart: (id: number) => void }) {
  const [q, setQ] = useState('')
  const list = props.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>开始上线新房源</h2>
        <p className="muted small" style={{ margin: 0 }}>选一套房源，系统会按标准流程（签合同 → 注册 STRA → 软装 → … → 上线 → 仓储）生成 10 个步骤。房源要先在“房源档案”里新增。</p>
        <input autoFocus placeholder="搜索房源名称" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="side-list" style={{ width: 'auto', position: 'static', maxHeight: 300 }}>
          {list.map((p) => <button key={p.id} className="item" onClick={() => onStart(p.id)}>{p.name}<span className="muted small">{p.assistant?.name ?? ''}</span></button>)}
          {!list.length && <p className="muted small">没有找到，或者这套房已经在上线流程里了。</p>}
        </div>
        <div className="btn-row"><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
