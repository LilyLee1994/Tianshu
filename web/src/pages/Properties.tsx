import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface Row {
  id: number; name: string; address: string | null; region: string | null; assistant_id: string | null
  assistant: { name: string } | null
  property_details: {
    bedrooms: number | null; bathrooms: number | null; max_guests: number | null; beds: string | null; appliances: string[]
    lock_location: string | null; lock_code: string | null; wifi_name: string | null; wifi_password: string | null
    parking: string | null; bin_day: string | null; notes: string | null
  } | null
  property_contracts: { water: string; power: string; gas: string; internet: string; end_date: string | null } | null
}

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

export default function Properties() {
  const { profile } = useAuth()
  const isAssistant = profile?.role === 'assistant'
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('properties')
      .select('id, name, address, region, assistant_id, assistant:profiles!assistant_id(name), property_details(*), property_contracts(*)')
      .order('name')
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else setRows(data as unknown as Row[])
        setLoading(false)
      })
  }, [])

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const showAll = !isAssistant || scope === 'all'
  const list = useMemo(() => {
    const base = isAssistant && scope === 'mine' ? rows.filter((r) => r.assistant_id === profile?.id) : rows
    const k = norm(q)
    return k ? base.filter((r) => norm(r.name).includes(k) || norm(r.address ?? '').includes(k)) : base
  }, [rows, q, scope, isAssistant, profile])
  const cur = list.find((r) => r.id === sel) ?? list[0]

  if (loading) return <p className="muted">加载中…</p>
  if (err) return <p className="err">读取失败：{err}</p>

  return (
    <div>
      <h1>房源档案</h1>
      {isAssistant && (
        <div className="pills">
          <button className={scope === 'mine' ? 'pill on' : 'pill'} onClick={() => setScope('mine')}>自己的房源</button>
          <button className={scope === 'all' ? 'pill on' : 'pill'} onClick={() => setScope('all')}>全部房源</button>
        </div>
      )}
      <input className="search" placeholder="输入房源名或地址，边打边筛" value={q} onChange={(e) => setQ(e.target.value)} />

      {isAssistant && scope === 'all' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>房源</th><th>地址</th><th>主责助理</th><th>锁盒位置 / 密码</th><th>WiFi / 密码</th><th>停车</th><th>垃圾日</th><th>注意事项</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const d = r.property_details
                return (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td><td>{dash(r.address)}</td><td>{dash(r.assistant?.name)}</td>
                    <td>{dash(d?.lock_location)} / {dash(d?.lock_code)}</td><td>{dash(d?.wifi_name)} / {dash(d?.wifi_password)}</td>
                    <td>{dash(d?.parking)}</td><td>{dash(d?.bin_day)}</td><td>{dash(d?.notes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <p className="muted pad">没有匹配的房源。</p>}
        </div>
      ) : (
        <div className="split">
          <div className="side-list">
            {list.map((r) => (
              <button key={r.id} className={cur?.id === r.id ? 'item on' : 'item'} onClick={() => setSel(r.id)}>{r.name}</button>
            ))}
            {!list.length && <p className="muted pad">{showAll ? '还没有房源。' : '你还没有被分配房源。'}</p>}
          </div>
          {cur && (
            <section className="card">
              <h2>{cur.name}</h2>
              <dl>
                <dt>地址</dt><dd>{dash(cur.address)}</dd>
                <dt>区域</dt><dd>{dash(cur.region)}</dd>
                <dt>主责助理</dt><dd>{dash(cur.assistant?.name)}</dd>
                <dt>户型</dt><dd>{dash(cur.property_details?.bedrooms)} 房 {dash(cur.property_details?.bathrooms)} 卫 · 可住 {dash(cur.property_details?.max_guests)} 人</dd>
                <dt>床</dt><dd>{dash(cur.property_details?.beds)}</dd>
                <dt>家电设施</dt><dd>{cur.property_details?.appliances?.length ? cur.property_details.appliances.join('、') : '—'}</dd>
                <dt>锁盒</dt><dd>{dash(cur.property_details?.lock_location)} / {dash(cur.property_details?.lock_code)}</dd>
                <dt>WiFi</dt><dd>{dash(cur.property_details?.wifi_name)} / {dash(cur.property_details?.wifi_password)}</dd>
                <dt>停车 / 垃圾日</dt><dd>{dash(cur.property_details?.parking)} / {dash(cur.property_details?.bin_day)}</dd>
                <dt>注意事项</dt><dd>{dash(cur.property_details?.notes)}</dd>
                <dt>水电燃气网络</dt>
                <dd>水 {dash(cur.property_contracts?.water)} · 电 {dash(cur.property_contracts?.power)} · 燃气 {dash(cur.property_contracts?.gas)} · 网络 {dash(cur.property_contracts?.internet)} · 合同到期 {dash(cur.property_contracts?.end_date)}</dd>
              </dl>
              <p className="muted small">编辑功能下一步接上，这一版先读真实数据。</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
