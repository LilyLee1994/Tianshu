import { useState } from 'react'

// 小图标复制按钮：点一下复制，图标变成对勾
export default function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" className="copy-ico" title={ok ? '已复制' : '复制'} aria-label="复制"
      onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200) }}>
      {ok
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1f6b34" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>}
    </button>
  )
}

// 值 + 复制图标，保持在同一行
export function CopyVal({ v }: { v: string | null | undefined }) {
  return v ? <span style={{ whiteSpace: 'nowrap' }}>{v}<Copy text={v} /></span> : <span className="muted">—</span>
}
