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

// 工单描述里系统自动加的“【索赔#17】”标记只是内部用来防重复，显示时去掉
export const cleanDesc = (d: string | null | undefined) => (d ?? '').replace(/^【索赔#\d+】/, '')

// 搜索匹配：英文/数字按“词的开头”匹配（输入 ar 能找到 Arcadia，不会匹配到 Bardia 中间的 ar）；中文按包含匹配；多个词用空格隔开，要全部命中
export const matchQ = (text: string | null | undefined, q: string) => {
  const hay = (text ?? '').toLowerCase()
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean).every((t) =>
    /[^\x00-\x7f]/.test(t) ? hay.includes(t) : new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay))
}
