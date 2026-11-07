import { investmentAssetTypes, type InvestmentInstrument, type InvestmentTransaction } from './types'
import { calculateGrossPaise, getTradeCashDeltaPaise } from './investmentCalculations'

export function validateInstrument(instrument: InvestmentInstrument): string | null {
  if (!instrument || typeof instrument !== 'object') return 'Instrument must be an object.'
  if (typeof instrument.id !== 'string' || !instrument.id.trim()) return 'Instrument ID is required.'
  if (typeof instrument.type !== 'string' || !investmentAssetTypes.includes(instrument.type as InvestmentInstrument['type'])) {
    return 'Choose a supported asset type.'
  }
  if (typeof instrument.name !== 'string' || !instrument.name.trim()) return 'Instrument name is required.'
  if (instrument.identifier !== undefined && typeof instrument.identifier !== 'string') {
    return 'Instrument identifier must be text.'
  }
  if (instrument.type === 'fixed-deposits') {
    const terms = instrument.fixedDeposit
    if (!terms || typeof terms !== 'object') return 'Fixed deposit terms are required.'
    if (!Number.isSafeInteger(terms.principalPaise) || terms.principalPaise <= 0) {
      return 'Fixed deposit principal must be a positive amount.'
    }
    if (!Number.isSafeInteger(terms.annualRateBasisPoints) || terms.annualRateBasisPoints < 0) {
      return 'Fixed deposit interest rate is invalid.'
    }
    if (!isValidDate(terms.startDate) || !isValidDate(terms.maturityDate) || terms.maturityDate <= terms.startDate) {
      return 'Fixed deposit dates are invalid.'
    }
  } else if (instrument.fixedDeposit !== undefined) {
    return 'Fixed deposit terms are only valid for fixed deposits.'
  }
  if (!isValidDate(instrument.createdAt)) return 'Instrument creation date is invalid.'
  return null
}

export function validateInvestmentTransaction(transaction: InvestmentTransaction): string | null {
  if (!transaction || typeof transaction !== 'object') return 'Transaction must be an object.'
  if (typeof transaction.id !== 'string' || !transaction.id.trim()) return 'Transaction ID is required.'
  if (typeof transaction.instrumentId !== 'string' || !transaction.instrumentId.trim()) return 'Instrument reference is required.'
  if (transaction.type !== 'buy' && transaction.type !== 'sell') return 'Transaction type is invalid.'
  if (transaction.status !== 'active' && transaction.status !== 'voided') return 'Transaction status is invalid.'
  if (!Number.isSafeInteger(transaction.quantityMicros) || transaction.quantityMicros <= 0) {
    return 'Quantity must be greater than zero.'
  }
  if (!Number.isSafeInteger(transaction.unitPricePaise) || transaction.unitPricePaise <= 0) {
    return 'Unit price must be greater than zero.'
  }
  if (!Number.isSafeInteger(transaction.feesPaise) || transaction.feesPaise < 0) {
    return 'Fees must be a non-negative amount.'
  }
  if (!Number.isSafeInteger(transaction.taxesPaise) || transaction.taxesPaise < 0) {
    return 'Taxes must be a non-negative amount.'
  }
  if (typeof transaction.note !== 'string' || !Array.isArray(transaction.cashMovementIds) ||
    transaction.cashMovementIds.some(id => typeof id !== 'string' || !id.trim())) {
    return 'Transaction details are invalid.'
  }
  if (!isValidDate(transaction.date)) return 'Transaction date is invalid.'
  try {
    calculateGrossPaise(transaction.quantityMicros, transaction.unitPricePaise)
    getTradeCashDeltaPaise(transaction)
  } catch (error) {
    return error instanceof Error ? error.message : 'Transaction amount is invalid.'
  }
  return null
}

export function isValidDate(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0 || Number.isNaN(Date.parse(value))) return false
  const datePart = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value)?.[1]
  if (!datePart) return false
  return new Date(`${datePart}T00:00:00.000Z`).toISOString().slice(0, 10) === datePart
}