import type { InvestmentValuation } from './types'

export type InvestmentPriceProvider = {
  readonly source: 'manual' | 'provider'
  createValuation(input: {
    id: string
    instrumentId: string
    unitPricePaise: number
    asOf: string
    recordedAt: string
  }): InvestmentValuation
}

export const manualPriceProvider: InvestmentPriceProvider = {
  source: 'manual',
  createValuation: input => ({ ...input, source: 'manual' }),
}