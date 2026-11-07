import type {
  InvestmentAssetType,
  InvestmentInstrument,
  InvestmentPosition,
  InvestmentTransaction,
  InvestmentValuation,
} from './types'

export const QUANTITY_SCALE = 1_000_000
export type InvestmentTypeFilter = 'all' | InvestmentAssetType

export function filterInvestmentsByType(
  instruments: InvestmentInstrument[],
  type: InvestmentTypeFilter
): InvestmentInstrument[] {
  return type === 'all' ? instruments : instruments.filter(instrument => instrument.type === type)
}

function safeIntegerResult(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} is outside the supported range.`)
  }
  return Number(value)
}

export function calculateGrossPaise(quantityMicros: number, unitPricePaise: number): number {
  if (!Number.isSafeInteger(quantityMicros) || quantityMicros <= 0) {
    throw new RangeError('Quantity must be a positive safe integer in micro-units.')
  }
  if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise <= 0) {
    throw new RangeError('Unit price must be a positive safe integer in paise.')
  }
  const scaled = BigInt(quantityMicros) * BigInt(unitPricePaise)
  return safeIntegerResult((scaled + BigInt(QUANTITY_SCALE / 2)) / BigInt(QUANTITY_SCALE), 'Trade amount')
}

export function getTradeCashDeltaPaise(transaction: Pick<InvestmentTransaction,
  'type' | 'quantityMicros' | 'unitPricePaise' | 'feesPaise' | 'taxesPaise'
>): number {
  const gross = calculateGrossPaise(transaction.quantityMicros, transaction.unitPricePaise)
  if (!Number.isSafeInteger(transaction.feesPaise) || transaction.feesPaise < 0) {
    throw new RangeError('Fees must be a non-negative safe integer in paise.')
  }
  if (!Number.isSafeInteger(transaction.taxesPaise) || transaction.taxesPaise < 0) {
    throw new RangeError('Taxes must be a non-negative safe integer in paise.')
  }
  const charges = transaction.feesPaise + transaction.taxesPaise
  if (!Number.isSafeInteger(charges)) throw new RangeError('Trade charges are outside the supported range.')
  if (transaction.type === 'buy') {
    const total = gross + charges
    if (!Number.isSafeInteger(total)) throw new RangeError('Purchase total is outside the supported range.')
    return -total
  }
  const proceeds = gross - charges
  if (!Number.isSafeInteger(proceeds) || proceeds <= 0) {
    throw new RangeError('Sale proceeds after fees and taxes must be greater than zero.')
  }
  return proceeds
}

type Lot = { quantityMicros: number; costBasisPaise: number }

function proportionalPaise(amountPaise: number, quantity: number, totalQuantity: number): number {
  const numerator = BigInt(amountPaise) * BigInt(quantity)
  return safeIntegerResult((numerator + BigInt(Math.floor(totalQuantity / 2))) / BigInt(totalQuantity), 'Cost basis')
}

export function calculateInvestmentPositions(
  transactions: InvestmentTransaction[]
): Map<string, InvestmentPosition> {
  const positions = new Map<string, InvestmentPosition>()
  const lotsByInstrument = new Map<string, Lot[]>()
  const ordered = transactions
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ transaction }) => transaction.status === 'active')
    .sort((a, b) => a.transaction.date.localeCompare(b.transaction.date) || a.index - b.index)

  for (const { transaction } of ordered) {
    const gross = calculateGrossPaise(transaction.quantityMicros, transaction.unitPricePaise)
    const cashDelta = getTradeCashDeltaPaise(transaction)
    const position = positions.get(transaction.instrumentId) || {
      instrumentId: transaction.instrumentId,
      quantityMicros: 0,
      costBasisPaise: 0,
      realizedProfitLossPaise: 0,
    }
    const lots = lotsByInstrument.get(transaction.instrumentId) || []

    if (transaction.type === 'buy') {
      const costBasisPaise = gross + transaction.feesPaise + transaction.taxesPaise
      if (!Number.isSafeInteger(costBasisPaise)) throw new RangeError('Cost basis is outside the supported range.')
      lots.push({ quantityMicros: transaction.quantityMicros, costBasisPaise })
      position.quantityMicros += transaction.quantityMicros
      position.costBasisPaise += costBasisPaise
    } else {
      let quantityToSell = transaction.quantityMicros
      let basisRemoved = 0
      while (quantityToSell > 0 && lots.length > 0) {
        const lot = lots[0]
        const consumed = Math.min(quantityToSell, lot.quantityMicros)
        const lotBasis = consumed === lot.quantityMicros
          ? lot.costBasisPaise
          : proportionalPaise(lot.costBasisPaise, consumed, lot.quantityMicros)
        basisRemoved += lotBasis
        lot.quantityMicros -= consumed
        lot.costBasisPaise -= lotBasis
        quantityToSell -= consumed
        if (lot.quantityMicros === 0) lots.shift()
      }
      if (quantityToSell > 0) {
        throw new RangeError(`Sale '${transaction.id}' exceeds available units for '${transaction.instrumentId}'.`)
      }
      position.quantityMicros -= transaction.quantityMicros
      position.costBasisPaise -= basisRemoved
      position.realizedProfitLossPaise += cashDelta - basisRemoved
    }

    if (!Number.isSafeInteger(position.quantityMicros) || !Number.isSafeInteger(position.costBasisPaise)) {
      throw new RangeError('Investment position is outside the supported range.')
    }
    positions.set(transaction.instrumentId, position)
    lotsByInstrument.set(transaction.instrumentId, lots)
  }
  return positions
}

export function calculateCurrentValuePaise(quantityMicros: number, unitPricePaise: number): number {
  return calculateGrossPaise(quantityMicros, unitPricePaise)
}

export function calculatePortfolioValuePaise(
  transactions: InvestmentTransaction[],
  valuations: InvestmentValuation[]
): number {
  const positions = calculateInvestmentPositions(transactions)
  const latestByInstrument = new Map<string, InvestmentValuation>()
  for (const valuation of valuations) {
    const previous = latestByInstrument.get(valuation.instrumentId)
    if (!previous || valuation.asOf > previous.asOf ||
      (valuation.asOf === previous.asOf && valuation.recordedAt > previous.recordedAt)) {
      latestByInstrument.set(valuation.instrumentId, valuation)
    }
  }
  let total = 0
  for (const position of positions.values()) {
    if (position.quantityMicros === 0) continue
    const valuation = latestByInstrument.get(position.instrumentId)
    if (valuation) total += calculateCurrentValuePaise(position.quantityMicros, valuation.unitPricePaise)
  }
  if (!Number.isSafeInteger(total)) throw new RangeError('Portfolio value is outside the supported range.')
  return total
}

export type InvestmentSalePreview = {
  grossPaise: number
  chargesPaise: number
  proceedsPaise: number
  realizedProfitLossPaise: number
}

export function previewInvestmentSale(
  transactions: InvestmentTransaction[],
  sale: InvestmentTransaction
): InvestmentSalePreview {
  if (sale.type !== 'sell' || sale.status !== 'active') throw new RangeError('Sale preview requires an active sale.')
  if (transactions.some(transaction => transaction.id === sale.id)) throw new RangeError('Sale preview ID must be unique.')
  const before = calculateInvestmentPositions(transactions).get(sale.instrumentId)?.realizedProfitLossPaise || 0
  const after = calculateInvestmentPositions([...transactions, sale]).get(sale.instrumentId)
  if (!after) throw new RangeError('Sale preview did not produce an investment position.')
  const grossPaise = calculateGrossPaise(sale.quantityMicros, sale.unitPricePaise)
  const proceedsPaise = getTradeCashDeltaPaise(sale)
  return {
    grossPaise,
    chargesPaise: sale.feesPaise + sale.taxesPaise,
    proceedsPaise,
    realizedProfitLossPaise: after.realizedProfitLossPaise - before,
  }
}