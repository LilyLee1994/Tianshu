import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { coveredAssistantIds } from '../lib/cover'
import { money, today } from '../lib/ui'

// 评分口径：Airbnb 原始是 10 分制（5 星×2），换成 5 星看；Booking 保持 10 分制。
// 房源低分：Airbnb 均分 < 4.2 星，Booking 均分 < 8.4。单条差评：Airbnb < 4 星，Booking < 8 分。
export const isAirbnb = (c: string | null) => c === 'Airbnb'
export const isBooking = (c: string | null) => c === 'Booking.com'
export const showScore = (c: string | null, v: number) => (isAirbnb(c) ? `${(v / 2).toFixed(2).replace(/\.?0+$/, '')} 星` : `${Number(v).toFixed(2).replace(/\.?0+$/, '')} 分`)
const lowAvg = (c: string | null, v: number) => (isAirbnb(c) ? v / 2 < 4.2 : isBooking(c) ? v < 8.4 : false)
export const badOne = (c: string | null, v: number) => (isAirbnb(c) ? v / 2 < 4 : isBooking(c) ? v < 8 : false)
const INACTIVE = /不做|old|long|backup|暂时关闭|对账/i

type Prop = { id: number; name: string; assistant_id: string | null; assistant: { name: string } | null }
type Stat = { property_id: number; channel_name: string | null; n: number; avg_rating: number }
type Act = { review_id: number; status: string; comp_amount: number | null; payer: string | null; result: string | null; note: string | null; handled_date: string | null }
type Rev = { id: number; property_id: number; channel_name: string | null; rating: number; reviewed_at: string; text: string | null }

