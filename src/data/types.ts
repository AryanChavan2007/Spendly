export const categories = ['Travel', 'Food', 'Phone & Data', 'Academic', 'Entertainment', 'Shopping', 'Skills/Learning', 'Other'] as const
export const paymentModes = ['Cash', 'UPI', 'Card', 'Net Banking'] as const
export const expenseTypes = ['Need', 'Want', 'Goal'] as const
export type Category = typeof categories[number]
export type PaymentMode = typeof paymentModes[number]
export type ExpenseType = typeof expenseTypes[number]
export type MoneyBucket = 'Essentials' | 'Savings' | 'Skills' | 'Enjoyment' | 'Unexpected'

export type Expense = {
  id: string
  amount: number
  category: Category
  mode: PaymentMode
  type: ExpenseType
  note: string
  date: string
}

export type Goal = {
  id: string
  name: string
  targetPaise: number
  level: 1 | 2 | 3 | 4 | 5
  isEmergency: boolean
  createdAt: string
}

export type Contribution = {
  id: string
  goalId: string
  amountPaise: number
  date: string
}

export type PauseItem = {
  id: string
  name: string
  pricePaise: number
  startedAt: string
  readyAt: string
  status: 'waiting' | 'bought' | 'skipped'
  decidedAt?: string
}

export type SipConfig = {
  amountPaise: number
  day: number
  reminder: boolean
  linkedGoalId?: string
}

export type SipLog = {
  id: string
  monthKey: string
  amountPaise: number
  date: string
}

export type Assets = {
  cashInHand: number
  otherAssets: number
  owed: number
}

export type NetWorthSnapshot = {
  monthKey: string
  netWorthPaise: number
}

export type Challenge = {
  completed: number[]
  reflection: string
}

export type UIState = {
  dismissedInsightWeek: string
  triggeredBudgetAlerts?: Record<string, boolean>
}

export type PlannedEssentialCategory = 'Travel' | 'Food' | 'Phone & Data' | 'Academic'

export type Settings = {
  budget: number
  pocketMoney: number
  receivedDay: number
  categoryLimits: Partial<Record<Category, number>>
  plannedEssentials: Partial<Record<PlannedEssentialCategory, number>>
  reminder: boolean
  reminderTime: string
  warnings: boolean
  pauseReminders: boolean
  sipReminders: boolean
  currency: string
  theme: 'dark' | 'light' | 'system'
  amoled: boolean
  name: string
  moneyMap: Record<MoneyBucket, number>
}

export type Draft = Omit<Expense, 'id' | 'amount'> & { amountText: string; editId?: string }

export function toPaise(text: string | number): number {
  if (typeof text === 'number') {
    if (!Number.isFinite(text) || Number.isNaN(text) || text < 0) return 0
    return Math.round(text * 100)
  }
  const n = Number(text)
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}
