import { useCallback, useEffect, useState } from 'react'
import { useAuth, ROLE_LABEL } from '../lib/auth'
import { callApi } from '../lib/api'
import { uploadPhotos } from '../lib/photos'
import { chipOf } from '../lib/ui'

interface Item { id: number; type: string; description: string | null; status: string; urgent: boolean; planned_date: string | null; property: { name: string } | null }
interface Detail {
  order: { id: number; type: string; description: string | null; status: string; urgent: boolean; planned_date: string | null; damage_report: string | null }
  property: { name: string; address: string | null }
  access: { lock_location: string | null; lock_code: string | null; notes: string | null } | null
  accessHidden: boolean
}

export default function WorkerApp() {
  const { profile, signOut } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const isClean = profile?.role === 'cleaner'

  const load = useCallback(async () => {
    const [r, e] = await callApi<{ orders: Item[] }>('worker-orders', {})
    if (e) setErr(e); else setItems(r!.orders)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="mobile">
      <header><div><b>{isClean ? '清洁任务' : '维修工单'}</b><div className="small">{profile?.name} · {ROLE_LABEL[profile!.role]}</div></div><button onClick={signOut}>退出</button></header>
      {err && <div className="err-box">{err}</div>}
      {open === null ? (
        <>
          {loading && <p className="muted">加载中…</p>}
          {!loading && !items.length && <p className="muted pad">这里没有任务。助理派单后会出现在这里。</p>}
          {items.map((o) => (
            <button key={o.id} className="mcard" onClick={() => setOpen(o.id)}>
              <div><b>{o.property?.name}</b>{o.urgent && <span className="chip amber">紧急</span>}</div>
              <div>{o.type} · {o.description ?? ''}</div>
              <div><span className={chipOf(o.status)} style={{ marginLeft: 0 }}>{o.status}</span></div>
            </button>
          ))}
        </>
      ) : <OrderView id={open} isClean={isClean} onBack={() => { setOpen(null); load() }} />}
    </div>
  )
}

function OrderView({ id, isClean, onBack }: { id: number; isClean: boolean; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [amount, setAmount] = useState('')
  const [damage, setDamage] = useState(false)
  const [text, setText] = useState('')
  const [done, setDone] = useState('')

  const load = useCallback(async () => {
    const [r, e] = await callApi<Detail>('worker-order', { orderId: id })
    if (e) setErr(e); else setD(r)
  }, [id])
  useEffect(() => { load() }, [load])

  const act = async (action: string, extra: Record<string, unknown> = {}, needPhotos = false) => {
    setBusy(true); setErr('')
    try {
      const photos = needPhotos ? await uploadPhotos(id, files) : []
      const [, e] = await callApi('worker-act', { orderId: id, action, photos, ...extra })
      if (e) { setErr(e); setBusy(false); return }
      setFiles([]); setAmount(''); setText(''); setDamage(false)
      setDone(action === 'accept' ? '已接单，下面可以看到地址和进门方式。' : action === 'damage' ? '已上报，助理会马上收到。你可以接着清洁。' : '已提交，谢谢。')
      await load()
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  if (!d) return <div><button className="back" onClick={onBack}>← 返回列表</button>{err ? <div className="err-box">{err}</div> : <p className="muted">加载中…</p>}</div>
  const st = d.order.status
  const picker = (
    <label className="file">拍照 / 选照片（{files.length} 张）
      <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
    </label>
  )

  return (
    <div>
      <button className="back" onClick={onBack}>← 返回列表</button>
      <section className="card">
        <h2>{d.property.name} {d.order.urgent && <span className="chip amber">紧急</span>}</h2>
        <p>{d.order.type} · {d.order.description}</p>
        <span className={chipOf(st)} style={{ marginLeft: 0 }}>{st}</span>
        {isClean && d.order.urgent && <p className="warn">请优先安排，务必在入住前完成。进门发现损坏要马上上报，不要等到清洁结束。</p>}
        {d.property.address && <p><b>地址：</b>{d.property.address}</p>}
        {d.access && <p><b>锁盒：</b>{d.access.lock_location ?? '—'} / {d.access.lock_code ?? '—'}<br /><b>备注：</b>{d.access.notes ?? '—'}</p>}
        {d.accessHidden && !isClean && st === '已派单' && <p className="muted small">接单后才显示详细地址和进门方式，完成后自动隐藏。</p>}
        {d.order.damage_report && <p className="muted small">已上报损坏：{d.order.damage_report}</p>}
      </section>
      {done && <div className="ok">{done}</div>}
      {err && <div className="err-box">{err}</div>}

      {!isClean && st === '已派单' && <button className="primary big" disabled={busy} onClick={() => act('accept')}>接单</button>}
      {!isClean && st === '已接单' && (
        <section className="card">
          <h3>完成情况</h3>
          <label>实际费用（$）<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {picker}
          <button className="primary big" disabled={busy || !amount || !files.length} onClick={() => act('complete', { amount }, true)}>{busy ? '提交中…' : '提交完成'}</button>
          <p className="muted small">提交后等助理确认费用，确认后你不能再改。</p>
        </section>
      )}
      {isClean && st === '已派单' && !damage && (
        <section className="card">
          <h3>清洁完成</h3>
          {picker}
          <button className="primary big" disabled={busy || !files.length} onClick={() => act('complete', {}, true)}>{busy ? '提交中…' : '没有问题，提交清洁照片'}</button>
          <button className="ghost big" onClick={() => { setDamage(true); setFiles([]) }}>进门就发现损坏？上报损坏</button>
        </section>
      )}
      {isClean && st === '已派单' && damage && (
        <section className="card">
          <h3>上报损坏</h3>
          <p className="muted small">先拍照、写清楚再上报，助理会马上收到。上报后你可以接着清洁。</p>
          <label>损坏情况<textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} /></label>
          {picker}
          <button className="primary big" disabled={busy || !text.trim() || !files.length} onClick={() => act('damage', { text }, true)}>{busy ? '提交中…' : '提交上报'}</button>
          <button className="ghost big" onClick={() => { setDamage(false); setFiles([]) }}>← 取消，回到任务</button>
        </section>
      )}
    </div>
  )
}
