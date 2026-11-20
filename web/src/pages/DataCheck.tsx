import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callApi } from '../lib/api'

type Inv = { label: string; path: string; ok: boolean; error?: string; total?: number; fields?: { key: string; filled: number; sample: string }[]; links?: { where: string; n: number }[] }

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
  const [inv, setInv] = useState<Inv[] | null>(null)
  const [invBusy, setInvBusy] = useState(false)
  const [invErr, setInvErr] = useState('')
  const runInv = async () => {
    setInvBusy(true); setInvErr('')
    const [r, e] = await callApi<{ resources: Inv[] }>('hostaway-inventory', {})
    setInvBusy(false)
    if (e) setInvErr(e); else setInv(r?.resources ?? [])
  }
  const downloadInv = () => {
    const lines = (inv ?? []).flatMap((x) => [
      `## ${x.label}  (${x.path})  ${x.ok ? `抽样 ${x.total} 条，${x.fields?.length} 个字段` : `读取失败：${x.error}`}`,
      ...(x.links ? [`平台链接：${x.links.length ? x.links.map((l) => `${l.where} ${l.n}条`).join('；') : '没有找到 Airbnb/Booking 链接'}`] : []),
      ...(x.fields ?? []).map((f) => `${f.key}\t${f.filled}/${x.total}\t${f.sample}`),
      '',
    ])
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'hostaway-字段盘点.txt'; a.click(); URL.revokeObjectURL(url)
  }
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
    // 日历表很大：先取最新快照日，再只看那一天，避免全表排序超时
    ;(async () => {
      const { data: last, error: e1 } = await supabase.from('calendar_snapshots').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1)
      if (e1) { setCalErr(e1.message); return }
      const snap = last?.[0]?.snapshot_date
      if (!snap) { setCal({ n: 0, rows: [] }); return }
      const { data, count, error } = await supabase.from('calendar_snapshots')
        .select('date, snapshot_date, price, status, is_available, min_stay, property:properties(name)', { count: 'estimated' })
        .eq('snapshot_date', snap).order('property_id').order('date').limit(8)
      if (error) setCalErr(error.message)
      setCal({ n: count, rows: (data ?? []).map((r: any) => ({ ...r, property: r.property?.name })) })
    })()
  }, [])

  return (
    <div>
      <h1>同步数据检查</h1>
      <p className="muted">看一眼 Hostaway 同步下来的数据对不对：哪一列是空的，说明字段还没对上，告诉开发就行。</p>
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Hostaway 字段盘点</h3>
        <p className="muted small">看你的 Hostaway 账号实际能拿到哪些内容、每个字段有多少条填了值。姓名、联系方式、密码、评价正文不会显示。</p>
        <button className="btn primary" onClick={runInv} disabled={invBusy}>{invBusy ? '盘点中，约十几秒…' : '开始盘点'}</button>
        {inv && <button className="ghost" style={{ marginLeft: 8 }} onClick={downloadInv}>下载结果（发给开发）</button>}
        {invErr && <p className="error">{invErr}</p>}
        {inv?.map((x) => (
          <details key={x.label} style={{ marginTop: 10 }}>
            <summary><b>{x.label}</b> <span className="muted small">{x.ok ? `抽样 ${x.total} 条，${x.fields?.length} 个字段` : `读取失败：${x.error}`}</span></summary>
            {x.links && <p className="small">平台链接：{x.links.length ? x.links.map((l) => `${l.where}（${l.n} 条）`).join('；') : '没有在这份数据里找到 Airbnb / Booking 链接'}</p>}
            {x.ok && <div className="table-wrap" style={{ border: 0 }}><table style={{ minWidth: 520 }}>
              <thead><tr><th>字段</th><th>有值</th><th>示例</th></tr></thead>
              <tbody>{x.fields?.map((f) => <tr key={f.key}><td>{f.key}</td><td>{f.filled}/{x.total}</td><td>{f.sample || '—'}</td></tr>)}</tbody>
            </table></div>}
          </details>
        ))}
      </section>
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
