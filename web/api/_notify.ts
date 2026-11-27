import type { adminClient } from './_lib.js'

const SITE = process.env.SITE_URL || 'https://tianshu-five.vercel.app'

export type NotifyGroup = 'repairman' | 'cleaner' | 'assistant'
export const GROUP_LABEL: Record<NotifyGroup, string> = { repairman: '师傅群', cleaner: '清洁群', assistant: '助理群' }

// 往企业微信群机器人发一条消息（webhook 地址存在 app_settings 里）。
// 没填地址、网络出错都不抛错，只返回结果，绝不影响派单、提交这些主流程。
export async function notifyGroup(db: ReturnType<typeof adminClient>, group: NotifyGroup, title: string, lines: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await db.from('app_settings').select('value').eq('key', `wecom_${group}`).maybeSingle()
    if (error) return { ok: false, error: error.message }
    const url = String(data?.value ?? '').trim()
    if (!url) return { ok: false, error: `没有填写${GROUP_LABEL[group]}的地址` }
    const content = [`**${title}**`, ...lines.filter(Boolean), `[打开天枢](${SITE})`].join('\n')
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'markdown', markdown: { content } }),
      signal: ctl.signal,
    }).finally(() => clearTimeout(t))
    const j = (await r.json().catch(() => ({}))) as { errcode?: number; errmsg?: string }
    if (j.errcode) return { ok: false, error: `企业微信返回：${j.errmsg ?? j.errcode}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '发送失败' }
  }
}
