// 对账单 PDF（维修师傅 / 清洁公司）：发给对方核对，只含日期、房源、事项、金额和总计。
// 在浏览器里把每页排成 A4 大小的 HTML，再转成 PDF（中文用系统字体，不需要另外装字体）。
export interface PdfRow { date: string; property: string; text: string; amount: number | null }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PER_PAGE = 13
const BRAND = '#0f6b66'
export interface PdfOpts { title?: string; titleEn?: string; party?: string }
let cfg: Required<PdfOpts> = { title: '维修对账单', titleEn: 'Repair Statement', party: '师傅' }

const header = (worker: string, period: string) => `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid ${BRAND}">
    <div style="display:flex;align-items:center;gap:12px">
      <svg width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="12" fill="${BRAND}"/><path d="M11 14l5.5 17L22 19l5.5 12L33 14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><div style="font-size:24px;font-weight:700;letter-spacing:.5px;color:${BRAND}">Wise Stay</div><div style="font-size:11px;color:#7b8794;letter-spacing:2px;margin-top:2px">SYDNEY · PROPERTY MANAGEMENT</div></div>
    </div>
    <div style="text-align:right"><div style="font-size:22px;font-weight:700;color:#1b2430">${cfg.title}</div><div style="font-size:12px;color:#7b8794;margin-top:4px">${cfg.titleEn}</div></div>
  </div>
  <div style="display:flex;gap:40px;margin:22px 0 18px;font-size:13px">
    <div><div style="color:#7b8794;font-size:11px;margin-bottom:3px">${cfg.party}</div><div style="font-weight:600;font-size:15px">${esc(worker)}</div></div>
    <div><div style="color:#7b8794;font-size:11px;margin-bottom:3px">对账期间</div><div style="font-weight:600;font-size:15px">${esc(period)}</div></div>
  </div>`

const th = (t: string, right = false, w = '') => `<th style="text-align:${right ? 'right' : 'left'};padding:10px 12px;font-size:12px;font-weight:600;color:#fff;background:${BRAND};${w}">${t}</th>`

function pageHtml(worker: string, period: string, rows: PdfRow[], first: boolean, last: boolean, total: number, n: number, pageNo: number, pages: number, today: string) {
  const body = rows.map((r, i) => `<tr style="background:${i % 2 ? '#f5f8f8' : '#fff'}">
    <td style="padding:11px 12px;font-size:13px;white-space:nowrap">${esc(r.date)}</td>
    <td style="padding:11px 12px;font-size:13px;word-break:break-all">${esc(r.property)}</td>
    <td style="padding:11px 12px;font-size:13px;line-height:1.45;word-break:break-all;overflow-wrap:anywhere">${esc(r.text)}</td>
    <td style="padding:11px 12px;font-size:13px;text-align:right;white-space:nowrap;font-weight:600">${r.amount == null ? '—' : fmt(r.amount)}</td></tr>`).join('')
  const totalBox = last ? `<div style="display:flex;justify-content:flex-end;margin-top:22px"><div style="min-width:260px;border:2px solid ${BRAND};border-radius:12px;padding:14px 20px;display:flex;justify-content:space-between;align-items:baseline;gap:30px">
      <div><div style="font-size:12px;color:#7b8794">总计（共 ${n} 单）</div><div style="font-size:12px;color:#7b8794;margin-top:2px">Total</div></div>
      <div style="font-size:26px;font-weight:700;color:${BRAND}">${fmt(total)}</div></div></div>` : ''
  return `<div class="pdf-page" style="width:794px;height:1123px;box-sizing:border-box;padding:44px 48px 36px;background:#fff;color:#1b2430;font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',system-ui,sans-serif;position:relative">
    ${first ? header(worker, period) : `<div style="font-size:13px;color:#7b8794;padding-bottom:12px;border-bottom:2px solid ${BRAND};margin-bottom:18px"><b style="color:${BRAND}">Wise Stay</b> · ${cfg.title} · ${esc(worker)} · ${esc(period)}</div>`}
    <table style="width:698px;min-width:0;table-layout:fixed;border-collapse:collapse"><thead><tr>${th('日期', false, 'width:104px;border-radius:8px 0 0 0')}${th('房源', false, 'width:150px')}${th('事项')}${th('金额', true, 'width:120px;border-radius:0 8px 0 0')}</tr></thead><tbody>${body}</tbody></table>
    ${totalBox}
    <div style="position:absolute;left:48px;right:48px;bottom:30px;display:flex;justify-content:space-between;font-size:11px;color:#9aa5b1;border-top:1px solid #e3e8ee;padding-top:10px"><span>Wise Stay · 生成日期 ${today}</span><span>第 ${pageNo} / ${pages} 页</span></div>
  </div>`
}

export async function downloadRepairPdf(worker: string, period: string, rows: PdfRow[], opts: PdfOpts = {}) {
  cfg = { title: '维修对账单', titleEn: 'Repair Statement', party: '师傅', ...opts }
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const total = rows.reduce((a, r) => a + Number(r.amount ?? 0), 0)
  const chunks: PdfRow[][] = []
  const firstCap = PER_PAGE - 2   // 第一页有抬头，放得少一点
  chunks.push(rows.slice(0, firstCap))
  for (let i = firstCap; i < rows.length; i += PER_PAGE + 3) chunks.push(rows.slice(i, i + PER_PAGE + 3))
  // 最后一页要放总计框，放不下就多开一页
  const lastCap = chunks.length === 1 ? firstCap - 3 : PER_PAGE - 2
  if (chunks[chunks.length - 1].length > lastCap) chunks.push([])
  const today = new Date().toLocaleDateString('en-CA')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;pointer-events:none'
  host.innerHTML = chunks.map((c, i) => pageHtml(worker, period, c, i === 0, i === chunks.length - 1, total, rows.length, i + 1, chunks.length, today)).join('')
  document.body.appendChild(host)
  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pages = Array.from(host.querySelectorAll<HTMLElement>('.pdf-page'))
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', width: 794, height: 1123, windowWidth: 1200, scrollX: 0, scrollY: 0 })
      if (i > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297)
    }
    pdf.save(`${cfg.title}_${worker}_${period.replace(/\s/g, '')}.pdf`)
  } finally {
    host.remove()
  }
}
