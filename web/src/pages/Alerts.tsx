import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { coveredAssistantIds } from '../lib/cover'
import { fmtAt } from '../lib/History'

interface Alert { reservation_id: number; kind: string; detail: string; status: string; note: string | null; created_at: string; handled_at: string | null; handler: { name: string } | null; property: { name: string; assistant_id: string | null; assistant: { name: string } | null } | null; reservation: { guest_name: string | null; channel_name: string | null } | null }

// 新订单的清洁费或房费和这个房源平时差太多时的提醒。负责人看过订单没问题（或处理完）后点“已处理”。
export default function Alerts() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Alert[]>([])
  const [cover, setCover] = useState<Set<string> | null>(null)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState('')
  const isAssistant = profile?.role === 'assistant'

  useEffect(() => { if (isAssistant && profile) coveredAssistantIds(profile.id).then(setCover); else setCover(new Set()) }, [profile?.id, isAssistant]) // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('order_alerts')
      .select('reservation_id, kind, detail, status, note, created_at, handled_at, handler:profiles!handled_by(name), property:properties(name, assistant_id, assistant:profiles!assistant_id(name)), reservation:reservations(guest_name, channel_name)')
      .order('created_at', { ascending: false }).limit(500)
    if (error) setMsg(`读取出错：${error.message}（是否已运行 031 迁移？）`)
    setRows((data ?? []) as never)
  }, [])
  useEffect(() => { load() }, [load])

  const mine = (r: Alert) => !isAssistant || (!!r.property?.assistant_id && !!cover?.has(r.property.assistant_id))
  const shown = rows.filter((r) => mine(r) && (done ? r.status === '已处理' : r.status === '待处理'))

  const handle = async (r: Alert) => {
    const note = window.prompt('备注（可不填，比如“房东改价了，正常”）：') ?? null
    if (note === null) return
    const { error } = await supabase.from('order_alerts').update({ status: '已处理', note: note.trim() || null, handled_by: profile?.id, handled_at: new Date().toISOString() }).eq('reservation_id', r.reservation_id).eq('kind', r.kind)
    if (error) setMsg(error.message); else { setMsg('已处理。'); load() }
  }

  return (
    <div>
      <div className="title-row"><h1>订单异常</h1>
        <span className="btn-row" style={{ margin: 0 }}>
          <button className={!done ? 'pill on' : 'pill'} onClick={() => setDone(false)}>待处理</button>
          <button className={done ? 'pill on' : 'pill'} onClick={() => setDone(true)}>已处理</button>
        </span>
      </div>
      <p className="muted small">新订单的清洁费或房费，比这个房源近半年的订单低得太多时，会在这里提醒负责人。看过没问题，或者处理完了，点“已处理”。判断标准：清洁费比这个房源平时低 $10 以上（不管是谁做清洁都查）；订单总价是 0；每晚房费低于平时的 60%。订单不足 5 单的房源、28 晚以上的长单不判断。</p>
      {msg && <p className="muted">{msg}</p>}
      <div className="table-wrap">
        <table className="tight" style={{ width: 'auto', minWidth: 0 }}>
          <thead><tr><th>房源</th><th>负责人</th><th>类型</th><th>情况</th><th>客人</th><th>提醒时间</th>{done && <th>处理</th>}<th></th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={`${r.reservation_id}${r.kind}`}>
              <td><b>{r.property?.name}</b></td><td>{r.property?.assistant?.name ?? <span className="muted">未分配</span>}</td><td><span className="chip amber">{r.kind}</span></td>
              <td className="small">{r.detail}</td><td className="small">{r.reservation?.guest_name ?? '—'}</td>
              <td className="muted small">{fmtAt(r.created_at)}</td>
              {done && <td className="small">{r.handler?.name ?? '—'}{r.note ? `：${r.note}` : ''}</td>}
              <td>{r.status === '待处理' && <button className="ghost" onClick={() => handle(r)}>已处理</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        {!shown.length && <p className="muted pad">{done ? '还没有处理过的。' : '没有待处理的订单异常。'}</p>}
      </div>
    </div>
  )
}