export default function Reviews() {
  const { profile } = useAuth()
  const [cover, setCover] = useState<Set<string>>(new Set())
  useEffect(() => { if (profile?.role === 'assistant') coveredAssistantIds(profile.id).then(setCover) }, [profile?.id, profile?.role])
  const isAssistant = profile?.role === 'assistant'
  const [sp, setSp] = useSearchParams()
  const onlyProp = Number(sp.get('property')) || null
  const [days, setDays] = useState(onlyProp ? 90 : 7)
  const [props, setProps] = useState<Prop[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [revs, setRevs] = useState<Rev[]>([])
  const [err, setErr] = useState('')
  const [acts, setActs] = useState<Map<number, Act>>(new Map())
  const [handling, setHandling] = useState<Rev | null>(null)
  const loadActs = () => supabase.from('review_actions').select('*').limit(5000).then(({ data }) => setActs(new Map((data ?? []).map((a: Act) => [a.review_id, a]))))
  useEffect(() => { loadActs() }, [])

  useEffect(() => {
    supabase.from('properties').select('id, name, assistant_id, assistant:profiles!assistant_id(name)').then(({ data, error }) => { if (error) setErr(error.message); setProps((data ?? []) as never) })
    supabase.from('review_stats').select('*').limit(5000).then(({ data, error }) => { if (error) setErr(error.message); setStats((data ?? []) as never) })
  }, [])

  useEffect(() => {
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    supabase.from('reviews').select('id, property_id, channel_name, rating, reviewed_at, text:raw->>publicReview')
      .gte('reviewed_at', since).not('rating', 'is', null).order('reviewed_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (error) setErr(error.message); setRevs((data ?? []) as never) })
  }, [days])

  const pById = useMemo(() => new Map(props.map((p) => [p.id, p])), [props])
  const visible = (pid: number) => {
    const p = pById.get(pid)
    if (!p) return false
    return !isAssistant || (!!p.assistant_id && cover.has(p.assistant_id))
  }

  const bad = revs.filter((r) => badOne(r.channel_name, Number(r.rating)) && visible(r.property_id) && (!onlyProp || r.property_id === onlyProp))

  const lowRows = useMemo(() => {
    const by = new Map<number, { a?: Stat; b?: Stat }>()
    for (const s of stats) {
      const e = by.get(s.property_id) ?? {}
      if (isAirbnb(s.channel_name)) e.a = s
      else if (isBooking(s.channel_name)) e.b = s
      by.set(s.property_id, e)
    }
    return [...by.entries()]
      .map(([pid, e]) => ({ p: pById.get(pid), e }))
      .filter((x) => x.p && !INACTIVE.test(x.p.name) && visible(x.p.id) && (!onlyProp || x.p.id === onlyProp) && ((x.e.a && lowAvg('Airbnb', Number(x.e.a.avg_rating))) || (x.e.b && lowAvg('Booking.com', Number(x.e.b.avg_rating)))))
      .sort((x, y) => (Number(x.e.a?.avg_rating ?? 99) / 2) - (Number(y.e.a?.avg_rating ?? 99) / 2))
  }, [stats, pById, profile, onlyProp]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellOf = (s: Stat | undefined) => {
    if (!s) return <span className="muted">暂无评价</span>
    const low = lowAvg(s.channel_name, Number(s.avg_rating))
    return <span style={low ? { color: '#b3261e', fontWeight: 600 } : undefined}>{showScore(s.channel_name, Number(s.avg_rating))} <span className="muted small">（{s.n} 条）</span></span>
  }

  return (
    <div>
      <h1>差评</h1>
      {onlyProp && <p className="btn-row" style={{ alignItems: 'center' }}><span className="chip blue" style={{ marginLeft: 0 }}>只看：{pById.get(onlyProp)?.name ?? '这个房源'}</span><button className="ghost" onClick={() => setSp({})}>看全部房源</button></p>}
      {err && <p className="error">读取出错：{err}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="title-row">
          <h3 style={{ margin: 0 }}>最近差评 <span className="muted small">Airbnb 低于 4 星、Booking 低于 8 分 · 待处理 {bad.filter((r) => (acts.get(r.id)?.status ?? '待处理') === '待处理').length} 条</span></h3>
          <span className="btn-row" style={{ margin: 0 }}>
            {[7, 30, 90].map((d) => <button key={d} className={days === d ? 'pill on' : 'pill'} onClick={() => setDays(d)}>{d} 天</button>)}
          </span>
        </div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table style={{ minWidth: 900 }}>
            <thead><tr><th>房源</th><th>负责助理</th><th>平台</th><th>评分</th><th>日期</th><th>评价内容</th><th>处理</th></tr></thead>
            <tbody>{bad.map((r) => (
              <tr key={r.id}>
                <td>{pById.get(r.property_id)?.name}</td><td>{pById.get(r.property_id)?.assistant?.name ?? '—'}</td>
                <td>{r.channel_name}</td><td style={{ color: '#b3261e', fontWeight: 600 }}>{showScore(r.channel_name, Number(r.rating))}</td>
                <td>{r.reviewed_at.slice(0, 10)}</td><td style={{ maxWidth: 360 }}>{r.text ? r.text.slice(0, 160) : <span className="muted">没有文字评价</span>}</td>
                <td>
                  {(() => { const a = acts.get(r.id); const st = a?.status ?? '待处理'
                    return <span className="btn-row" style={{ margin: 0 }}>
                      <span className={st === '待处理' ? 'chip amber' : 'chip green'} style={{ marginLeft: 0 }}>{st}</span>
                      {st === '赔偿客人' && <span className="muted small">{money(a?.comp_amount)} {a?.payer}出 · {a?.result ?? ''}</span>}
                      <button className="ghost" onClick={() => setHandling(r)}>处理</button>
                    </span> })()}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!bad.length && <p className="muted pad">最近 {days} 天没有差评。</p>}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>低分房源 <span className="muted small">Airbnb 均分低于 4.2 星，或 Booking 低于 8.4 分；已排除停用类房源；按历史全部评价计算</span></h3>
        <div className="table-wrap" style={{ border: 0 }}>
          <table style={{ minWidth: 560 }}>
            <thead><tr><th>房源</th><th>负责助理</th><th>Airbnb</th><th>Booking</th></tr></thead>
            <tbody>{lowRows.map(({ p, e }) => (
              <tr key={p!.id}><td>{p!.name}</td><td>{p!.assistant?.name ?? '—'}</td><td>{cellOf(e.a)}</td><td>{cellOf(e.b)}</td></tr>
            ))}</tbody>
          </table>
          {!lowRows.length && <p className="muted pad">没有低分房源。</p>}
        </div>
      </section>
      {handling && <HandleModal rev={handling} act={acts.get(handling.id)} name={pById.get(handling.property_id)?.name ?? ''} onClose={() => setHandling(null)} onSaved={() => { setHandling(null); loadActs() }} />}
    </div>
  )
}

function HandleModal({ rev, act, name, onClose, onSaved }: { rev: Rev; act?: Act; name: string; onClose: () => void; onSaved: () => void }) {
  const [st, setSt] = useState(act?.status ?? '待处理')
  const [amt, setAmt] = useState(act?.comp_amount != null ? String(act.comp_amount) : '')
  const [payer, setPayer] = useState(act?.payer ?? '公司')
  const [result, setResult] = useState(act?.result ?? '等待客人删评')
  const [note, setNote] = useState(act?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const comp = st === '赔偿客人'
  const save = async () => {
    if (comp && (amt.trim() === '' || Number.isNaN(Number(amt)))) { setErr('赔偿客人要填金额。'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('review_actions').upsert({
      review_id: rev.id, status: st, comp_amount: comp ? Number(amt) : null, payer: comp ? payer : null, result: comp ? result : null,
      note: note.trim() || null, handled_date: st === '待处理' ? null : act?.handled_date ?? today(), updated_at: new Date().toISOString(),
    }, { onConflict: 'review_id' })
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{name} · 处理差评</h2>
        <p className="muted small">{rev.channel_name} {showScore(rev.channel_name, Number(rev.rating))} · {rev.reviewed_at.slice(0, 10)}{rev.text ? `：${rev.text.slice(0, 120)}` : ''}</p>
        <label>处理方式
          <select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="待处理">待处理</option><option value="已回复">已回复</option><option value="已申诉">已申诉（向平台）</option>
            <option value="赔偿客人">赔偿客人，请他删评</option><option value="无需处理">无需处理</option>
          </select>
        </label>
        {comp && <>
          <label>赔偿金额（$）<input value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
          <label>费用谁出<select value={payer} onChange={(e) => setPayer(e.target.value)}><option>公司</option><option>房东</option></select></label>
          <label>结果<select value={result} onChange={(e) => setResult(e.target.value)}><option>等待客人删评</option><option>客人已删评</option><option>客人没删</option></select></label>
          {payer === '房东' && <p className="muted small">房东承担的金额会进当月房东结算，按处理日期算月份。</p>}
        </>}
        <label>备注<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <div className="btn-row"><button disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
      </div>
    </div>
  )
}
