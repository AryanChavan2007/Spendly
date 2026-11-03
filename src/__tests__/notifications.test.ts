import { beforeEach, describe, expect, it, vi } from 'vitest'

const notificationMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  checkPermissions: vi.fn(),
  createChannel: vi.fn(),
  getPending: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: notificationMocks,
}))

import { defaultSettings } from '../data/ExpenseStore'
import type { StoredData } from '../data/ExpenseStore'
import { syncNotifications } from '../utils/notifications'

function stateWithBudgetThreshold(): StoredData {
  return {
    schemaVersion: 2,
    expenses: [{
      id: 'threshold-expense',
      amount: 8000,
      category: 'Food',
      mode: 'UPI',
      type: 'Need',
      note: '',
      date: new Date().toISOString(),
    }],
    settings: {
      ...defaultSettings,
      pocketMoney: 10000,
      reminder: false,
      sipReminders: false,
      warnings: true,
      pauseReminders: false,
    },
    goals: [],
    contributions: [],
    pauseItems: [],
    sipConfig: { amountPaise: 50000, day: 5, reminder: false },
    sipLogs: [],
    assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
    netWorthSnapshots: [],
    challenge: { completed: [], reflection: '' },
    ui: { dismissedInsightWeek: '', triggeredBudgetAlerts: {} },
  }
}

describe('notification threshold persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
    notificationMocks.createChannel.mockResolvedValue(undefined)
    notificationMocks.getPending.mockResolvedValue({ notifications: [] })
  })

  it('does not mark a budget threshold triggered when scheduling fails', async () => {
    notificationMocks.schedule.mockRejectedValue(new Error('schedule unavailable'))
    const onTriggerThreshold = vi.fn()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await syncNotifications(stateWithBudgetThreshold(), onTriggerThreshold)

    expect(notificationMocks.schedule).toHaveBeenCalledOnce()
    expect(onTriggerThreshold).not.toHaveBeenCalled()
  })

  it('marks a threshold triggered only after scheduling succeeds', async () => {
    const order: string[] = []
    notificationMocks.schedule.mockImplementation(async () => {
      order.push('scheduled')
    })
    const onTriggerThreshold = vi.fn(() => order.push('marked'))

    await syncNotifications(stateWithBudgetThreshold(), onTriggerThreshold)

    expect(onTriggerThreshold).toHaveBeenCalledWith(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-80`)
    expect(order).toEqual(['scheduled', 'marked'])
  })
})
