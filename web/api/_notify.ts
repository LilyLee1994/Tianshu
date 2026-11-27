import type { adminClient } from './_lib.js'

const SITE = process.env.SITE_URL || 'https://tianshu-five.vercel.app'

// 给某个人发微信通知（通过 PushPlus）。没填 token、网络出错都静默跳过，绝不影响派单、提交这些主流程。
export async function notifyUser(db: ReturnType<typeof adminClient>, userId: string | null | undefined, title: string, content: string): Promise<void> {
  if (!userId) return
  try {
    const { data: p, error } = await db.from('profiles').select('wechat_token, active').eq('id', userId).maybeSingle()
    if (error || !p?.wechat_token || !p.active) return
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: p.wechat_token, title, content: `${content}<br><br><a href="${SITE}">打开天枢</a>`, template: 'html' }),
      signal: ctl.signal,
    }).finally(() => clearTimeout(t))
  } catch { /* 通知失败不影响主流程 */ }
}
