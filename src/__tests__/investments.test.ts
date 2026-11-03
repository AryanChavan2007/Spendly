import { describe, expect, it } from 'vitest'
import {
  calculateCurrentValuePaise,
  calculateGrossPaise,
  calculateInvestmentPositions,
  getTradeCashDeltaPaise,
} from '../investment/investmentCalculations'
import type { InvestmentTransaction } from '../investment/types'

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

  it('rejects invalid quantities, sale proceeds, and oversold units', () => {
    expect(() => calculateGrossPaise(0, 100)).toThrow()
    expect(() => getTradeCashDeltaPaise(trade({ type: 'sell', feesPaise: 100_001 }))).toThrow()
    expect(() => calculateInvestmentPositions([
      trade({ type: 'sell', quantityMicros: 2_000_000 }),
    ])).toThrow(/exceeds available units/)
  })

  it('excludes voided trades from holdings', () => {
    const positions = calculateInvestmentPositions([
      trade({ status: 'voided' }),
    ])
    expect(positions.size).toBe(0)
  })
})