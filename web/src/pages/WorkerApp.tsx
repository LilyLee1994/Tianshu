import { useCallback, useEffect, useState } from 'react'
import { useAuth, ROLE_LABEL } from '../lib/auth'
import { callApi } from '../lib/api'
import { uploadPhotos } from '../lib/photos'
import { chipOf } from '../lib/ui'
import { supabase } from '../lib/supabase'

interface Item { id: number; urgent_label?: string | null; type: string; description: string | null; status: string; urgent: boolean; planned_date: string | null; property: { name: string } | null }
interface Detail {
  order: { id: number; type: string; description: string | null; status: string; urgent: boolean; planned_date: string | null; damage_report: string | null; urgent_text?: string | null }
  property: { name: string; address: string | null }
  access: { lock_location: string | null; lock_code: string | null; notes: string | null } | null
  accessHidden: boolean
}

function useWide() {
  const q = '(min-width: 900px)'
  const [w, setW] = useState(() => window.matchMedia(q).matches)
  useEffect(() => { const m = window.matchMedia(q); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return w
}

// 排序：当天入住（最紧）→ 次日入住 → 其他紧急 → 普通单；已完成的放最后
const rank = (o: Item) => o.status === '已完成' ? 9 : !o.urgent ? 3 : o.urgent_label === '当天入住' ? 0 : o.urgent_label === '次日入住' ? 1 : 2

export default function WorkerApp() {
  const { profile, signOut } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const isClean = profile?.role === 'cleaner'
  const [pwOpen, setPwOpen] = useState(false)
  const wide = useWide()

  const load = useCallback(async () => {
    const [r, e] = await callApi<{ orders: Item[] }>('worker-orders', {})
    if (e) setErr(e); else setItems(r!.orders)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className={wide ? 'mobile wide' : 'mobile'}>
      <header><div><b>{isClean ? '清洁任务' : '维修工单'}</b><div className="small">{profile?.name} · {ROLE_LABEL[profile!.role]}</div></div><span style={{ display: 'flex', gap: 8 }}><button onClick={() => setPwOpen(true)}>修改密码</button><button onClick={signOut}>退出</button></span></header>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {err && <div className="err-box">{err}</div>}
      {(() => {
        const list = (
          <>
            {!loading && items.length > 0 && <p className="muted small" style={{ margin: 0 }}>排序：当天入住的最紧急，排第一；然后是次日入住的，再是其他紧急；其余按退房日从早到晚，已完成的放最后。</p>}
            {loading && <p className="muted">加载中…</p>}
            {!loading && !items.length && <p className="muted pad">这里没有任务。助理派单后会出现在这里。</p>}
            {[...items].sort((a, b) => rank(a) - rank(b) || (a.planned_date ?? '9999').localeCompare(b.planned_date ?? '9999')).map((o) => (
            <button key={o.id} className={`${o.urgent && o.status !== '已完成' ? (o.urgent_label === '当天入住' ? 'mcard urgent now' : 'mcard urgent') : 'mcard'}${wide && open === o.id ? ' on' : ''}`} onClick={() => setOpen(o.id)}>
              <div className="mcard-top">
                <span className="mcard-name"><b>{o.property?.name}</b>{o.urgent && o.status !== '已完成' && <span className="chip amber">紧急{o.urgent_label ? ` · ${o.urgent_label}` : ''}</span>}</span>
                {o.status !== '已派单' && <span className={chipOf(o.status)} style={{ marginLeft: 0 }}>{o.status}</span>}
              </div>
              <div className="mcard-desc">{o.type} · {o.description ?? ''}</div>
              {o.planned_date && <div className="muted small">{o.type === '清洁' ? '退房日' : '计划日'}：{o.planned_date.slice(5)}</div>}
            </button>
          ))}
          </>
        )
        if (wide) return (
          <div className="wgrid">
            <div className="wlist">{list}</div>
            <div className="wdetail">{open === null ? <p className="muted pad">点左边的任务，在这里查看和处理。</p> : <OrderView key={open} id={open} isClean={isClean} wide onChanged={load} onBack={() => { setOpen(null); load() }} />}</div>
          </div>
        )
        return open === null ? list : <OrderView id={open} isClean={isClean} onChanged={load} onBack={() => { setOpen(null); load() }} />
      })()}
    </div>
  )
}

function OrderView({ id, isClean, onBack, onChanged, wide }: { id: number; isClean: boolean; onBack: () => void; onChanged?: () => void; wide?: boolean }) {
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
      onChanged?.()
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  if (!d) return <div>{!wide && <button className="back" onClick={onBack}>← 返回列表</button>}{err ? <div className="err-box">{err}</div> : <p className="muted">加载中…</p>}</div>
  const st = d.order.status
  const picker = (
    <label className="file">拍照 / 选照片（{files.length} 张）
      <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
    </label>
  )

  return (
    <div>
      {!wide && <button className="back" onClick={onBack}>← 返回列表</button>}
      <section className="card">
        <h2>{d.property.name} {d.order.urgent && <span className="chip amber">紧急</span>}</h2>
        <p>{d.order.type} · {d.order.description}</p>
        <span className={chipOf(st)} style={{ marginLeft: 0 }}>{st}</span>
        {d.order.urgent && st !== '已完成' && <p className="warn">{d.order.urgent_text ?? '紧急：请优先安排。'}{isClean && ' 进门发现损坏要马上上报，不要等到清洁结束。'}</p>}
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

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (a.length < 8) { setMsg('密码至少 8 位。'); return }
    if (a !== b) { setMsg('两次输入的密码不一样。'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: a })
    setBusy(false)
    if (error) { setMsg(`修改失败：${error.message}`); return }
    setOk(true)
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(92vw, 420px)' }} onClick={(e) => e.stopPropagation()}>
        <h2>修改密码</h2>
        {ok ? <>
          <p>密码已修改，下次登录请用新密码。</p>
          <div className="btn-row"><button onClick={onClose}>好的</button></div>
        </> : <>
          <label>新密码（至少 8 位）<input type="password" autoFocus value={a} onChange={(e) => setA(e.target.value)} /></label>
          <label>再输入一次<input type="password" value={b} onChange={(e) => setB(e.target.value)} /></label>
          {msg && <div className="err">{msg}</div>}
          <div className="btn-row"><button disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button><button className="ghost" onClick={onClose}>取消</button></div>
        </>}
      </div>
    </div>
  )
}
