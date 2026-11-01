import { describe, it, expect } from 'vitest'
import { monthlySummary, moneyMapActuals, getCalendarWeekRange, getWeekKey } from '../utils/financeSummary'
import { validateBackup, defaultSettings } from '../data/ExpenseStore'
import type { Expense, Contribution, Settings } from '../data/types'

describe('Spendly Core Finance & Validation Logic', () => {
  it('calculates monthly summary correctly', () => {
    const expenses: Expense[] = [
      { id: '1', amount: 10000, category: 'Food', mode: 'UPI', type: 'Need', note: '', date: new Date().toISOString() }
    ]
    const contributions: Contribution[] = [
      { id: 'c1', goalId: 'g1', amountPaise: 5000, date: new Date().toISOString() }
    ]
    const settings: Settings = { ...defaultSettings, pocketMoney: 50000 }

    const summary = monthlySummary(expenses, contributions, settings)
    expect(summary.received).toBe(50000)
    expect(summary.spent).toBe(10000)
    expect(summary.saved).toBe(5000)
    expect(summary.remaining).toBe(35000)
  })

  it('validates correct backup payload', () => {
    const validPayload = {
      version: 2,
      expenses: [],
      settings: defaultSettings,
      goals: [],
      contributions: [],
      pauseItems: [],
      sipConfig: { amountPaise: 50000, day: 5, reminder: true },
      sipLogs: [],
      assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
      netWorthSnapshots: [],
      challenge: { completed: [], reflection: '' }
    }
    const res = validateBackup(validPayload)
    expect(res.valid).toBe(true)
  })

  it('rejects invalid backup payload', () => {
    const invalidPayload = { version: 1, expenses: 'not-an-array' }
    const res = validateBackup(invalidPayload)
    expect(res.valid).toBe(false)
  })

  it('computes calendar week ranges correctly', () => {
    const now = new Date(2026, 3, 15) // April 15, 2026
    const range = getCalendarWeekRange(now)
    expect(range.start).toBeInstanceOf(Date)
    expect(range.end).toBeInstanceOf(Date)
    expect(typeof range.weekKey).toBe('string')
  })
})
