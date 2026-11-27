import { useRef } from 'react'

const monthEnd = (d: string) => { const [y, m] = d.split('-').map(Number); return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
const monthStart = (d: string) => `${d.slice(0, 7)}-01`

// 左右联动的日期范围：选了开始日期，结束日期自动跳到同一个月的月底并弹出日历，接着点就行；
// 先选结束日期时，开始日期自动落到那个月的 1 号。结束不会早于开始。
export default function DateRange({ from, to, onChange, fromTitle, toTitle }: { from: string; to: string; onChange: (from: string, to: string) => void; fromTitle?: string; toTitle?: string }) {
  const endRef = useRef<HTMLInputElement>(null)
  const pickFrom = (v: string) => {
    if (!v) { onChange(v, to); return }
    if (!to || to < v) {
      onChange(v, monthEnd(v))
      setTimeout(() => { try { endRef.current?.showPicker?.() } catch { /* 浏览器不支持就算了，手动点 */ } }, 60)
    } else onChange(v, to)
  }
  const pickTo = (v: string) => {
    if (!v) { onChange(from, v); return }
    onChange(!from || from > v ? monthStart(v) : from, v)
  }
  return (
    <>
      <input type="date" value={from} onChange={(e) => pickFrom(e.target.value)} title={fromTitle} />
      <span className="muted small">到</span>
      <input type="date" ref={endRef} value={to} onChange={(e) => pickTo(e.target.value)} title={toTitle} />
    </>
  )
}
