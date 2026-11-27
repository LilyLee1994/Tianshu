// 全站按钮的“处理中”反馈：点任何按钮，按钮上马上出现转圈，至少 0.6 秒；
// 点击后如果发出了网络请求，就一直转到请求结束（最多 60 秒）。转圈期间按钮不能重复点，防止重复提交。
// 必须在 supabase 之前加载（main.tsx 第一行引入），这样才能统计到所有请求。
type Pend = { b: HTMLElement; t0: number; n: number }
const pends = new Set<Pend>()

const origFetch = window.fetch.bind(window)
window.fetch = (...args: Parameters<typeof fetch>) => {
  const now = Date.now()
  const mine = [...pends].filter((p) => now - p.t0 < 1500)
  mine.forEach((p) => { p.n++ })
  return origFetch(...args).finally(() => { mine.forEach((p) => { p.n-- }) })
}

document.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('button') as HTMLButtonElement | null
  if (!b || b.disabled || b.dataset.nopending !== undefined || b.classList.contains('is-pending')) return
  b.classList.add('is-pending')
  pends.add({ b, t0: Date.now(), n: 0 })
}, true)

setInterval(() => {
  const now = Date.now()
  for (const p of pends) {
    const age = now - p.t0
    if (!p.b.isConnected || (age >= 600 && p.n <= 0) || age >= 60_000) { p.b.classList.remove('is-pending'); pends.delete(p) }
  }
}, 100)
