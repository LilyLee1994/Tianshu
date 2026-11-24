import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { callApi } from '../lib/api'

type Kind = '休息' | '居家'
interface Member { id: string; name: string; partner_id: string | null; backup_id: string | null }
interface Req { id: number; user_id: string; month: string; reason: string | null; status: string }

const pad = (n: number) => String(n).padStart(2, '0')
const monthOf = (offset: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const daysIn = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate() }
const firstDow = (m: string) => { const [y, mo] = m.split('-').map(Number); return (new Date(y, mo - 1, 1).getDay() + 6) % 7 } // 周一 = 0
const dayStr = (m: string, d: number) => `${m}-${pad(d)}`
const NEXT: Record<string, Kind | undefined> = { '': '休息', 休息: '居家', 居家: undefined }

type Plan = Record<number, Kind> // 日 → 类型

export default function Shifts() {
  const { profile } = useAuth()
  const isAssistant = profile?.role === 'assistant'
  const isAdmin = profile?.role === 'admin'
  const [month, setMonth] = useState(monthOf(1))
  const [team, setTeam] = useState<Member[]>([])
  const [plans, setPlans] = useState<Record<string, Plan>>({})        // 已保存的：用户 → 日 → 类型
  const [status, setStatus] = useState<Record<string, string>>({})     // 用户 → 草稿/已提交
  const [reqs, setReqs] = useState<Req[]>([])
  const [mine, setMine] = useState<Plan>({})                            // 我正在编辑的
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const from = `${month}-01`, last = dayStr(month, daysIn(month))
    const [p, s, m, r] = await Promise.all([
      supabase.from('profiles').select('id, name, partner_id, backup_id').eq('role', 'assistant').eq('active', true).order('name'),
      supabase.from('shifts').select('user_id, date, kind').gte('date', from).lte('date', last).limit(5000),
      supabase.from('shift_months').select('user_id, status').eq('month', from),
      supabase.from('shift_requests').select('*').eq('month', from).eq('status', '待审批'),
    ])
    setTeam((p.data ?? []) as Member[])
    const pl: Record<string, Plan> = {}
    for (const x of s.data ?? []) (pl[x.user_id] ??= {})[Number(String(x.date).slice(8, 10))] = x.kind as Kind
    setPlans(pl)
    setStatus(Object.fromEntries((m.data ?? []).map((x) => [x.user_id, x.status])))
    setReqs((r.data ?? []) as Req[])
    setMine(pl[profile?.id ?? ''] ?? {})
  }, [month, profile?.id])
  useEffect(() => { load() }, [load])

  const name = (id: string | null) => team.find((t) => t.id === id)?.name ?? '—'
  const me = team.find((t) => t.id === profile?.id)
  const locked = status[profile?.id ?? ''] === '已提交'
  const nRest = Object.values(mine).filter((k) => k === '休息').length
  const nHome = Object.values(mine).filter((k) => k === '居家').length

  // 当天谁负责：本人上班（含居家）就是本人；休息则搭档，搭档也休息则备选，都没有转管理员
  const coverOf = (m: Member, day: number, src: Record<string, Plan>): { who: string | null; note: string } => {
    const rest = (id: string | null) => !!id && src[id]?.[day] === '休息'
    if (!rest(m.id)) return { who: m.id, note: '' }
    if (m.partner_id && !rest(m.partner_id)) return { who: m.partner_id, note: '' }
    if (m.backup_id && !rest(m.backup_id)) return { who: m.backup_id, note: '搭档同天休息，转备选' }
    return { who: null, note: m.partner_id ? '搭档同天休息，备选也没人，转管理员' : '没有设置搭档，转管理员' }
  }

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg('')
    const [, e] = await callApi('shifts', body)
    setBusy(false)
    if (e) { setMsg(e); return false }
    setMsg(ok); await load(); return true
  }

  const submit = async () => {
    if ((nRest !== 4 || nHome !== 4) && !window.confirm(`你现在是休息 ${nRest} 天、居家办公 ${nHome} 天，标准是各 4 天。确定提交吗？提交后会锁定。`)) return
    const rest = Object.entries(mine).filter(([, k]) => k === '休息').map(([d]) => dayStr(month, Number(d)))
    const home = Object.entries(mine).filter(([, k]) => k === '居家').map(([d]) => dayStr(month, Number(d)))
    await act({ action: 'submit', month, rest, home }, '已提交并锁定。')
  }

  // 其他人这天的安排（我自己的不算），用来选日子时避开别人
  const othersOn = (d: number, k: Kind) => team.filter((t) => t.id !== profile?.id && plans[t.id]?.[d] === k).map((t) => t.name).join('、')
  const cells = useMemo(() => [...Array(firstDow(month)).fill(0), ...Array.from({ length: daysIn(month) }, (_, i) => i + 1)], [month])
  const myCover = me ? Object.keys(mine).map(Number).filter((d) => mine[d] === '休息').sort((a, b) => a - b).map((d) => ({ d, ...coverOf(me, d, { ...plans, [me.id]: mine }) })) : []
  const myReq = reqs.find((r) => r.user_id === profile?.id)
  const days = Array.from({ length: daysIn(month) }, (_, i) => i + 1)

  return (
    <div>
      <div className="title-row">
        <h1>排班</h1>
        <span className="btn-row" style={{ margin: 0 }}>
          <button className={month === monthOf(0) ? 'pill on' : 'pill'} onClick={() => setMonth(monthOf(0))}>本月</button>
          <button className={month === monthOf(1) ? 'pill on' : 'pill'} onClick={() => setMonth(monthOf(1))}>下月</button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </span>
      </div>
      <p className="muted small">每人每月休息 4 天、居家办公 4 天，月底自己填下个月的，提交后锁定，要改须管理员批准。搭档和备选自己选，随时可以改（管理员也能改）。居家办公日仍算在岗，不转给搭档；休息日的房源转给搭档。</p>
      {msg && <p className="muted">{msg}</p>}

      {isAssistant && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="title-row">
            <h3 style={{ margin: 0 }}>我的排班（{month}）</h3>
            <span className={locked ? 'chip blue' : 'chip amber'}>{locked ? '已提交，已锁定' : '还没提交'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 720, margin: '12px 0' }}>
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => <div key={w} className="muted small" style={{ textAlign: 'center' }}>{w}</div>)}
            {cells.map((d, i) => d === 0 ? <div key={i} /> : (
              <button key={i} className="ghost" disabled={locked}
                onClick={() => setMine((p) => { const n = { ...p }; const nx = NEXT[p[d] ?? '']; if (nx) n[d] = nx; else delete n[d]; return n })}
                style={{ minHeight: 52, padding: 4, background: mine[d] === '休息' ? '#fde8e6' : mine[d] === '居家' ? '#e3f0fa' : undefined }}>
                <div>{d}</div><div className="small">{mine[d] ?? ''}</div>
                {othersOn(d, '休息') && <div className="muted" style={{ fontSize: 10, lineHeight: 1.2, marginTop: 2 }} title={`${othersOn(d, '休息')} 这天休息`}>{othersOn(d, '休息')}休</div>}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: '0 0 6px' }}>日期下面的小字是这天别人已经选了休息的人（已提交的才会显示），选日子时可以避开。下面“团队排班”能看到所有人的完整安排。</p>
          <p>休息 <b>{nRest}</b>/4 · 居家办公 <b>{nHome}</b>/4 <span className="muted small">　点日期切换：空 → 休息 → 居家 → 空</span></p>
          {me && (<>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <span className="small">搭档（你休息时帮你看房源）</span>
              <select value={me.partner_id ?? ''} disabled={busy} onChange={(e) => act({ action: 'set_partner', user_id: me.id, partner_id: e.target.value, backup_id: me.backup_id }, '已保存。')}>
                <option value="">请选择</option>{team.filter((x) => x.id !== me.id && x.id !== me.backup_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <span className="small">备选（搭档也休息时）</span>
              <select value={me.backup_id ?? ''} disabled={busy} onChange={(e) => act({ action: 'set_partner', user_id: me.id, partner_id: me.partner_id, backup_id: e.target.value }, '已保存。')}>
                <option value="">不设置</option>{team.filter((x) => x.id !== me.id && x.id !== me.partner_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            {!me.partner_id && <p className="warn small">还没选搭档：你休息的那几天，房源会转给管理员。</p>}
          </>)}
          {myCover.length > 0 && (
            <div className="small" style={{ marginBottom: 8 }}>
              <b>代班预览</b>
              {myCover.map((c) => <div key={c.d}>{month.slice(5)}/{pad(c.d)} 休息 → {c.who ? `${name(c.who)} 代班${c.note ? `（${c.note}）` : ''}` : <span style={{ color: '#b3261e' }}>{c.note}</span>}</div>)}
            </div>
          )}
          <div className="btn-row">
            {!locked && <button disabled={busy} onClick={submit}>{busy ? '提交中…' : '提交并锁定'}</button>}
            {locked && !myReq && <>
              <input placeholder="变更原因" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="ghost" disabled={busy} onClick={async () => { if (await act({ action: 'request', month, reason }, '已提交变更申请，等管理员批准。')) setReason('') }}>申请变更</button>
            </>}
            {myReq && <span className="muted small">变更申请已提交，等管理员批准。批准后这个月会解锁，改完重新提交。</span>}
          </div>
        </section>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{isAdmin ? '全局排班' : '团队排班'}（{month}）</h3>
        {isAdmin && reqs.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <b>待批准的变更</b>
            {reqs.map((r) => (
              <div key={r.id} className="btn-row" style={{ margin: '6px 0' }}>
                <span>{name(r.user_id)}：{r.reason || '（没写原因）'}</span>
                <button className="ghost" disabled={busy} onClick={() => act({ action: 'decide', id: r.id, approve: true }, '已批准，该月已解锁。')}>批准</button>
                <button className="ghost" disabled={busy} onClick={() => act({ action: 'decide', id: r.id, approve: false }, '已驳回。')}>驳回</button>
              </div>
            ))}
          </div>
        )}
        {(
          <div className="table-wrap" style={{ border: 0 }}>
            <table style={{ minWidth: 1500 }}>
              <thead><tr><th>助理</th><th>搭档</th><th>备选</th><th>状态</th>{days.map((d) => <th key={d} style={{ padding: '6px 2px', textAlign: 'center' }}>{d}</th>)}</tr></thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.id} style={t.id === profile?.id ? { background: '#f3f9f8' } : undefined}>
                    <td>{t.name}{t.id === profile?.id && <span className="muted small">（我）</span>}</td>
                    {(['partner_id', 'backup_id'] as const).map((k) => (
                      <td key={k}>
                        {!(isAdmin || t.id === profile?.id) ? name(t[k]) : <select value={t[k] ?? ''} disabled={busy} onChange={(e) => act({ action: 'set_partner', user_id: t.id, partner_id: k === 'partner_id' ? e.target.value : t.partner_id, backup_id: k === 'backup_id' ? e.target.value : t.backup_id }, '已保存。')}>
                          <option value="">—</option>{team.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>}
                      </td>
                    ))}
                    <td><span className={status[t.id] === '已提交' ? 'chip green' : 'chip amber'} style={{ marginLeft: 0 }}>{status[t.id] === '已提交' ? '已提交' : '未提交'}</span></td>
                    {days.map((d) => {
                      const k = plans[t.id]?.[d]
                      const clash = k === '休息' && !!t.partner_id && plans[t.partner_id]?.[d] === '休息'
                      return (
                        <td key={d} style={{ padding: 0, textAlign: 'center' }}>
                          <button className="ghost" disabled={busy || !isAdmin} title={clash ? '和搭档同天休息' : ''}
                            onClick={() => act({ action: 'admin_set', user_id: t.id, date: dayStr(month, d), kind: NEXT[k ?? ''] ?? null }, '已修改。')}
                            style={{ minHeight: 30, minWidth: 30, padding: 0, background: clash ? '#f8c9c4' : k === '休息' ? '#fde8e6' : k === '居家' ? '#e3f0fa' : undefined, border: clash ? '1px solid #b3261e' : undefined }}>
                            {k === '休息' ? '休' : k === '居家' ? '居' : ''}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={4}>当天在岗人数（居家算在岗）</td>
                  {days.map((d) => { const n = team.filter((t) => plans[t.id]?.[d] !== '休息').length; return <td key={d} style={{ textAlign: 'center', color: n === 0 ? '#b3261e' : undefined }}>{n}</td> })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {isAdmin ? <p className="muted small">点格子切换：空 → 休 → 居 → 空，管理员可以直接改，不受锁定限制。红框表示和搭档同一天休息，需要调整；在岗人数红色表示当天没人在岗。</p> : <p className="muted small">休 = 休息，居 = 居家办公。红框表示和搭档同一天休息；表里没填的人是还没提交。</p>}
        {isAdmin && !team.length && <p className="muted pad">还没有客服助理账号。</p>}
      </section>
    </div>
  )
}
