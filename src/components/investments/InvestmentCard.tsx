import { Button, formatMoney } from '../ui'
import { Pencil, Trash2 } from 'lucide-react'
import { getTradeCashDeltaPaise } from '../../investment/investmentCalculations'
import type { InvestmentInstrument, InvestmentPosition, InvestmentTransaction, InvestmentValuation } from '../../investment/types'

const typeLabels: Record<InvestmentInstrument['type'], string> = {
  stocks: 'Stock',
  'mutual-funds': 'Mutual fund',
  etfs: 'ETF',
  gold: 'Gold',
  'fixed-deposits': 'Fixed deposit',
}

function formatQuantity(quantityMicros: number): string {
  return (quantityMicros / 1_000_000).toFixed(6).replace(/\.?0+$/, '')
}

function safeDate(value: string | Date): string {
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : 'N/A'
    return d.toLocaleDateString('en-IN')
  } catch {
    return typeof value === 'string' ? value : 'N/A'
  }
}

function safeDateTime(value: string | Date): string {
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : 'N/A'
    return d.toLocaleString('en-IN')
  } catch {
    return typeof value === 'string' ? value : 'N/A'
  }
}

export function InvestmentCard({
  instrument,
  position,
  valuePaise,
  valuation,
  transactions,
  currency,
  onTrade,
  onValuation,
  onEditTransaction,
  onDeleteTransaction,
  onEditInstrument,
  onDeleteInstrument,
}: {
  instrument: InvestmentInstrument
  position?: InvestmentPosition
  valuePaise?: number
  valuation?: InvestmentValuation
  transactions: InvestmentTransaction[]
  currency: string
  onTrade: (type: 'buy' | 'sell') => void
  onValuation: () => void
  onEditTransaction: (transaction: InvestmentTransaction) => void
  onDeleteTransaction: (transaction: InvestmentTransaction) => void
  onEditInstrument: () => void
  onDeleteInstrument: () => void
}) {
  const unrealized = valuePaise === undefined || !position ? undefined : valuePaise - position.costBasisPaise
  return (
    <article className="card investment-card">
      <div className="investment-card-head">
        <div>
          <small>{typeLabels[instrument.type]}{instrument.identifier ? ` · ${instrument.identifier}` : ''}</small>
          <h2>{instrument.name}</h2>
        </div>
        <div className="investment-card-controls">
          <strong className="investment-current-value">
            {valuePaise === undefined ? 'No valuation' : formatMoney(valuePaise, currency)}
          </strong>
          <Button className="icon-button" aria-label={`Edit investment ${instrument.name}`} onClick={onEditInstrument}>
            <Pencil size={15} />
          </Button>
          {transactions.length === 0 && (
            <Button className="icon-button" aria-label={`Delete investment ${instrument.name}`} onClick={onDeleteInstrument}>
              <Trash2 size={15} />
            </Button>
          )}
        </div>
      </div>
      {instrument.fixedDeposit && (
        <p className="investment-meta">
          Principal {formatMoney(instrument.fixedDeposit.principalPaise, currency)} · {(instrument.fixedDeposit.annualRateBasisPoints / 100).toFixed(2)}% p.a. · Matures {safeDate(instrument.fixedDeposit.maturityDate)}
        </p>
      )}
      <div className="investment-position-row">
        <span>{formatQuantity(position?.quantityMicros || 0)} units</span>
        <span>Invested {formatMoney(position?.costBasisPaise || 0, currency)}</span>
        {unrealized !== undefined && <strong className={unrealized < 0 ? 'red' : 'green'}>Unrealized {formatMoney(unrealized, currency)}</strong>}
      </div>
      <p className="investment-meta">
        {valuation
          ? `${valuation.source === 'transaction' ? 'Purchase price' : 'Manual valuation'} · updated ${safeDateTime(valuation.recordedAt)} · as of ${safeDateTime(valuation.asOf)}`
          : 'No valuation recorded'}
      </p>
      <div className="row investment-actions">
        <Button className="primary" onClick={() => onTrade('buy')}>Buy</Button>
        <Button className="secondary" onClick={() => onTrade('sell')} disabled={!position?.quantityMicros}>Sell</Button>
        <Button className="secondary" onClick={onValuation}>Update value</Button>
      </div>
      {transactions.length > 0 && (
        <details className="investment-history">
          <summary>Transaction history · {transactions.length}</summary>
          {transactions.map(transaction => (
            <div className={`investment-transaction ${transaction.status === 'voided' ? 'voided' : ''}`} key={transaction.id}>
              <div>
                <strong>{transaction.status === 'voided' ? 'Voided' : transaction.type === 'buy' ? 'Purchase' : 'Sale'}</strong>
                <small>{safeDate(transaction.date)} · {formatQuantity(transaction.quantityMicros)} units · {formatMoney(transaction.unitPricePaise, currency)} / unit</small>
                <small>Fees {formatMoney(transaction.feesPaise, currency)} · Taxes {formatMoney(transaction.taxesPaise, currency)}</small>
              </div>
              <div className="investment-transaction-actions">
                <strong>
                  {transaction.type === 'buy' ? 'Cash out' : 'Net proceeds'}{' '}
                  {formatMoney(
                    (() => {
                      try {
                        return Math.abs(getTradeCashDeltaPaise(transaction))
                      } catch {
                        return Math.round((transaction.quantityMicros * transaction.unitPricePaise) / 1_000_000)
                      }
                    })(),
                    currency
                  )}
                </strong>
                {transaction.status === 'active' && (
                  <>
                    <Button className="icon-button" aria-label={`Edit ${transaction.type} ${instrument.name}`} onClick={() => onEditTransaction(transaction)}><Pencil size={15} /></Button>
                    <Button className="icon-button" aria-label={`Delete ${transaction.type} ${instrument.name}`} onClick={() => onDeleteTransaction(transaction)}><Trash2 size={15} /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </details>
      )}
    </article>
  )
}