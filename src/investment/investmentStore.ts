import type { Assets } from '../data/types'
import { calculateInvestmentPositions, getTradeCashDeltaPaise } from './investmentCalculations'
import { validateInstrument, validateInvestmentTransaction, isValidDate } from './investmentValidation'
import type {
  InvestmentCashMovement,
  InvestmentInstrument,
  InvestmentTransaction,
  InvestmentValuation,
} from './types'

export type InvestmentState = {
  assets: Assets
  investmentInstruments: InvestmentInstrument[]
  investmentTransactions: InvestmentTransaction[]
  investmentCashMovements: InvestmentCashMovement[]
  investmentValuations: InvestmentValuation[]
}

export type InvestmentResult = { ok: true; state: InvestmentState } | { ok: false; error: string }

function success(state: InvestmentState): InvestmentResult {
  return { ok: true, state }
}

function failure(error: string): InvestmentResult {
  return { ok: false, error }
}

function movementSum(state: InvestmentState, transactionId: string): number {
  return state.investmentCashMovements
    .filter(movement => movement.transactionId === transactionId)
    .reduce((sum, movement) => sum + movement.deltaPaise, 0)
}

function addMovement(
  state: InvestmentState,
  transaction: InvestmentTransaction,
  movementId: string,
  deltaPaise: number,
  reason: InvestmentCashMovement['reason'],
  date: string
): InvestmentResult {
  if (!movementId.trim() || state.investmentCashMovements.some(movement => movement.id === movementId)) {
    return failure('Cash movement ID must be unique.')
  }
  const cashInHand = state.assets.cashInHand + deltaPaise
  if (!Number.isSafeInteger(cashInHand)) return failure('Cash amount is invalid.')
  const movement: InvestmentCashMovement = {
    id: movementId,
    transactionId: transaction.id,
    deltaPaise,
    reason,
    date,
  }
  return success({
    ...state,
    assets: { ...state.assets, cashInHand },
    investmentCashMovements: [...state.investmentCashMovements, movement],
  })
}

export function addInvestmentInstrument(
  state: InvestmentState,
  instrument: InvestmentInstrument
): InvestmentResult {
  const validationError = validateInstrument(instrument)
  if (validationError) return failure(validationError)
  if (state.investmentInstruments.some(item => item.id === instrument.id)) return failure('Instrument ID already exists.')
  return success({ ...state, investmentInstruments: [...state.investmentInstruments, instrument] })
}

export function addInvestmentWithTrade(
  state: InvestmentState,
  instrument: InvestmentInstrument,
  transaction: InvestmentTransaction,
  movementId: string
): InvestmentResult {
  const instrumentError = validateInstrument(instrument)
  if (instrumentError) return failure(instrumentError)
  if (state.investmentInstruments.some(item => item.id === instrument.id)) return failure('Instrument ID already exists.')
  if (transaction.instrumentId !== instrument.id || transaction.type !== 'buy') {
    return failure('A new instrument must start with a purchase for that instrument.')
  }
  const created = { ...state, investmentInstruments: [...state.investmentInstruments, instrument] }
  return addInvestmentTrade(created, transaction, movementId)
}

export function updateInvestmentInstrument(
  state: InvestmentState,
  instrument: InvestmentInstrument
): InvestmentResult {
  const validationError = validateInstrument(instrument)
  if (validationError) return failure(validationError)
  const existing = state.investmentInstruments.find(item => item.id === instrument.id)
  if (!existing) return failure('Instrument was not found.')
  if (existing.type !== instrument.type && state.investmentTransactions.some(item => item.instrumentId === instrument.id)) {
    return failure('Asset type cannot change after transactions have been recorded.')
  }
  return success({
    ...state,
    investmentInstruments: state.investmentInstruments.map(item => item.id === instrument.id ? instrument : item),
  })
}

export function removeInvestmentInstrument(state: InvestmentState, instrumentId: string): InvestmentResult {
  if (state.investmentTransactions.some(transaction => transaction.instrumentId === instrumentId)) {
    return failure('An instrument with transaction history cannot be deleted.')
  }
  if (!state.investmentInstruments.some(item => item.id === instrumentId)) return failure('Instrument was not found.')
  return success({
    ...state,
    investmentInstruments: state.investmentInstruments.filter(item => item.id !== instrumentId),
    investmentValuations: state.investmentValuations.filter(valuation => valuation.instrumentId !== instrumentId),
  })
}

