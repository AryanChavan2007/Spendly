import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { AddInvestmentModal, type InvestmentModalResult } from '../components/investments/AddInvestmentModal'
import { InvestmentCard } from '../components/investments/InvestmentCard'
import { PortfolioSummary } from '../components/investments/PortfolioSummary'
import { Button, formatMoney, Title } from '../components/ui'
import { useExpenses, type InvestmentActionResult } from '../data/ExpenseStore'
import {
  calculateInvestmentPositions,
  calculatePortfolioValuePaise,
  filterInvestmentsByType,
  type InvestmentTypeFilter,
} from '../investment/investmentCalculations'
import { manualPriceProvider } from '../investment/investmentPrices'
import { investmentAssetTypes, type InvestmentInstrument, type InvestmentTransaction } from '../investment/types'
import { generateId } from '../utils/uuid'

type ModalState = {
  mode: 'new' | 'buy' | 'sell' | 'edit' | 'editInstrument' | 'valuation'
  instrument?: InvestmentInstrument
  transaction?: InvestmentTransaction
}

const investmentTypeLabels: Record<InvestmentTypeFilter, string> = {
  all: 'All',
  stocks: 'Stocks',
  'mutual-funds': 'Mutual Funds',
  etfs: 'ETFs',
  gold: 'Gold',
  'fixed-deposits': 'Fixed Deposits',
}

function latestValuations(instruments: InvestmentInstrument[], valuations: ReturnType<typeof useExpenses>['investmentValuations']) {
  const latest = new Map<string, (typeof valuations)[number]>()
  for (const valuation of valuations) {
    const previous = latest.get(valuation.instrumentId)
    if (!previous || valuation.asOf > previous.asOf || (valuation.asOf === previous.asOf && valuation.recordedAt > previous.recordedAt)) {
      latest.set(valuation.instrumentId, valuation)
    }
  }
  return instruments.map(instrument => ({ instrument, valuation: latest.get(instrument.id) }))
}

