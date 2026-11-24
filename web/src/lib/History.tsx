import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Log { id: number; table_name: string; row_id: string; label: string | null; action: string; changes: Record<string, { old: unknown; new: unknown }> | null; actor_name: string | null; at: string }

const FIELD: Record<string, string> = {
  login: '登录邮箱', password: '密码', google_password: 'Google 密码', note: '备注', status: '状态', needs_verification: '需验证', platform: '平台',
  reference: '名称', account: '账号', extra: '其他', old_accounts: '老账号', raw: '原表原文',
  name: '房源名称', address: '地址', region: '区域', assistant_id: '主责助理', airbnb_url: 'Airbnb 链接', booking_url: 'Booking 链接', hostaway_id: 'Hostaway ID',
  cleaning_by: '清洁由谁做', commission_rate: '佣金比例', airbnb_account_id: 'Airbnb 账号', booking_account_id: 'Booking 账号',
  bedrooms: '卧室', bathrooms: '卫生间', max_guests: '可住人数', beds: '床', appliances: '家电设施', lock_location: '锁盒位置', lock_code: '锁盒密码',
  wifi_name: 'WiFi 名', wifi_password: 'WiFi 密码', parking: '停车', bin_day: '垃圾日', notes: '备注',
  water: '水', power: '电', gas: '燃气', internet: '网络', recharge_back: '充值回收', end_date: '合同到期', base_status: '基础状态',
}
const TABLE: Record<string, string> = { platform_accounts: '平台账号', company_accounts: '公司账号', property_account_info: '房源账号信息', properties: '房源', property_details: '房源详情', property_contracts: '合同' }

export const fmtAt = (iso: string) => new Date(iso).toLocaleString('zh-CN', { timeZone: 'Australia/Sydney', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const show = (v: unknown) => (v == null || v === '' ? '（空）' : Array.isArray(v) ? v.join('、') || '（空）' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function Item({ l, withLabel }: { l: Log; withLabel?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid #e3ecea', padding: '8px 0' }}>
      <div className="small"><b>{l.actor_name ?? '—'}</b> <span className="muted">{fmtAt(l.at)}（悉尼时间）</span> · {l.action}{withLabel && <> · {TABLE[l.table_name] ?? l.table_name}「{l.label}」</>}</div>
      {l.action === '修改' && l.changes && Object.entries(l.changes).map(([k, v]) => (
        <div key={k} className="small" style={{ paddingLeft: 8 }}>{FIELD[k] ?? k}：<span className="muted">{show(v.old)}</span> → {show(v.new)}</div>
      ))}
      {l.action === '删除' && <div className="small muted" style={{ paddingLeft: 8 }}>已删除的内容：{Object.entries((l.changes ?? {}) as Record<string, unknown>).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${FIELD[k] ?? k}=${show(v)}`).join('；')}</div>}
    </div>
  )
}

// 某一条数据的修改记录。filters：要查的 (表, 行id)
export function HistoryModal({ title, filters, onClose }: { title: string; filters: { table: string; id: string | number }[]; onClose: () => void }) {
  const [logs, setLogs] = useState<Log[] | null>(null)
  useEffect(() => {
    const or = filters.map((f) => `and(table_name.eq.${f.table},row_id.eq.${f.id})`).join(',')
    supabase.from('edit_log').select('*').or(or).order('at', { ascending: false }).limit(200).then(({ data }) => setLogs((data ?? []) as Log[]))
  }, [JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>修改记录 · {title}</h2>
        {logs === null ? <p className="muted">读取中…</p> : !logs.length ? <p className="muted">还没有修改记录（只记录这个功能上线之后的修改）。</p> : logs.map((l) => <Item key={l.id} l={l} />)}
        <div className="btn-row"><button className="ghost" onClick={onClose}>关闭</button></div>
      </div>
    </div>
  )
}

// 全部修改记录（最近 300 条）
export function AllHistory() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  useEffect(() => { supabase.from('edit_log').select('*').order('at', { ascending: false }).limit(300).then(({ data }) => setLogs((data ?? []) as Log[])) }, [])
  if (logs === null) return <p className="muted">读取中…</p>
  if (!logs.length) return <p className="muted pad">还没有修改记录。</p>
  return <div className="card">{logs.map((l) => <Item key={l.id} l={l} withLabel />)}</div>
}
