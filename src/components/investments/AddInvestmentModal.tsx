import { useRef, useState, type FormEvent } from 'react'
import { investmentAssetTypes, type InvestmentAssetType, type InvestmentInstrument, type InvestmentTransaction } from '../../investment/types'
import {
  calculateGrossPaise,
  getTradeCashDeltaPaise,
  previewInvestmentSale,
  QUANTITY_SCALE,
} from '../../investment/investmentCalculations'
import { Button, formatMoney, Icon, Input, MoneyInput } from '../ui'
import { generateId } from '../../utils/uuid'

export type InvestmentFormTrade = Pick<InvestmentTransaction,
  'type' | 'quantityMicros' | 'unitPricePaise' | 'feesPaise' | 'taxesPaise' | 'date' | 'note'
>

export type InvestmentFormInstrument = Pick<InvestmentInstrument, 'type' | 'name' | 'identifier' | 'fixedDeposit'>

export type InvestmentModalResult =
  | { kind: 'trade'; instrument?: InvestmentFormInstrument; transaction: InvestmentFormTrade }
  | { kind: 'valuation'; unitPricePaise: number; asOf: string }
  | { kind: 'instrument'; instrument: InvestmentFormInstrument }

function localDateTime(date = new Date()): string {
  try {
    const adjusted = new Date(date)
    if (Number.isNaN(adjusted.getTime())) return new Date().toISOString().slice(0, 16)
    adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset())
    return adjusted.toISOString().slice(0, 16)
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

function dateOnly(date: Date | string = new Date()): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function formatLocalDateTime(value: string): string {
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return new Date().toISOString()
    return d.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export function AddInvestmentModal({
  mode,
  instrument,
  transaction,
  transactions,
  onClose,
  onSave,
}: {
  mode: 'new' | 'buy' | 'sell' | 'edit' | 'editInstrument' | 'valuation'
  instrument?: InvestmentInstrument
  transaction?: InvestmentTransaction
  transactions: InvestmentTransaction[]
  onClose: () => void
  onSave: (result: InvestmentModalResult) => { ok: true } | { ok: false; error: string }
}) {
  const [type, setType] = useState<InvestmentAssetType>(instrument?.type || 'stocks')
  const [name, setName] = useState(instrument?.name || '')
  const [identifier, setIdentifier] = useState(instrument?.identifier || '')
  const [quantity, setQuantity] = useState(transaction ? String(transaction.quantityMicros / QUANTITY_SCALE) : '1')
  const [unitPricePaise, setUnitPricePaise] = useState(transaction?.unitPricePaise || 0)
  const [feesPaise, setFeesPaise] = useState(transaction?.feesPaise || 0)
  const [taxesPaise, setTaxesPaise] = useState(transaction?.taxesPaise || 0)
  const [date, setDate] = useState(transaction ? localDateTime(new Date(transaction.date)) : localDateTime())
  const [note, setNote] = useState(transaction?.note || '')
  const [valuationDate, setValuationDate] = useState(localDateTime())
  const [principalPaise, setPrincipalPaise] = useState(instrument?.fixedDeposit?.principalPaise || 0)
  const [annualRate, setAnnualRate] = useState(instrument?.fixedDeposit ? String(instrument.fixedDeposit.annualRateBasisPoints / 100) : '')
  const [startDate, setStartDate] = useState(instrument?.fixedDeposit ? dateOnly(instrument.fixedDeposit.startDate) : dateOnly())
  const [maturityDate, setMaturityDate] = useState(instrument?.fixedDeposit ? dateOnly(instrument.fixedDeposit.maturityDate) : '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)

  const title = mode === 'new' ? 'Add investment' : mode === 'valuation' ? 'Update valuation' : mode === 'editInstrument' ? 'Edit investment' : mode === 'edit' ? 'Edit transaction' : mode === 'sell' ? 'Record sale' : 'Record purchase'

  const saleEstimate = mode === 'sell' || (mode === 'edit' && transaction?.type === 'sell')
    ? (() => {
        try {
          if (!instrument) throw new Error('Select an instrument first.')
          const quantityMicros = Math.round(Number(quantity) * QUANTITY_SCALE)
          const sale: InvestmentTransaction = {
            id: generateId(),
            instrumentId: instrument.id,
            type: 'sell',
            quantityMicros,
            unitPricePaise,
            feesPaise,
            taxesPaise,
            date: formatLocalDateTime(date),
            note: note.trim(),
            status: 'active',
            cashMovementIds: [],
          }
          return { ok: true as const, preview: previewInvestmentSale(transactions, sale) }
        } catch (previewError) {
          return { ok: false as const, error: previewError instanceof Error ? previewError.message : 'Sale cannot be completed.' }
        }
      })()
    : undefined

  const purchaseEstimate = mode === 'new' || mode === 'buy' || (mode === 'edit' && transaction?.type === 'buy')
    ? (() => {
        try {
          const quantityMicros = type === 'fixed-deposits' && mode === 'new'
            ? QUANTITY_SCALE
            : Math.round(Number(quantity) * QUANTITY_SCALE)
          const grossPaise = calculateGrossPaise(quantityMicros, unitPricePaise)
          const draft = { type: 'buy' as const, quantityMicros, unitPricePaise, feesPaise, taxesPaise }
          return { grossPaise, cashDebitPaise: -getTradeCashDeltaPaise(draft) }
        } catch {
          return undefined
        }
      })()
    : undefined

  const buildInstrument = (): InvestmentFormInstrument => {
    if (!name.trim()) throw new Error('Enter an instrument name.')
    if (type !== 'fixed-deposits') {
      return { type, name: name.trim(), identifier: identifier.trim() || undefined }
    }
    if (!Number.isSafeInteger(principalPaise) || principalPaise <= 0) throw new Error('Enter a principal greater than zero.')
    if (!Number.isFinite(Number(annualRate)) || Number(annualRate) < 0) throw new Error('Enter a valid annual interest rate.')
    if (!startDate || !maturityDate || maturityDate <= startDate) throw new Error('Maturity date must be after the start date.')
    return {
      type,
      name: name.trim(),
      identifier: identifier.trim() || undefined,
      fixedDeposit: {
        principalPaise,
        annualRateBasisPoints: Math.round(Number(annualRate) * 100),
        startDate,
        maturityDate,
      },
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    setError('')
    try {
      let payload: InvestmentModalResult
      if (mode === 'valuation') {
        if (unitPricePaise <= 0) throw new Error('Enter a valuation greater than zero.')
        payload = { kind: 'valuation', unitPricePaise, asOf: formatLocalDateTime(valuationDate) }
      } else if (mode === 'editInstrument') {
        payload = { kind: 'instrument', instrument: buildInstrument() }
      } else {
        const quantityMicros = type === 'fixed-deposits' && mode === 'new'
          ? QUANTITY_SCALE
          : Math.round(Number(quantity) * QUANTITY_SCALE)
        if (!Number.isSafeInteger(quantityMicros) || quantityMicros <= 0) throw new Error('Enter a valid quantity greater than zero.')
        if (unitPricePaise <= 0) throw new Error('Enter a price greater than zero.')
        const tradeType = mode === 'sell' ? 'sell' : mode === 'edit' ? transaction?.type || 'buy' : 'buy'
        const transactionDate = formatLocalDateTime(date)
        const instrumentDraft = mode === 'new' ? buildInstrument() : undefined
        payload = {
          kind: 'trade',
          instrument: instrumentDraft,
          transaction: {
            type: tradeType,
            quantityMicros,
            unitPricePaise,
            feesPaise,
            taxesPaise,
            date: transactionDate,
            note: note.trim(),
          },
        }
      }
      const result = onSave(payload)
      if (result.ok) onClose()
      else {
        setError(result.error)
        submitting.current = false
        setIsSubmitting(false)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Check the entered values.')
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dialog-layer">
      <section className="dialog investment-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>{title}</h2>
          </div>
          <Button className="icon-button" aria-label="Close" onClick={onClose} disabled={isSubmitting}><Icon name="close" /></Button>
        </header>
        <form onSubmit={submit}>
          {(mode === 'new' || mode === 'editInstrument') && (
            <>
              <label className="investment-field">Asset type
                <select className="input" value={type} onChange={event => setType(event.target.value as InvestmentAssetType)}>
                  {investmentAssetTypes.map(assetType => <option value={assetType} key={assetType}>{assetType.replace('-', ' ').replace(/\b\w/g, char => char.toUpperCase())}</option>)}
                </select>
              </label>
              <label className="investment-field">Name<Input value={name} onChange={event => setName(event.target.value)} placeholder="Instrument name" /></label>
              <label className="investment-field">Ticker or scheme identifier (optional)<Input value={identifier} onChange={event => setIdentifier(event.target.value)} /></label>
            </>
          )}
          {mode !== 'valuation' && mode !== 'editInstrument' && (
            <>
              {type !== 'fixed-deposits' && (
                <label className="investment-field">Quantity / units
                  <Input type="number" min="0.000001" step="0.000001" value={quantity} onChange={event => setQuantity(event.target.value)} />
                </label>
              )}
              <label className="investment-field">{type === 'fixed-deposits' && mode === 'new' ? 'Principal / purchase amount' : 'Unit price'}
                <div className="money-input"><span>₹</span><MoneyInput valuePaise={type === 'fixed-deposits' && mode === 'new' ? principalPaise : unitPricePaise} onChangePaise={value => {
                  if (type === 'fixed-deposits' && mode === 'new') { setPrincipalPaise(value); setUnitPricePaise(value) }
                  else setUnitPricePaise(value)
                }} /></div>
              </label>
              <div className="investment-charge-grid">
                <label className="investment-field">Fees<div className="money-input"><span>₹</span><MoneyInput valuePaise={feesPaise} onChangePaise={setFeesPaise} /></div></label>
                <label className="investment-field">Taxes<div className="money-input"><span>₹</span><MoneyInput valuePaise={taxesPaise} onChangePaise={setTaxesPaise} /></div></label>
              </div>
              <label className="investment-field">Transaction date<Input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label>
              <label className="investment-field">Note (optional)<Input value={note} onChange={event => setNote(event.target.value)} /></label>
            </>
          )}
          {mode === 'valuation' && (
            <>
              <label className="investment-field">Current price per unit<div className="money-input"><span>₹</span><MoneyInput valuePaise={unitPricePaise} onChangePaise={setUnitPricePaise} /></div></label>
              <label className="investment-field">Valuation as of<Input type="datetime-local" value={valuationDate} onChange={event => setValuationDate(event.target.value)} /></label>
              <p className="investment-meta">Manual valuation only. Fixed-deposit interest is not estimated automatically.</p>
            </>
          )}
          {purchaseEstimate && (
            <div className="investment-preview" aria-live="polite">
              <span>Trade amount <strong>{formatMoney(purchaseEstimate.grossPaise)}</strong></span>
              <span>Cash debit <strong>{formatMoney(purchaseEstimate.cashDebitPaise)}</strong></span>
            </div>
          )}
          {saleEstimate && (
            <div className={`investment-preview ${saleEstimate.ok ? '' : 'invalid'}`} aria-live="polite">
              {saleEstimate.ok ? (
                <>
                  <span>Estimated proceeds <strong>{formatMoney(saleEstimate.preview.proceedsPaise)}</strong></span>
                  <span>Estimated realized P/L <strong className={saleEstimate.preview.realizedProfitLossPaise < 0 ? 'red' : 'green'}>{formatMoney(saleEstimate.preview.realizedProfitLossPaise)}</strong></span>
                  <small>FIFO cost basis · charges included</small>
                </>
              ) : <span>{saleEstimate.error}</span>}
            </div>
          )}
          {type === 'fixed-deposits' && (mode === 'new' || mode === 'editInstrument') && (
            <>
              {mode === 'editInstrument' && (
                <label className="investment-field">Principal<div className="money-input"><span>₹</span><MoneyInput valuePaise={principalPaise} onChangePaise={setPrincipalPaise} /></div></label>
              )}
              <label className="investment-field">Annual interest rate (%)<Input type="number" min="0" step="0.01" value={annualRate} onChange={event => setAnnualRate(event.target.value)} /></label>
              <div className="investment-charge-grid">
                <label className="investment-field">Start date<Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
                <label className="investment-field">Maturity date<Input type="date" value={maturityDate} onChange={event => setMaturityDate(event.target.value)} /></label>
              </div>
            </>
          )}
          {error && <p className="error-text investment-error" role="alert">{error}</p>}
          <Button className="primary full" type="submit" disabled={isSubmitting || Boolean(saleEstimate && !saleEstimate.ok)}>{mode === 'valuation' ? 'Save valuation' : mode === 'editInstrument' ? 'Save investment' : mode === 'edit' ? 'Save transaction' : mode === 'sell' ? 'Confirm sale' : 'Confirm purchase'}</Button>
        </form>
      </section>
    </div>
  )
}