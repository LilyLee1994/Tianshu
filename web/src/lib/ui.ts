export const chipOf = (status: string) => {
  if (status === '已取消') return 'chip gray'
  if (['待派单', '待通知房东', '调拨中', '待登记合同', '筹备中', '待提交'].includes(status)) return 'chip amber'
  if (['待确认费用', '房东已完成'].includes(status)) return 'chip purple'
  if (['已完成', '已赔付', '客人直接赔付', '在库', '运营中', '可上线', '已登记'].includes(status)) return 'chip green'
  return 'chip blue'
}
export const today = () => new Date().toISOString().slice(0, 10)
export const money = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : `$${n.toFixed(2).replace(/\.00$/, '')}`
}
