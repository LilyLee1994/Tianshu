import { useSyncExternalStore } from 'react'
import { callApi } from './api'

// 同步任务放在页面之外的全局状态里：切换页面、回到总览，进度文字都还在
interface S { running: boolean; msg: string }
let state: S = { running: false, msg: '' }
const subs = new Set<() => void>()
const set = (p: Partial<S>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }

export const useSync = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)

export async function startSync(onDone?: () => void) {
  if (state.running) return
  set({ running: true, msg: '开始同步…' })
  let fails = 0
  let last = ''
  for (let i = 0; i < 40; i++) {
    set({ msg: `第 ${i + 1} 轮进行中（每轮约 40 秒）。${last}` })
    const [r, e] = await callApi<{ done: boolean; phase?: string; calOffset?: number; resOffset?: number; revOffset?: number; total?: number; summary?: Record<string, unknown> }>('cron-hostaway', {})
    if (e || !r) {
      if (++fails >= 4) { set({ msg: `同步失败：${e}。可以稍后再点一次，会接着上次的进度做。` }); break }
      set({ msg: `这一轮出错（${e}），自动重试第 ${fails} 次…` }); continue
    }
    fails = 0
    if (r.done) { set({ msg: `同步完成：${JSON.stringify(r.summary)}` }); break }
    const names: Record<string, string> = { reservations: `订单（已拉 ${r.resOffset} 条）`, cleaning: '生成清洁单', reviews: `评价（已拉 ${r.revOffset} 条）`, calendar: `日历价格 ${r.calOffset}/${r.total}` }
    last = `上一轮结束时：${names[r.phase ?? ''] ?? r.phase}`
    set({ msg: `第 ${i + 1} 轮完成。${last}` })
  }
  set({ running: false })
  onDone?.()
}
