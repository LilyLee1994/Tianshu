import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Orders from './Orders'
import RepairSettle from './RepairSettle'

// 维修：从创建、派单、师傅接单、确认费用，到月底和师傅结算，都在这一页
export default function Repairs() {
  const { profile } = useAuth()
  const [qp, setQp] = useSearchParams()
  const canSettle = profile?.role === 'admin' || profile?.role === 'finance' || profile?.role === 'ops'
  const tab = qp.get('tab') === 'settle' && canSettle ? 'settle' : 'list'
  return (
    <div>
      <h1>维修</h1>
      {canSettle && (
        <div className="pills" style={{ marginBottom: 12 }}>
          <button className={tab === 'list' ? 'pill on' : 'pill'} onClick={() => setQp({})}>维修单</button>
          <button className={tab === 'settle' ? 'pill on' : 'pill'} onClick={() => setQp({ tab: 'settle' })}>月度结算</button>
        </div>
      )}
      {tab === 'settle' ? <RepairSettle /> : <Orders scope="repair" />}
    </div>
  )
}
