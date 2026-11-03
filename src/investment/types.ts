export const investmentAssetTypes = ['stocks', 'mutual-funds', 'etfs', 'gold', 'fixed-deposits'] as const
export type InvestmentAssetType = typeof investmentAssetTypes[number]

export type FixedDepositTerms = {
  principalPaise: number
  annualRateBasisPoints: number
  startDate: string
  maturityDate: string
}

export type InvestmentInstrument = {
  id: string
  type: InvestmentAssetType
  name: string
  identifier?: string
  fixedDeposit?: FixedDepositTerms
  createdAt: string
}

export type InvestmentTransaction = {
  id: string
  instrumentId: string
  type: 'buy' | 'sell'
  quantityMicros: number
  unitPricePaise: number
  feesPaise: number
  taxesPaise: number
  date: string
  note: string
  status: 'active' | 'voided'
  cashMovementIds: string[]
}

export type InvestmentCashMovement = {
  id: string
  transactionId: string
  deltaPaise: number
  reason: 'trade' | 'edit' | 'delete' | 'undo'
  date: string
}

export type InvestmentValuation = {
  id: string
  instrumentId: string
  unitPricePaise: number
  asOf: string
  recordedAt: string
  source: 'manual' | 'transaction' | 'provider'
}

export type InvestmentPosition = {
  instrumentId: string
  quantityMicros: number
  costBasisPaise: number
  realizedProfitLossPaise: number
}