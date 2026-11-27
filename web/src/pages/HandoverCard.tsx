import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { badOne } from './Reviews'
import { today } from '../lib/ui'

type Note = { id: number; note: string; created_at: string; author: { name: string } | null }
type Item = { key: string; tag: string; text: string }

const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10)

// 交接卡：代班人打开房源，一眼看到手头未完成的事 + 主责助理留的话。休息前没写备注，也有系统自动汇总。
export default function HandoverCard({ propertyId, assistantId }: { propertyId: number; assistantId: string | null }) {
  const { profile } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [items, setItems] = useState<Item[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const covering = profile?.role === 'assistant' && !!assistantId && assistantId !== profile.id

  const load = useCallback(async () => {
    const t = today()
    const [n, o, c, rv, ra, rs] = await Promise.all([
      supabase.from('handover_notes').select('id, note, created_at, author:profiles!created_by(name)').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(5),
      supabase.from('work_orders').select('id, type, description, status').eq('property_id', propertyId).not('status', 'in', '(已完成,已取消)'),
      supabase.from('claims').select('id, content, status').eq('property_id', propertyId).in('status', ['待提交', '联系客人中', '已提交平台', '平台处理中']),
      supabase.from('reviews').select('id, channel_name, rating, reviewed_at').eq('property_id', propertyId).not('rating', 'is', null).gte('reviewed_at', addDays(t, -60)),
      supabase.from('review_actions').select('review_id, status, result'),
      supabase.from('reservations').select('id, guest_name, arrival_date, comment:raw->>comment, gnote:raw->>guestNote').eq('property_id', propertyId).gte('arrival_date', t).lte('arrival_date', addDays(t, 14)).order('arrival_date'),
    ])
    if (n.error) setErr(`交接备注读取失败：${n.error.message}（是否已运行 052 迁移？）`); else setNotes((n.data ?? []) as unknown as Note[])
    const out: Item[] = []
    for (const x of (o.data ?? []) as { id: number; type: string; description: string | null; status: string }[]) out.push({ key: `o${x.id}`, tag: `工单 · ${x.status}`, text: `${x.type}${x.description ? '：' + x.description : ''}` })
    for (const x of (c.data ?? []) as { id: number; content: string; status: string }[]) out.push({ key: `c${x.id}`, tag: `索赔 · ${x.status}`, text: x.content })
    const acts = new Map(((ra.data ?? []) as { review_id: number; status: string; result: string | null }[]).map((a) => [a.review_id, a]))
    for (const x of (rv.data ?? []) as { id: number; channel_name: string | null; rating: number; reviewed_at: string }[]) {
      if (!badOne(x.channel_name, Number(x.rating))) continue
      const a = acts.get(x.id)
      const st = a?.status ?? '待处理'
      const follow = st === '已申诉' || (st === '赔偿客人' && a?.result === '等待客人删评')
      if (st === '待处理' || follow) out.push({ key: `r${x.id}`, tag: `差评 · ${follow ? '跟进中' : '待处理'}`, text: `${x.channel_name} ${x.reviewed_at.slice(0, 10)}` })
    }
    for (const x of (rs.data ?? []) as { id: number; guest_name: string | null; arrival_date: string; comment: string | null; gnote: string | null }[]) {
      const req = [x.comment, x.gnote].filter((v) => v && v.trim()).join(' / ')
      if (req) out.push({ key: `s${x.id}`, tag: `客人要求 · ${x.arrival_date.slice(5)} 入住`, text: `${x.guest_name ?? ''}：${req.slice(0, 120)}` })
    }
    setItems(out)
  }, [propertyId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!text.trim()) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('handover_notes').insert({ property_id: propertyId, note: text.trim(), created_by: profile?.id })
    setBusy(false)
    if (error) { setErr(`保存失败：${error.message}`); return }
    setText(''); load()
  }

  return (
    <div className="handover">
      <div className="handover-head"><b>交接卡</b>{covering && <span className="chip amber" style={{ marginLeft: 8 }}>你在代班这套房</span>}</div>
      <div className="handover-sec">
        <div className="muted small">主责助理的交接备注</div>
        {notes.map((n) => <div key={n.id} className="handover-note"><span className="muted small">{n.created_at.slice(5, 10).replace('-', '/')} {n.author?.name ?? ''}</span> {n.note}</div>)}
        {!notes.length && !err && <div className="muted small">还没有留备注。</div>}
        <div className="handover-add"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="休息前给代班人留句话，例如：客人 Lisa 在等维修回复" /><button className="ghost" disabled={busy || !text.trim()} onClick={save}>留言</button></div>
        {err && <div className="err small">{err}</div>}
      </div>
      <div className="handover-sec">
        <div className="muted small">系统自动汇总：这套房手头未完成的事</div>
        {items === null ? <div className="muted small">加载中…</div> : items.length === 0 ? <div className="muted small">目前没有未完成的事项。</div>
          : items.map((i) => <div key={i.key} className="handover-item"><span className="chip gray" style={{ marginLeft: 0 }}>{i.tag}</span> {i.text}</div>)}
      </div>
    </div>
  )
}
