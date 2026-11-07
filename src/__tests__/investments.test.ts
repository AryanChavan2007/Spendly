import { describe, expect, it } from 'vitest'
import {
  calculateCurrentValuePaise,
  calculateGrossPaise,
  calculateInvestmentPositions,
  calculatePortfolioValuePaise,
  filterInvestmentsByType,
  getTradeCashDeltaPaise,
  previewInvestmentSale,
} from '../investment/investmentCalculations'
import {
  addInvestmentInstrument,
  addInvestmentTrade,
  addInvestmentWithTrade,
  addInvestmentValuation,
  undoVoidInvestmentTrade,
  updateInvestmentInstrument,
  updateInvestmentTrade,
  voidInvestmentTrade,
  type InvestmentState,
} from '../investment/investmentStore'
import type { InvestmentTransaction } from '../investment/types'
import { validateInstrument } from '../investment/investmentValidation'

function trade(overrides: Partial<InvestmentTransaction>): InvestmentTransaction {
  return {
    id: 'trade-1',
    instrumentId: 'fund-1',
    type: 'buy',
    quantityMicros: 1_000_000,
    unitPricePaise: 100_000,
    feesPaise: 0,
    taxesPaise: 0,
    date: '2026-01-01T00:00:00.000Z',
    note: '',
    status: 'active',
    cashMovementIds: ['movement-1'],
    ...overrides,
  }
}

function emptyState(cashInHand = 2_000_000): InvestmentState {
  return {
    assets: { cashInHand, otherAssets: 0, owed: 0 },
    investmentInstruments: [],
    investmentTransactions: [],
    investmentCashMovements: [],
    investmentValuations: [],
  }
}

