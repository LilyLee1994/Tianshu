import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// 评分口径：Airbnb 原始是 10 分制（5 星×2），换成 5 星看；Booking 保持 10 分制。
// 房源低分：Airbnb 均分 < 4.2 星，Booking 均分 < 8.4。单条差评：Airbnb < 4 星，Booking < 8 分。
export const isAirbnb = (c: string | null) => c === 'Airbnb'
export const isBooking = (c: string | null) => c === 'Booking.com'
export const showScore = (c: string | null, v: number) => (isAirbnb(c) ? `${(v / 2).toFixed(2).replace(/\.?0+$/, '')} 星` : `${Number(v).toFixed(2).replace(/\.?0+$/, '')} 分`)
const lowAvg = (c: string | null, v: number) => (isAirbnb(c) ? v / 2 < 4.2 : isBooking(c) ? v < 8.4 : false)
const badOne = (c: string | null, v: number) => (isAirbnb(c) ? v / 2 < 4 : isBooking(c) ? v < 8 : false)
const INACTIVE = /不做|old|long|backup|暂时关闭|对账/i

type Prop = { id: number; name: string; assistant_id: string | null; assistant: { name: string } | null }
type Stat = { property_id: number; channel_name: string | null; n: number; avg_rating: number }
type Rev = { id: number; property_id: number; channel_name: string | null; rating: number; reviewed_at: string; text: string | null }

export default function Reviews() {
  const { profile } = useAuth()
  const isAssistant = profile?.role === 'assistant'
  const [scope, setScope] = useState<'mine' | 'all'>(isAssistant ? 'mine' : 'all')
  const [days, setDays] = useState(7)
  const [props, setProps] = useState<Prop[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [revs, setRevs] = useState<Rev[]>([])
  const [err, setErr] = useState('')

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
    return !(isAssistant && scope === 'mine') || p.assistant_id === profile?.id
  }

  const bad = revs.filter((r) => badOne(r.channel_name, Number(r.rating)) && visible(r.property_id))

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
      .filter((x) => x.p && !INACTIVE.test(x.p.name) && visible(x.p.id) && ((x.e.a && lowAvg('Airbnb', Number(x.e.a.avg_rating))) || (x.e.b && lowAvg('Booking.com', Number(x.e.b.avg_rating)))))
      .sort((x, y) => (Number(x.e.a?.avg_rating ?? 99) / 2) - (Number(y.e.a?.avg_rating ?? 99) / 2))
  }, [stats, pById, scope, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellOf = (s: Stat | undefined) => {
    if (!s) return <span className="muted">暂无评价</span>
    const low = lowAvg(s.channel_name, Number(s.avg_rating))
    return <span style={low ? { color: '#b3261e', fontWeight: 600 } : undefined}>{showScore(s.channel_name, Number(s.avg_rating))} <span className="muted small">（{s.n} 条）</span></span>
  }

  return (
    <div>
      <h1>差评</h1>
      {isAssistant && (
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button className={scope === 'mine' ? 'pill on' : 'pill'} onClick={() => setScope('mine')}>自己的房源</button>
          <button className={scope === 'all' ? 'pill on' : 'pill'} onClick={() => setScope('all')}>全部房源</button>
        </div>
      )}
      {err && <p className="error">读取出错：{err}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="title-row">
          <h3 style={{ margin: 0 }}>最近差评 <span className="muted small">Airbnb 低于 4 星、Booking 低于 8 分</span></h3>
          <span className="btn-row" style={{ margin: 0 }}>
            {[7, 30, 90].map((d) => <button key={d} className={days === d ? 'pill on' : 'pill'} onClick={() => setDays(d)}>{d} 天</button>)}
          </span>
        </div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table style={{ minWidth: 720 }}>
            <thead><tr><th>房源</th><th>负责助理</th><th>平台</th><th>评分</th><th>日期</th><th>评价内容</th></tr></thead>
            <tbody>{bad.map((r) => (
              <tr key={r.id}>
                <td>{pById.get(r.property_id)?.name}</td><td>{pById.get(r.property_id)?.assistant?.name ?? '—'}</td>
                <td>{r.channel_name}</td><td style={{ color: '#b3261e', fontWeight: 600 }}>{showScore(r.channel_name, Number(r.rating))}</td>
                <td>{r.reviewed_at.slice(0, 10)}</td><td style={{ maxWidth: 360 }}>{r.text ? r.text.slice(0, 160) : <span className="muted">没有文字评价</span>}</td>
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
    </div>
  )
}
