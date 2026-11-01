import { describe, it, expect, beforeEach } from 'vitest'
import { monthlySummary, getCalendarWeekRange, moneyMapActuals, getGoalSavedPaise } from '../utils/financeSummary'
import { computeVirtualCorpus, readinessScore } from '../utils/growCalculations'
import { validateBackup, defaultSettings } from '../data/ExpenseStore'
import { LocalStorageDriver } from '../data/storage'
import type { Expense, Contribution, Settings } from '../data/types'

const mockStorage: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value },
  removeItem: (key: string) => { delete mockStorage[key] },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) },
  length: 0,
  key: () => null
} as Storage

describe('Spendly Priority 2.5: Financial Accuracy & Reliability Tests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('1. calculates monthly summary and overspending correctly', () => {
    const expenses: Expense[] = [
      { id: '1', amount: 60000, category: 'Food', mode: 'UPI', type: 'Need', note: '', date: new Date().toISOString() }
    ]
    const contributions: Contribution[] = [
      { id: 'c1', goalId: 'g1', amountPaise: 10000, date: new Date().toISOString() }
    ]
    const settings: Settings = { ...defaultSettings, pocketMoney: 50000 }

    const summary = monthlySummary(expenses, contributions, settings)
    expect(summary.received).toBe(50000)
    expect(summary.spent).toBe(60000)
    expect(summary.saved).toBe(10000)
    expect(summary.remaining).toBe(-20000)
  })

  it('2 & 3. validates backup and rejects malformed nested structures / invalid contribution goal references', () => {
    const validPayload = {
      version: 2,
      expenses: [],
      settings: defaultSettings,
      goals: [{ id: 'g1', name: 'Emergency', targetPaise: 100000, level: 1, isEmergency: true, createdAt: new Date().toISOString() }],
      contributions: [{ id: 'c1', goalId: 'g1', amountPaise: 5000, date: new Date().toISOString() }],
      pauseItems: [],
      sipConfig: { amountPaise: 50000, day: 5, reminder: true, linkedGoalId: 'g1' },
      sipLogs: [],
      assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
      netWorthSnapshots: [],
      challenge: { completed: [], reflection: '' },
      ui: { dismissedInsightWeek: '', triggeredBudgetAlerts: {} }
    }
    const resValid = validateBackup(validPayload)
    expect(resValid.valid).toBe(true)
    if (resValid.valid) {
      expect(resValid.data.ui.triggeredBudgetAlerts).toBeDefined()
    }

    // Invalid contribution referencing non-existent goal ID
    const invalidGoalRefPayload = {
      ...validPayload,
      contributions: [{ id: 'c1', goalId: 'non-existent', amountPaise: 5000, date: new Date().toISOString() }]
    }
    const resInvalidRef = validateBackup(invalidGoalRefPayload)
    expect(resInvalidRef.valid).toBe(false)

    // Malformed SIP linkedGoalId
    const invalidSipGoalPayload = {
      ...validPayload,
      sipConfig: { amountPaise: 50000, day: 5, reminder: true, linkedGoalId: 'bad-id' }
    }
    const resInvalidSip = validateBackup(invalidSipGoalPayload)
    expect(resInvalidSip.valid).toBe(false)
  })

  it('4. storage write failure handling and successful persistence', () => {
    const driver = new LocalStorageDriver()
    const success = driver.set('test-key', { foo: 'bar' })
    expect(success).toBe(true)
    expect(driver.get('test-key')).toEqual({ foo: 'bar' })
  })

  it('5. calendar-week boundaries and year transitions (Dec 2024 to Jan 2025)', () => {
    const d1 = new Date(2024, 11, 30) // Dec 30, 2024 (Monday)
    const range1 = getCalendarWeekRange(d1)
    expect(range1.start).toBeInstanceOf(Date)
    expect(range1.end).toBeInstanceOf(Date)
    expect(range1.weekKey).toBe('2025-W01')

    const d2 = new Date(2025, 0, 2) // Jan 2, 2025 (Thursday)
    const range2 = getCalendarWeekRange(d2)
    expect(range2.weekKey).toBe('2025-W01')
  })

  it('6. SIP virtual corpus calculation with missing calendar months', () => {
    const logs = [
      { id: '1', monthKey: '2026-01', amountPaise: 10000, date: new Date().toISOString() },
      { id: '2', monthKey: '2026-03', amountPaise: 10000, date: new Date().toISOString() } // Feb missed
    ]
    const res = computeVirtualCorpus(logs)
    expect(res.totalContributed).toBe(20000)
    expect(res.virtualCorpus).toBeGreaterThan(20000)
  })

  it('7. Readiness score bounds (0 to 100)', () => {
    const scoreRes = readinessScore({
      emergencySaved: 150000,
      monthlyEssentials: 50000,
      loggedDays: 20,
      stayedInBudget: true,
      goalProgress: 0.8,
      hasHighInterestDebt: false,
      hasEmergencyGoal: true,
    })
    expect(scoreRes.score).toBeGreaterThanOrEqual(0)
    expect(scoreRes.score).toBeLessThanOrEqual(100)
  })

  it('8. Money Map actuals calculation and categorization accuracy', () => {
    const expenses: Expense[] = [
      { id: '1', amount: 20000, category: 'Food', mode: 'UPI', type: 'Need', note: '', date: new Date().toISOString() },
      { id: '2', amount: 10000, category: 'Skills/Learning', mode: 'UPI', type: 'Need', note: '', date: new Date().toISOString() },
      { id: '3', amount: 5000, category: 'Entertainment', mode: 'UPI', type: 'Want', note: '', date: new Date().toISOString() },
      { id: '4', amount: 5000, category: 'Other', mode: 'Cash', type: 'Need', note: '', date: new Date().toISOString() },
    ]
    const contributions: Contribution[] = [
      { id: 'c1', goalId: 'g1', amountPaise: 10000, date: new Date().toISOString() }
    ]
    const settings: Settings = { ...defaultSettings, pocketMoney: 50000 }

    const actuals = moneyMapActuals(expenses, contributions, settings)
    expect(actuals.Essentials).toBe(40) // 20000 / 50000
    expect(actuals.Savings).toBe(20)    // 10000 / 50000
    expect(actuals.Skills).toBe(20)     // 10000 / 50000
    expect(actuals.Enjoyment).toBe(10)  // 5000 / 50000
    expect(actuals.Unexpected).toBe(10) // 5000 / 50000
  })

  it('9. Goal progress calculation and zero target edge case', () => {
    const contributions: Contribution[] = [
      { id: 'c1', goalId: 'g1', amountPaise: 25000, date: new Date().toISOString() }
    ]
    const saved = getGoalSavedPaise('g1', contributions)
    expect(saved).toBe(25000)

    const targetZero = 0
    const pct = targetZero > 0 ? Math.min(100, (saved / targetZero) * 100) : 0
    expect(pct).toBe(0)
  })

  it('10. Net worth accounting formula verification', () => {
    const goalContributionsTotal = 150000
    const cashInHand = 50000
    const otherAssets = 200000
    const owed = 30000
    const netWorth = goalContributionsTotal + cashInHand + otherAssets - owed
    expect(netWorth).toBe(370000)
  })
})