function instrument() {
  return {
    id: 'fund-1' as const,
    type: 'mutual-funds' as const,
    name: 'Test fund',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function stateWithInstrument(cashInHand = 2_000_000): InvestmentState {
  const result = addInvestmentInstrument(emptyState(cashInHand), instrument())
  if (!result.ok) throw new Error(result.error)
  return result.state
}

describe('investment accounting calculations', () => {
  it('calculates gross values in paise with fractional units', () => {
    expect(calculateGrossPaise(1_500_000, 1_000)).toBe(1_500)
    expect(calculateCurrentValuePaise(2_000_000, 2_500)).toBe(5_000)
  })

  it('reduces cash by purchase price plus fees and taxes', () => {
    expect(getTradeCashDeltaPaise(trade({ feesPaise: 250, taxesPaise: 125 }))).toBe(-100_375)
  })

  it('increases cash by sale proceeds after fees and taxes', () => {
    expect(getTradeCashDeltaPaise(trade({
      type: 'sell',
      feesPaise: 250,
      taxesPaise: 125,
    }))).toBe(99_625)
  })

  it('uses FIFO cost basis and includes buy/sell charges in realized P/L', () => {
    const positions = calculateInvestmentPositions([
      trade({ id: 'buy-1', quantityMicros: 2_000_000, unitPricePaise: 10_000, feesPaise: 100 }),
      trade({ id: 'buy-2', date: '2026-01-02T00:00:00.000Z', quantityMicros: 1_000_000, unitPricePaise: 20_000 }),
      trade({
        id: 'sell-1',
        type: 'sell',
        date: '2026-01-03T00:00:00.000Z',
        quantityMicros: 1_000_000,
        unitPricePaise: 15_000,
        feesPaise: 100,
      }),
    ]).get('fund-1')

    expect(positions).toEqual({
      instrumentId: 'fund-1',
      quantityMicros: 2_000_000,
      costBasisPaise: 30_050,
      realizedProfitLossPaise: 4_850,
    })
  })

  it('filters instruments by asset type', () => {
    expect(filterInvestmentsByType([
      instrument(),
      { ...instrument(), id: 'stock-1', type: 'stocks' },
    ], 'stocks').map(item => item.id)).toEqual(['stock-1'])
    expect(filterInvestmentsByType([instrument()], 'all')).toHaveLength(1)
  })

  it('previews sale proceeds and FIFO realized gain using the accounting calculator', () => {
    const purchases = [trade({
      id: 'buy-1', quantityMicros: 2_000_000, unitPricePaise: 100_000, feesPaise: 100,
    })]
    const preview = previewInvestmentSale(purchases, trade({
      id: 'sell-preview',
      type: 'sell',
      quantityMicros: 1_000_000,
      unitPricePaise: 120_000,
      feesPaise: 100,
      date: '2026-01-02T00:00:00.000Z',
    }))

    expect(preview).toEqual({
      grossPaise: 120_000,
      chargesPaise: 100,
      proceedsPaise: 119_900,
      realizedProfitLossPaise: 19_850,
    })
    expect(() => previewInvestmentSale(purchases, trade({
      id: 'oversell-preview', type: 'sell', quantityMicros: 3_000_000,
    }))).toThrow(/exceeds available units/)
  })

  it('rejects invalid quantities, sale proceeds, and oversold units', () => {
    expect(() => calculateGrossPaise(0, 100)).toThrow()
    expect(() => getTradeCashDeltaPaise(trade({ type: 'sell', feesPaise: 100_001 }))).toThrow()
    expect(() => calculateInvestmentPositions([
      trade({ type: 'sell', quantityMicros: 2_000_000 }),
    ])).toThrow(/exceeds available units/)
  })

  it('keeps insertion order for same-minute trades even when IDs sort differently', () => {
    const positions = calculateInvestmentPositions([
      trade({ id: 'z-buy', date: '2026-01-01T10:00:00.000Z' }),
      trade({ id: 'a-sell', type: 'sell', date: '2026-01-01T10:00:00.000Z' }),
    ])
    expect(positions.get('fund-1')?.quantityMicros).toBe(0)
  })

  it('excludes voided trades from holdings', () => {
    const positions = calculateInvestmentPositions([
      trade({ status: 'voided' }),
    ])
    expect(positions.size).toBe(0)
  })

  it('accepts fixed-deposit calendar dates and rejects impossible dates', () => {
    const deposit = {
      id: 'fd-1',
      type: 'fixed-deposits' as const,
      name: 'Test deposit',
      createdAt: '2026-01-01T00:00:00.000Z',
      fixedDeposit: {
        principalPaise: 100_000,
        annualRateBasisPoints: 650,
        startDate: '2026-01-01',
        maturityDate: '2027-01-01',
      },
    }
    expect(validateInstrument(deposit)).toBeNull()
    expect(validateInstrument({
      ...deposit,
      fixedDeposit: { ...deposit.fixedDeposit, maturityDate: '2026-02-30' },
    })).toContain('dates are invalid')
  })

  it('moves purchase cash into the portfolio without changing net worth', () => {
    const initial = stateWithInstrument()
    const result = addInvestmentTrade(initial, trade({
      id: 'buy-1',
      quantityMicros: 1_000_000,
      unitPricePaise: 500_000,
      cashMovementIds: [],
    }), 'movement-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const positions = calculateInvestmentPositions(result.state.investmentTransactions)
    const investmentValue = calculateCurrentValuePaise(
      positions.get('fund-1')!.quantityMicros,
      result.state.investmentValuations[0].unitPricePaise,
    )
    expect(result.state.assets.cashInHand).toBe(1_500_000)
    expect(result.state.assets.cashInHand + investmentValue).toBe(2_000_000)
    expect(result.state.investmentTransactions).toHaveLength(1)
    expect(result.state.investmentCashMovements).toHaveLength(1)
  })

  it('creates a new instrument and first purchase atomically', () => {
    const result = addInvestmentWithTrade(emptyState(), instrument(), trade({
      id: 'buy-1',
      cashMovementIds: [],
    }), 'movement-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.investmentInstruments).toHaveLength(1)
    expect(result.state.investmentTransactions).toHaveLength(1)
    expect(result.state.investmentCashMovements).toHaveLength(1)
  })

  it('returns net sale proceeds to the same cash balance', () => {
    const initial = stateWithInstrument()
    const bought = addInvestmentTrade(initial, trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    const sold = addInvestmentTrade(bought.state, trade({
      id: 'sell-1',
      type: 'sell',
      date: '2026-01-02T00:00:00.000Z',
      unitPricePaise: 110_000,
      feesPaise: 1_000,
      cashMovementIds: [],
    }), 'movement-2')

    expect(sold.ok).toBe(true)
    if (!sold.ok) return
    expect(sold.state.assets.cashInHand).toBe(2_009_000)
    expect(calculateInvestmentPositions(sold.state.investmentTransactions).get('fund-1')?.quantityMicros).toBe(0)
  })

  it('allows investments exceeding cash balance and rejects duplicate IDs, unknown instruments, and oversells atomically', () => {
    const initial = stateWithInstrument(10_000)
    const tooExpensive = addInvestmentTrade(initial, trade({ id: 'buy-1', cashMovementIds: [], unitPricePaise: 100_000 }), 'movement-1')
    expect(tooExpensive.ok).toBe(true)
    if (tooExpensive.ok) {
      expect(tooExpensive.state.assets.cashInHand).toBe(-90_000)
    }

    const bought = addInvestmentTrade(stateWithInstrument(), trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    expect(addInvestmentTrade(bought.state, trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-2').ok).toBe(false)
    expect(addInvestmentTrade(bought.state, trade({ id: 'bad-ref', instrumentId: 'missing', cashMovementIds: [] }), 'movement-3').ok).toBe(false)
    expect(addInvestmentTrade(bought.state, trade({ id: 'oversell', type: 'sell', quantityMicros: 2_000_000, cashMovementIds: [] }), 'movement-4').ok).toBe(false)
  })

  it('edits a trade with a compensating movement and can delete and undo it', () => {
    const bought = addInvestmentTrade(stateWithInstrument(), trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    const edited = updateInvestmentTrade(bought.state, trade({
      id: 'buy-1',
      unitPricePaise: 90_000,
      cashMovementIds: ['movement-1'],
    }), 'movement-edit', '2026-01-02T00:00:00.000Z')
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.state.assets.cashInHand).toBe(1_910_000)
    expect(edited.state.investmentCashMovements).toHaveLength(2)

    const deleted = voidInvestmentTrade(edited.state, 'buy-1', 'movement-delete', '2026-01-03T00:00:00.000Z')
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.state.assets.cashInHand).toBe(2_000_000)
    expect(calculateInvestmentPositions(deleted.state.investmentTransactions).get('fund-1')?.quantityMicros).toBeUndefined()

    const restored = undoVoidInvestmentTrade(deleted.state, 'buy-1', 'movement-undo', '2026-01-04T00:00:00.000Z')
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.assets.cashInHand).toBe(1_910_000)
    expect(calculateInvestmentPositions(restored.state.investmentTransactions).get('fund-1')?.quantityMicros).toBe(1_000_000)
  })

  it('appends manual valuations without changing transaction history', () => {
    const bought = addInvestmentTrade(stateWithInstrument(), trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    const valuationResult = addInvestmentValuation(bought.state, {
      id: 'valuation-1',
      instrumentId: 'fund-1',
      unitPricePaise: 120_000,
      asOf: '2026-02-01T00:00:00.000Z',
      recordedAt: '2026-02-01T00:00:00.000Z',
      source: 'manual',
    })
    expect(valuationResult.ok).toBe(true)
    if (!valuationResult.ok) return
    expect(valuationResult.state.investmentValuations).toHaveLength(2)
    expect(valuationResult.state.investmentTransactions[0]).toEqual(bought.state.investmentTransactions[0])
  })

  it('allows instrument renaming but prevents changing asset type after trades exist', () => {
    const bought = addInvestmentTrade(stateWithInstrument(), trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    const renamed = updateInvestmentInstrument(bought.state, { ...instrument(), name: 'Updated name' })
    expect(renamed.ok).toBe(true)
    const retyped = updateInvestmentInstrument(bought.state, { ...instrument(), type: 'etfs' })
    expect(retyped).toMatchObject({ ok: false, error: 'Asset type cannot change after transactions have been recorded.' })
  })

  it('uses the latest manual valuation and ignores closed positions', () => {
    const bought = addInvestmentTrade(stateWithInstrument(), trade({ id: 'buy-1', cashMovementIds: [] }), 'movement-1')
    if (!bought.ok) throw new Error(bought.error)
    const valuations = [
      { id: 'old', instrumentId: 'fund-1', unitPricePaise: 100_000, asOf: '2026-01-01', recordedAt: '2026-01-01', source: 'manual' as const },
      { id: 'new', instrumentId: 'fund-1', unitPricePaise: 120_000, asOf: '2026-02-01', recordedAt: '2026-02-01', source: 'manual' as const },
    ]
    expect(calculatePortfolioValuePaise(bought.state.investmentTransactions, valuations)).toBe(120_000)
    const sold = addInvestmentTrade(bought.state, trade({
      id: 'sell-1', type: 'sell', date: '2026-03-01', cashMovementIds: [],
    }), 'movement-2')
    if (!sold.ok) throw new Error(sold.error)
    expect(calculatePortfolioValuePaise(sold.state.investmentTransactions, valuations)).toBe(0)
  })
})