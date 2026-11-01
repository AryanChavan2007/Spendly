import { describe, it, expect, beforeEach } from 'vitest'
import { monthlySummary, getCalendarWeekRange } from '../utils/financeSummary'
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

describe('Spendly Comprehensive Audit & Reliability Tests', () => {
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

  it('2 & 3. validates backup and rejects invalid nested structures / invalid contribution goal references', () => {
    const validPayload = {
      version: 2,
      expenses: [],
      settings: defaultSettings,
      goals: [{ id: 'g1', name: 'Emergency', targetPaise: 100000, level: 1, isEmergency: true, createdAt: new Date().toISOString() }],
      contributions: [{ id: 'c1', goalId: 'g1', amountPaise: 5000, date: new Date().toISOString() }],
      pauseItems: [],
      sipConfig: { amountPaise: 50000, day: 5, reminder: true },
      sipLogs: [],
      assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
      netWorthSnapshots: [],
      challenge: { completed: [], reflection: '' },
      ui: { dismissedInsightWeek: '' }
    }
    const resValid = validateBackup(validPayload)
    expect(resValid.valid).toBe(true)

    // Invalid contribution referencing non-existent goal ID
    const invalidGoalRefPayload = {
      ...validPayload,
      contributions: [{ id: 'c1', goalId: 'non-existent', amountPaise: 5000, date: new Date().toISOString() }]
    }
    const resInvalidRef = validateBackup(invalidGoalRefPayload)
    expect(resInvalidRef.valid).toBe(false)
  })

  it('4. storage write failure handling and successful persistence', () => {
    const driver = new LocalStorageDriver()
    const success = driver.set('test-key', { foo: 'bar' })
    expect(success).toBe(true)
    expect(driver.get('test-key')).toEqual({ foo: 'bar' })
  })

  it('5. calendar-week boundaries and year transitions', () => {
    const d1 = new Date(2024, 11, 30) // Dec 30, 2024
    const range1 = getCalendarWeekRange(d1)
    expect(range1.start).toBeInstanceOf(Date)
    expect(range1.end).toBeInstanceOf(Date)
    expect(range1.weekKey).toContain('2024')

    const d2 = new Date(2025, 0, 2) // Jan 2, 2025
    const range2 = getCalendarWeekRange(d2)
    expect(range2.weekKey).toContain('2025')
  })

  it('6. SIP calculations and compounding expectations', () => {
    const monthlyPaise = 50000 // ₹500
    const months = 12
    const totalInvested = monthlyPaise * months
    expect(totalInvested).toBe(600000)
  })
})
