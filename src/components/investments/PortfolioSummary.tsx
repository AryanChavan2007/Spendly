import { formatMoney } from '../ui'
import type { InvestmentAssetType } from '../../investment/types'

const labels: Record<InvestmentAssetType, string> = {
  stocks: 'Stocks',
  'mutual-funds': 'Mutual funds',
  etfs: 'ETFs',
  gold: 'Gold',
  'fixed-deposits': 'Fixed deposits',
}

export function PortfolioSummary({
  cashPaise,
  currentValuePaise,
  investedPaise,
  holdingsCount,
  realizedPaise,
  allocation,
  currency,
}: {
  cashPaise: number
  currentValuePaise: number
  investedPaise: number
  holdingsCount: number
  realizedPaise: number
  allocation: { type: InvestmentAssetType; valuePaise: number }[]
  currency: string
}) {
  const unrealizedPaise = currentValuePaise - investedPaise
  return (
    <article className="card portfolio-summary">
      <div className="section-title top">
        <div>
          <p className="label">Current portfolio value</p>
          <h2>{formatMoney(currentValuePaise, currency)}</h2>
        </div>
      </div>
      <div className="portfolio-metrics">
        <p><small>Available cash</small><strong>{formatMoney(cashPaise, currency)}</strong></p>
        <p><small>Invested amount</small><strong>{formatMoney(investedPaise, currency)}</strong></p>
        <p><small>Unrealized P/L</small><strong className={unrealizedPaise < 0 ? 'red' : 'green'}>{formatMoney(unrealizedPaise, currency)}</strong></p>
        <p><small>Realized P/L</small><strong className={realizedPaise < 0 ? 'red' : 'green'}>{formatMoney(realizedPaise, currency)}</strong></p>
        <p><small>Holdings</small><strong>{holdingsCount}</strong></p>
      </div>
      <div className="portfolio-allocation">
        <div className="section-title">
          <h2>Allocation</h2>
          <span>By current value</span>
        </div>
        {allocation.length ? allocation.map(item => {
          const share = currentValuePaise > 0 ? Math.round((item.valuePaise / currentValuePaise) * 100) : 0
          return (
            <div className="portfolio-allocation-row" key={item.type}>
              <span>{labels[item.type]}</span>
              <div><i style={{ width: `${share}%` }} /></div>
              <strong>{share}%</strong>
            </div>
          )
        }) : <small className="muted">Add an investment to see allocation.</small>}
      </div>
    </article>
  )
}