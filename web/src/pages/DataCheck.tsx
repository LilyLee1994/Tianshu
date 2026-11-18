import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Row = Record<string, unknown>
const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

function Block({ title, count, rows, cols }: { title: string; count: number | null; rows: Row[]; cols: [string, string][] }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}（共 {count ?? '…'} 条，下面是最新 8 条）</h3>
      <div className="table-wrap" style={{ border: 0 }}>
        <table style={{ minWidth: 700 }}>
          <thead><tr>{cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k}>{cell(r[k])}</td>)}</tr>)}</tbody>
        </table>
        {!rows.length && <p className="muted pad">还没有数据。</p>}
      </div>
    </section>
  )
}

export default function DataCheck() {
  const [res, setRes] = useState<{ n: number | null; rows: Row[] }>({ n: null, rows: [] })
  const [rev, setRev] = useState<{ n: number | null; rows: Row[] }>({ n: null, rows: [] })
  const [cal, setCal] = useState<{ n: number | null; rows: Row[] }>({ n: null, rows: [] })
  const [calErr, setCalErr] = useState('')
  const [raw, setRaw] = useState<{ review: string; reservation: string }>({ review: '', reservation: '' })

  useEffect(() => {
    // 原始数据样本（去掉客人姓名、联系方式等个人信息和评价正文）
    const strip = (o: Record<string, unknown> | null) => {
      if (!o) return ''
      const bad = /name|email|phone|text|comment|content|message|address|note|password|code/i
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o)) out[k] = bad.test(k) ? '(已隐藏)' : v
      return JSON.stringify(out, null, 1)
    }
    supabase.from('reviews').select('raw').order('reviewed_at', { ascending: false }).limit(1).then(({ data }) => setRaw((x) => ({ ...x, review: strip((data?.[0]?.raw ?? null) as never) })))
    supabase.from('reservations').select('raw').order('arrival_date', { ascending: false }).limit(1).then(({ data }) => setRaw((x) => ({ ...x, reservation: strip((data?.[0]?.raw ?? null) as never) })))
    supabase.from('reservations').select('id, channel_name, status, guest_name, arrival_date, departure_date, nights, total_price, cleaning_fee, currency, property:properties(name)', { count: 'exact' }).order('arrival_date', { ascending: false }).limit(8)
      .then(({ data, count }) => setRes({ n: count, rows: (data ?? []).map((r: any) => ({ ...r, property: r.property?.name })) }))
    supabase.from('reviews').select('id, channel_name, rating, reviewed_at, property:properties(name)', { count: 'exact' }).order('reviewed_at', { ascending: false }).limit(8)
      .then(({ data, count }) => setRev({ n: count, rows: (data ?? []).map((r: any) => ({ ...r, property: r.property?.name })) }))
    supabase.from('calendar_snapshots').select('date, snapshot_date, price, status, is_available, min_stay, property:properties(name)', { count: 'exact' }).order('snapshot_date', { ascending: false }).order('date').limit(8)
      .then(({ data, count, error }) => { if (error) setCalErr(error.message); setCal({ n: count, rows: (data ?? []).map((r: any) => ({ ...r, property: r.property?.name })) }) })
  }, [])

  return (
    <div>
      <h1>同步数据检查</h1>
      <p className="muted">看一眼 Hostaway 同步下来的数据对不对：哪一列是空的，说明字段还没对上，告诉开发就行。</p>
      <Block title="订单" count={res.n} rows={res.rows} cols={[['property', '房源'], ['channel_name', '渠道'], ['status', '状态'], ['guest_name', '客人'], ['arrival_date', '入住'], ['departure_date', '退房'], ['nights', '晚数'], ['total_price', '总价'], ['cleaning_fee', '清洁费']]} />
      <Block title="评价" count={rev.n} rows={rev.rows} cols={[['property', '房源'], ['channel_name', '渠道'], ['rating', '评分'], ['reviewed_at', '时间']]} />
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>原始数据样本（排查字段用，已隐藏姓名、联系方式、正文）</h3>
        <p className="muted small">如果上面某一列是空的，把这里对应的内容复制发给开发。</p>
        <b>评价</b><pre className="raw">{raw.review || '…'}</pre>
        <b>订单</b><pre className="raw">{raw.reservation || '…'}</pre>
      </section>
      {calErr && <p className="error">日历价格读取出错：{calErr}</p>}
      <Block title="日历价格快照" count={cal.n} rows={cal.rows} cols={[['property', '房源'], ['date', '日期'], ['price', '价格'], ['status', '状态'], ['is_available', '可订'], ['min_stay', '最少晚数'], ['snapshot_date', '快照日']]} />
    </div>
  )
}
