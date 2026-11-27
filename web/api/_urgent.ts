import type { adminClient } from './_lib.js'

// 清洁单为什么“紧急”：同一套房在退房当天或次日有新客人入住。算出来写明白，给清洁端显示。
// 助理手动标的紧急（没有对应订单）写“助理标记为紧急”。
const DEAD = /cancel|inquiry|declin|expire|denied/i
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10)
const md = (d: string) => d.slice(5)

export interface Urgency { label: string; text: string }

export async function urgencyOf(
  db: ReturnType<typeof adminClient>,
  orders: { id: number; property_id: number; type: string; urgent: boolean; planned_date: string | null; reservation_id?: number | null }[],
): Promise<Record<number, Urgency>> {
  const out: Record<number, Urgency> = {}
  const urgent = orders.filter((o) => o.urgent)
  if (!urgent.length) return out
  const dated = urgent.filter((o) => o.type === '清洁' && o.planned_date)
  let arr: { id: number; property_id: number; arrival_date: string; status: string | null }[] = []
  if (dated.length) {
    const dates = dated.map((o) => o.planned_date as string).sort()
    const { data } = await db.from('reservations').select('id, property_id, arrival_date, status')
      .in('property_id', [...new Set(dated.map((o) => o.property_id))]).gte('arrival_date', dates[0]).lte('arrival_date', addDays(dates[dates.length - 1], 1))
    arr = (data ?? []) as typeof arr
  }
  for (const o of urgent) {
    const dep = o.planned_date
    const next = dep ? arr.filter((a) => a.property_id === o.property_id && a.id !== Number(o.reservation_id) && !DEAD.test(a.status ?? '') && a.arrival_date >= dep && a.arrival_date <= addDays(dep, 1))
      .sort((a, b) => a.arrival_date.localeCompare(b.arrival_date))[0] : undefined
    if (next) {
      const same = next.arrival_date === dep
      out[o.id] = same
        ? { label: '当天入住', text: `紧急：今天退房后，当天（${md(next.arrival_date)}）就有新客人入住，必须在入住前清洁完。` }
        : { label: '次日入住', text: `紧急：退房后第二天（${md(next.arrival_date)}）有新客人入住，请优先安排。` }
    } else out[o.id] = { label: '助理标记', text: '紧急：助理标记了这张单需要优先处理。' }
  }
  return out
}
