import JSZip from 'jszip'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Rec {
  id: number; type: string; description: string | null; status: string; done_date: string | null; planned_date: string | null
  photos: string[]; damage_photos: string[]; damage_report: string | null; worker: { name: string } | null
}
interface Prop { id: number; name: string; address: string | null }
const PAGE = 20

export default function CleaningRecords() {
  const [qp, setQp] = useSearchParams()
  const pid = Number(qp.get('property')) || null
  const [props, setProps] = useState<Prop[]>([])
  const [recs, setRecs] = useState<Rec[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [shown, setShown] = useState(PAGE)
  const [month, setMonth] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [big, setBig] = useState<string | null>(null)
  const [pq, setPq] = useState('')

  useEffect(() => { supabase.from('properties').select('id, name, address').order('name').limit(2000).then(({ data }) => setProps((data ?? []) as Prop[])) }, [])
  const prop = props.find((p) => p.id === pid)

  const load = useCallback(async () => {
    if (!pid) { setRecs([]); return }
    setLoading(true); setErr(''); setShown(PAGE)
    const { data, error } = await supabase.from('work_orders')
      .select('id, type, description, status, done_date, planned_date, photos, damage_photos, damage_report, worker:profiles!assigned_to(name)')
      .eq('property_id', pid).eq('type', '清洁')
      .order('done_date', { ascending: false, nullsFirst: false }).limit(300)
    if (error) { setErr(`读取失败：${error.message}`); setLoading(false); return }
    const rows = ((data ?? []) as unknown as Rec[]).filter((r) => (r.photos?.length ?? 0) + (r.damage_photos?.length ?? 0) > 0)
    setRecs(rows)
    const paths = [...new Set(rows.flatMap((r) => [...(r.damage_photos ?? []), ...(r.photos ?? [])]))]
    const map: Record<string, string> = {}
    for (let i = 0; i < paths.length; i += 100) {
      const { data: s } = await supabase.storage.from('work-photos').createSignedUrls(paths.slice(i, i + 100), 3600)
      for (const x of s ?? []) if (x.path && x.signedUrl) map[x.path] = x.signedUrl
    }
    setUrls(map); setLoading(false)
  }, [pid])
  useEffect(() => { load() }, [load])

  const dateOf = (r: Rec) => r.done_date ?? r.planned_date ?? ''
  const list = useMemo(() => recs.filter((r) => !month || dateOf(r).startsWith(month)), [recs, month])
  const total = list.reduce((n, r) => n + (r.photos?.length ?? 0) + (r.damage_photos?.length ?? 0), 0)

  // 下载：把照片打成一个 zip，每次清洁一个文件夹
  const download = async (rows: Rec[], key: string, name: string) => {
    setBusy(key); setErr('')
    try {
            const zip = new JSZip()
      let n = 0
      for (const r of rows) {
        const folder = zip.folder(`${dateOf(r) || '未知日期'} ${r.description ?? '清洁'}`.replace(/[\\/:*?"<>|]/g, ' ').trim())!
        const files = [...(r.damage_photos ?? []).map((p) => ['损坏', p] as const), ...(r.photos ?? []).map((p) => ['清洁', p] as const)]
        let i = 0
        for (const [kind, p] of files) {
          const u = urls[p]; if (!u) continue
          const resp = await fetch(u)
          if (!resp.ok) throw new Error(`有照片下载失败（${resp.status}），请刷新页面再试。`)
          folder.file(`${kind}${++i}.jpg`, await resp.blob()); n++
        }
      }
      if (!n) throw new Error('没有可下载的照片。')
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.zip`; a.click(); URL.revokeObjectURL(a.href)
    } catch (e) { setErr((e as Error).message) }
    setBusy('')
  }

  if (!pid) {
    const l = props.filter((p) => !pq || `${p.name} ${p.address ?? ''}`.toLowerCase().includes(pq.toLowerCase())).slice(0, 40)
    return (
      <div>
        <h1>清洁记录</h1>
        <p className="muted small">选一套房，查看每次清洁的照片，可以一键下载。也可以在“房源档案”里点“清洁记录”直接进来。</p>
        <input placeholder="搜索房源名称或地址" value={pq} onChange={(e) => setPq(e.target.value)} style={{ maxWidth: 360 }} />
        <div className="side-list" style={{ width: 'auto', maxWidth: 480, marginTop: 10 }}>
          {l.map((p) => <button key={p.id} className="item" onClick={() => setQp({ property: String(p.id) })}>{p.name}</button>)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="title-row">
        <h1>清洁记录 · {prop?.name ?? ''}</h1>
        <span className="btn-row" style={{ margin: 0 }}>
          <button className="ghost" onClick={() => setQp({})}>换一套房</button>
          <button disabled={!total || !!busy} onClick={() => download(list, 'all', `${prop?.name ?? '房源'}-清洁照片${month ? '-' + month : ''}`)}>{busy === 'all' ? '打包中…' : `一键下载全部照片（${total} 张）`}</button>
        </span>
      </div>
      {prop?.address && <p className="muted small">{prop.address}</p>}
      <div className="btn-row" style={{ marginBottom: 12, alignItems: 'center' }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} title="按月份筛选" />
        {month && <button className="ghost" onClick={() => setMonth('')}>清除月份</button>}
        <span className="muted small">共 {list.length} 次清洁记录。照片链接 1 小时内有效，过期请刷新页面。</span>
      </div>
      {err && <p className="err">{err}</p>}
      {loading && <p className="muted">加载中…</p>}
      {!loading && !list.length && <p className="muted pad">还没有清洁照片。清洁公司提交完成后会出现在这里。</p>}
      <div className="cr-list">
        {list.slice(0, shown).map((r) => {
          const all = [...(r.damage_photos ?? []).map((p) => ({ p, damage: true })), ...(r.photos ?? []).map((p) => ({ p, damage: false }))]
          return (
            <section key={r.id} className="cr-card">
              <div className="cr-head">
                <span><b>{dateOf(r) || '—'}</b> · {r.description ?? '清洁'} · {r.worker?.name ?? '—'} <span className="muted small">{all.length} 张</span></span>
                <button className="task-btn" disabled={!!busy} onClick={() => download([r], String(r.id), `${prop?.name ?? '房源'}-${dateOf(r)}-清洁照片`)}>{busy === String(r.id) ? '打包中…' : '下载这次'}</button>
              </div>
              {r.damage_report && <div className="err small">⚠ 上报损坏：{r.damage_report}</div>}
              <div className="cr-grid">
                {all.map(({ p, damage }) => urls[p] ? (
                  <button key={p} className="cr-pic" onClick={() => setBig(urls[p])}>
                    <img src={urls[p]} loading="lazy" alt="" />{damage && <span className="cr-tag">损坏</span>}
                  </button>
                ) : null)}
              </div>
            </section>
          )
        })}
      </div>
      {shown < list.length && <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}><button className="ghost" onClick={() => setShown(shown + PAGE)}>显示更多（还有 {list.length - shown} 次）</button></div>}
      {big && <div className="modal-bg" onClick={() => setBig(null)}><img src={big} alt="" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 8 }} /></div>}
    </div>
  )
}
