import { useEffect, useRef, useState } from 'react'

// 日期范围选择：点开下拉日历，先点开始日、再点结束日，一次选完整个范围
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const WEEK = ['一', '二', '三', '四', '五', '六', '日']

function Month({ first, start, end, hover, onPick, onHover }: { first: Date; start: string; end: string; hover: string; onPick: (d: string) => void; onHover: (d: string) => void }) {
  const y = first.getFullYear(), m = first.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7            // 周一开头
  const days = new Date(y, m + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(y, m, i + 1)))]
  const a = start && end ? (start <= end ? [start, end] : [end, start]) : start && hover ? (start <= hover ? [start, hover] : [hover, start]) : [start, start]
  return (
    <div className="dr-month">
      <div className="dr-title">{y} 年 {m + 1} 月</div>
      <div className="dr-grid">
        {WEEK.map((w) => <span key={w} className="dr-wk">{w}</span>)}
        {cells.map((c, i) => c === null ? <span key={i} /> : (
          <button key={c} type="button" className={`dr-day${c === a[0] || c === a[1] ? ' edge' : c > a[0] && c < a[1] ? ' mid' : ''}${c === ymd(new Date()) ? ' today' : ''}`}
            onClick={() => onPick(c)} onMouseEnter={() => onHover(c)}>{Number(c.slice(8))}</button>
        ))}
      </div>
    </div>
  )
}

export default function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void; fromTitle?: string; toTitle?: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => parse(from || ymd(new Date())))
  const [pending, setPending] = useState('')          // 已经点了开始日，还在等结束日
  const [hover, setHover] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setPending('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const show = () => { setView(addMonths(parse(from || ymd(new Date())), 0)); setPending(''); setOpen((o) => !o) }
  const pick = (d: string) => {
    if (!pending) { setPending(d); return }
    const [a, b] = pending <= d ? [pending, d] : [d, pending]
    onChange(a, b); setPending(''); setOpen(false)
  }
  const preset = (a: Date, b: Date) => { onChange(ymd(a), ymd(b)); setPending(''); setOpen(false) }
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth()
  const label = from && to ? `${from}  ~  ${to}` : '选择日期范围'

  return (
    <div className="dr" ref={box}>
      <button type="button" className="dr-btn" onClick={show}><span>📅</span>{label}</button>
      {open && (
        <div className="dr-pop">
          <div className="dr-presets">
            <button type="button" onClick={() => preset(new Date(y, mo, 1), new Date(y, mo + 1, 0))}>本月</button>
            <button type="button" onClick={() => preset(new Date(y, mo - 1, 1), new Date(y, mo, 0))}>上个月</button>
            <button type="button" onClick={() => preset(new Date(Date.now() - 6 * 86400_000), now)}>近 7 天</button>
            <button type="button" onClick={() => preset(new Date(Date.now() - 29 * 86400_000), now)}>近 30 天</button>
            <button type="button" onClick={() => preset(new Date(y, 0, 1), now)}>今年</button>
            <button type="button" onClick={() => { onChange('', ''); setPending(''); setOpen(false) }}>清除</button>
          </div>
          <div className="dr-nav">
            <button type="button" onClick={() => setView(addMonths(view, -1))}>‹</button>
            <span className="muted small">{pending ? '再点一个日期作为结束日' : '先点开始日，再点结束日'}</span>
            <button type="button" onClick={() => setView(addMonths(view, 1))}>›</button>
          </div>
          <div className="dr-months" onMouseLeave={() => setHover('')}>
            <Month first={view} start={pending || from} end={pending ? '' : to} hover={hover} onPick={pick} onHover={setHover} />
            <Month first={addMonths(view, 1)} start={pending || from} end={pending ? '' : to} hover={hover} onPick={pick} onHover={setHover} />
          </div>
        </div>
      )}
    </div>
  )
}