export function addInvestmentTrade(
  state: InvestmentState,
  transaction: InvestmentTransaction,
  movementId: string
): InvestmentResult {
  const validationError = validateInvestmentTransaction(transaction)
  if (validationError) return failure(validationError)
  if (!state.investmentInstruments.some(item => item.id === transaction.instrumentId)) {
    return failure('Transaction references an unknown instrument.')
  }
  if (state.investmentTransactions.some(item => item.id === transaction.id)) return failure('Transaction ID already exists.')
  const nextTransactions = [...state.investmentTransactions, transaction]
  try {
    calculateInvestmentPositions(nextTransactions)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Investment holdings are invalid.')
  }
  const cashResult = addMovement(
    state,
    transaction,
    movementId,
    getTradeCashDeltaPaise(transaction),
    'trade',
    transaction.date
  )
  if (!cashResult.ok) return cashResult
  const instrument = state.investmentInstruments.find(item => item.id === transaction.instrumentId)!
  const nextTransaction = { ...transaction, cashMovementIds: [movementId] }
  const valuations = state.investmentValuations.some(item => item.instrumentId === instrument.id)
    ? state.investmentValuations
    : [...state.investmentValuations, {
        id: `purchase-${transaction.id}`,
        instrumentId: instrument.id,
        unitPricePaise: transaction.unitPricePaise,
        asOf: transaction.date,
        recordedAt: transaction.date,
        source: 'transaction' as const,
      }]
  return success({
    ...cashResult.state,
    investmentTransactions: [...state.investmentTransactions, nextTransaction],
    investmentValuations: valuations,
  })
}

export function updateInvestmentTrade(
  state: InvestmentState,
  transaction: InvestmentTransaction,
  movementId: string,
  recordedAt: string
): InvestmentResult {
  const previous = state.investmentTransactions.find(item => item.id === transaction.id)
  if (!previous || previous.status !== 'active') return failure('Active transaction was not found.')
  const validationError = validateInvestmentTransaction(transaction)
  if (validationError) return failure(validationError)
  if (!state.investmentInstruments.some(item => item.id === transaction.instrumentId)) {
    return failure('Transaction references an unknown instrument.')
  }
  const nextTransactions = state.investmentTransactions.map(item => item.id === transaction.id ? transaction : item)
  try {
    calculateInvestmentPositions(nextTransactions)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Investment holdings are invalid.')
  }
  const nextDelta = getTradeCashDeltaPaise(transaction)
  const adjustment = nextDelta - movementSum(state, transaction.id)
  if (!Number.isSafeInteger(adjustment)) return failure('Cash adjustment is outside the supported range.')
  const cashResult = addMovement(state, transaction, movementId, adjustment, 'edit', recordedAt)
  if (!cashResult.ok) return cashResult
  const updatedTransaction = {
    ...transaction,
    cashMovementIds: [...previous.cashMovementIds, movementId],
  }
  return success({
    ...cashResult.state,
    investmentTransactions: nextTransactions.map(item => item.id === transaction.id ? updatedTransaction : item),
  })
}

export function voidInvestmentTrade(
  state: InvestmentState,
  transactionId: string,
  movementId: string,
  recordedAt: string
): InvestmentResult {
  const transaction = state.investmentTransactions.find(item => item.id === transactionId)
  if (!transaction || transaction.status !== 'active') return failure('Active transaction was not found.')
  const nextTransactions = state.investmentTransactions.map(item =>
    item.id === transactionId
      ? { ...item, status: 'voided' as const, cashMovementIds: [...item.cashMovementIds, movementId] }
      : item
  )
  try {
    calculateInvestmentPositions(nextTransactions)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Removing this transaction would invalidate holdings.')
  }
  const reversal = -movementSum(state, transactionId)
  const cashResult = addMovement(state, transaction, movementId, reversal, 'delete', recordedAt)
  if (!cashResult.ok) return cashResult
  return success({
    ...cashResult.state,
    investmentTransactions: nextTransactions,
  })
}

export function undoVoidInvestmentTrade(
  state: InvestmentState,
  transactionId: string,
  movementId: string,
  recordedAt: string
): InvestmentResult {
  const transaction = state.investmentTransactions.find(item => item.id === transactionId)
  if (!transaction || transaction.status !== 'voided') return failure('Voided transaction was not found.')
  const nextTransactions = state.investmentTransactions.map(item =>
    item.id === transactionId
      ? { ...item, status: 'active' as const, cashMovementIds: [...item.cashMovementIds, movementId] }
      : item
  )
  try {
    calculateInvestmentPositions(nextTransactions)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Restoring this transaction would invalidate holdings.')
  }
  const restore = getTradeCashDeltaPaise(transaction)
  const cashResult = addMovement(state, transaction, movementId, restore, 'undo', recordedAt)
  if (!cashResult.ok) return cashResult
  return success({ ...cashResult.state, investmentTransactions: nextTransactions })
}

export function addInvestmentValuation(
  state: InvestmentState,
  valuation: InvestmentValuation
): InvestmentResult {
  if (!valuation.id.trim() || state.investmentValuations.some(item => item.id === valuation.id)) {
    return failure('Valuation ID must be unique.')
  }
  if (!state.investmentInstruments.some(item => item.id === valuation.instrumentId)) {
    return failure('Valuation references an unknown instrument.')
  }
  if (!Number.isSafeInteger(valuation.unitPricePaise) || valuation.unitPricePaise <= 0) {
    return failure('Valuation price must be a positive amount.')
  }
  if (!isValidDate(valuation.asOf) || !isValidDate(valuation.recordedAt) || valuation.source !== 'manual') {
    return failure('Only dated manual valuations are supported in this phase.')
  }
  return success({ ...state, investmentValuations: [...state.investmentValuations, valuation] })
}