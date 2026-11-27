import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import CompanyFunds from './CompanyFunds'
import CleanerBill from './CleanerBill'
import PropertyProfit from './PropertyProfit'

// 公司款项：款项明细 + 清洁公司额外费用的月度账单（账单只有管理员、财务、运营能看）
export default function Funds() {
  const { profile } = useAuth()
  const [qp, setQp] = useSearchParams()
  const canBill = profile?.role === 'admin' || profile?.role === 'finance' || profile?.role === 'ops'
  const t = qp.get('tab')
  const tab = canBill && (t === 'cleaner' || t === 'profit') ? t : 'list'
  return (
    <div>
      {canBill && (
        <div className="pills" style={{ marginBottom: 12 }}>
          <button className={tab === 'list' ? 'pill on' : 'pill'} onClick={() => setQp({})}>款项明细</button>
          <button className={tab === 'cleaner' ? 'pill on' : 'pill'} onClick={() => setQp({ tab: 'cleaner' })}>清洁公司账单</button>
          <button className={tab === 'profit' ? 'pill on' : 'pill'} onClick={() => setQp({ tab: 'profit' })}>房源盈亏</button>
        </div>
      )}
      {tab === 'cleaner' ? <><h1>清洁公司账单</h1><CleanerBill /></> : tab === 'profit' ? <><h1>房源盈亏</h1><PropertyProfit /></> : <CompanyFunds />}
    </div>
  )
}