export function Investments({ onBack }: { onBack: () => void }) {
  const {
    assets,
    settings,
    investmentInstruments,
    investmentTransactions,
    investmentValuations,
    deletedInvestmentTransaction,
    addInvestmentTrade,
    addInvestmentWithTrade,
    updateInvestmentTrade,
    removeInvestmentTrade,
    undoInvestmentTrade,
    addInvestmentValuation,
    updateInvestmentInstrument,
    removeInvestmentInstrument,
  } = useExpenses()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [notice, setNotice] = useState('')
  const [typeFilter, setTypeFilter] = useState<InvestmentTypeFilter>('all')
  const positions = calculateInvestmentPositions(investmentTransactions)
  const portfolioValuePaise = calculatePortfolioValuePaise(investmentTransactions, investmentValuations)
  const currentCostBasisPaise = [...positions.values()].reduce((sum, position) => sum + position.costBasisPaise, 0)
  const holdingsCount = [...positions.values()].filter(position => position.quantityMicros > 0).length
  const realizedPaise = [...positions.values()].reduce((sum, position) => sum + position.realizedProfitLossPaise, 0)
  const currentByInstrument = latestValuations(investmentInstruments, investmentValuations)
  const filteredInstruments = filterInvestmentsByType(investmentInstruments, typeFilter)
  const filteredIds = new Set(filteredInstruments.map(instrument => instrument.id))
  const filteredHoldings = currentByInstrument.filter(({ instrument }) => filteredIds.has(instrument.id))
  const allocation = currentByInstrument.reduce((items, { instrument, valuation }) => {
    const position = positions.get(instrument.id)
    if (!position || position.quantityMicros === 0 || !valuation) return items
    const valuePaise = Math.round(position.quantityMicros * valuation.unitPricePaise / 1_000_000)
    const existing = items.find(item => item.type === instrument.type)
    if (existing) existing.valuePaise += valuePaise
    else items.push({ type: instrument.type, valuePaise })
    return items
  }, [] as { type: InvestmentInstrument['type']; valuePaise: number }[])

  const handleSave = (result: InvestmentModalResult, current?: ModalState): InvestmentActionResult => {
    if (result.kind === 'valuation') {
      if (!current?.instrument) return { ok: false, error: 'Select an instrument first.' }
      return addInvestmentValuation(manualPriceProvider.createValuation({
        id: generateId(),
        instrumentId: current.instrument.id,
        unitPricePaise: result.unitPricePaise,
        asOf: result.asOf,
        recordedAt: new Date().toISOString(),
      }))
    }

    if (result.kind === 'instrument') {
      if (!current?.instrument) return { ok: false, error: 'Select an instrument first.' }
      return updateInvestmentInstrument({
        ...result.instrument,
        id: current.instrument.id,
        createdAt: current.instrument.createdAt,
      })
    }

    const instrument = current?.instrument
    const instrumentId = instrument?.id || generateId()
    const transaction: Omit<InvestmentTransaction, 'cashMovementIds'> = {
      id: current?.transaction?.id || generateId(),
      instrumentId,
      ...result.transaction,
      status: 'active',
    }
    if (result.instrument) {
      const newInstrument: InvestmentInstrument = {
        ...result.instrument,
        id: instrumentId,
        createdAt: new Date().toISOString(),
      }
      return addInvestmentWithTrade(newInstrument, transaction)
    }
    if (current?.transaction) return updateInvestmentTrade(transaction)
    return addInvestmentTrade(transaction)
  }

  const handleDelete = (transaction: InvestmentTransaction) => {
    const result = removeInvestmentTrade(transaction.id)
    setNotice(result.ok ? 'Transaction voided' : result.error)
  }

  const handleDeleteInstrument = (instrument: InvestmentInstrument) => {
    const result = removeInvestmentInstrument(instrument.id)
    setNotice(result.ok ? 'Investment deleted' : result.error)
  }

  return (
    <div className="page grow-page investments-page">
      <header className="page-header compact">
        <Button className="icon-button" aria-label="Back to Grow" onClick={onBack}><ArrowLeft size={19} /></Button>
        <div className="investments-heading"><p className="eyebrow">Linked to cash</p><Title>Investments</Title></div>
        <Button className="primary investment-add" aria-label="Add investment" onClick={() => setModal({ mode: 'new' })}><Plus size={18} /></Button>
      </header>
      <p className="investment-account-note">Buys reduce Cash in hand; sales return net proceeds. Investments tracked here must be excluded from Other assets.</p>
      <PortfolioSummary
        cashPaise={assets.cashInHand}
        currentValuePaise={portfolioValuePaise}
        investedPaise={currentCostBasisPaise}
        holdingsCount={holdingsCount}
        realizedPaise={realizedPaise}
        allocation={allocation}
        currency={settings.currency}
      />
      <div className="section-title"><h2>Holdings</h2><span>{holdingsCount} active</span></div>
      <div className="investment-type-filters" role="group" aria-label="Filter holdings by asset type">
        <Button className={typeFilter === 'all' ? 'active' : ''} aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Button>
        {investmentAssetTypes.map(type => (
          <Button key={type} className={typeFilter === type ? 'active' : ''} aria-pressed={typeFilter === type} onClick={() => setTypeFilter(type)}>
            {investmentTypeLabels[type]}
          </Button>
        ))}
      </div>
      {filteredHoldings.length ? filteredHoldings.map(({ instrument, valuation }) => {
        const position = positions.get(instrument.id)
        const currentValue = position && valuation
          ? Math.round(position.quantityMicros * valuation.unitPricePaise / 1_000_000)
          : undefined
        const transactions = investmentTransactions
          .filter(transaction => transaction.instrumentId === instrument.id)
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
        return (
          <InvestmentCard
            key={instrument.id}
            instrument={instrument}
            position={position}
            valuePaise={currentValue}
            valuation={valuation}
            transactions={transactions}
            currency={settings.currency}
            onTrade={type => setModal({ mode: type, instrument })}
            onValuation={() => setModal({ mode: 'valuation', instrument })}
            onEditTransaction={transaction => setModal({ mode: 'edit', instrument, transaction })}
            onDeleteTransaction={handleDelete}
            onEditInstrument={() => setModal({ mode: 'editInstrument', instrument })}
            onDeleteInstrument={() => handleDeleteInstrument(instrument)}
          />
        )
      }) : investmentInstruments.length ? (
        <div className="empty investment-empty">
          <strong>No {typeFilter.replace('-', ' ')} holdings</strong>
          <p>Choose another asset type to view its holdings.</p>
        </div>
      ) : (
        <div className="empty investment-empty">
          <strong>No investments yet</strong>
          <p>Add a holding to start recording purchases, valuations, and sales.</p>
          <Button className="secondary" onClick={() => setModal({ mode: 'new' })}>Add investment</Button>
        </div>
      )}
      {deletedInvestmentTransaction && (
        <div className="snackbar">
          <span>{notice || 'Transaction voided'}</span>
          <Button onClick={() => {
            const result = undoInvestmentTrade()
            setNotice(result.ok ? '' : result.error)
          }}>Undo</Button>
        </div>
      )}
      {notice && !deletedInvestmentTransaction && <p className="investment-notice" role="status">{notice}</p>}
      {modal && (
        <AddInvestmentModal
          mode={modal.mode}
          instrument={modal.instrument}
          transaction={modal.transaction}
          transactions={investmentTransactions}
          onClose={() => setModal(null)}
          onSave={result => handleSave(result, modal)}
        />
      )}
    </div>
  )
}