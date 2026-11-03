import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  sampleAssets,
  sampleChallenge,
  sampleContributions,
  sampleExpenses,
  sampleGoals,
  sampleNetWorthSnapshots,
  samplePauseItems,
  sampleSettings,
  sampleSipConfig,
  sampleSipLogs,
} from './sampleData'
import {
  categories,
  expenseTypes,
  paymentModes,
  toPaise,
  type Assets,
  type Challenge,
  type Contribution,
  type Draft,
  type Expense,
  type Goal,
  type NetWorthSnapshot,
  type PauseItem,
  type Settings,
  type SipConfig,
  type SipLog,
  type UIState,
} from './types'
import { storage } from './storage'
import { syncNotifications } from '../utils/notifications'
import { syncStatusBar } from '../utils/statusBar'
import { hapticLight } from '../utils/haptics'

const STORE_KEY = 'spendly-v2'

const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const blankDraft = (): Draft => ({
  amountText: '',
  category: 'Food',
  mode: 'UPI',
  type: 'Need',
  note: '',
  date: nowLocal(),
})

export const defaultSettings: Settings = {
  budget: 500000,
  pocketMoney: 500000,
  receivedDay: 1,
  categoryLimits: {},
  plannedEssentials: {
    Travel: 70000,
    Food: 150000,
    'Phone & Data': 30000,
    Academic: 60000,
  },
  reminder: true,
  reminderTime: '20:30',
  warnings: true,
  pauseReminders: true,
  sipReminders: true,
  currency: '₹',
  theme: 'system',
  amoled: false,
  name: '',
  moneyMap: {
    Essentials: 45,
    Savings: 20,
    Skills: 15,
    Enjoyment: 15,
    Unexpected: 5,
  },
}

export type StoredData = {
  schemaVersion: 2
  expenses: Expense[]
  settings: Settings
  goals: Goal[]
  contributions: Contribution[]
  pauseItems: PauseItem[]
  sipConfig: SipConfig
  sipLogs: SipLog[]
  assets: Assets
  netWorthSnapshots: NetWorthSnapshot[]
  challenge: Challenge
  ui: UIState
}

export type BackupValidationResult =
  | {
      valid: true
      isLegacyArray: boolean
      counts: {
        expenses: number
        goals: number
        contributions: number
        pauseItems: number
        sipLogs: number
      }
      data: StoredData
    }
  | {
      valid: false
      error: string
    }

export function validateBackup(parsed: unknown): BackupValidationResult {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Backup file must be a valid JSON object or array.' }
  }

  const validateExpense = (e: unknown, index: number): string | null => {
    if (!e || typeof e !== 'object') return `Expense at index ${index} is not an object.`
    const exp = e as Partial<Expense>
    if (typeof exp.id !== 'string' || !exp.id.trim()) {
      return `Expense at index ${index} has an invalid or missing 'id'.`
    }
    if (!Number.isInteger(exp.amount) || (exp.amount ?? -1) < 0) {
      return `Expense '${exp.id}' has an invalid amount (${exp.amount}). Must be an integer >= 0.`
    }
    if (!exp.category || !categories.includes(exp.category)) {
      return `Expense '${exp.id}' has an invalid category '${exp.category}'.`
    }
    if (!exp.mode || !paymentModes.includes(exp.mode)) {
      return `Expense '${exp.id}' has an invalid payment mode '${exp.mode}'.`
    }
    if (!exp.type || !expenseTypes.includes(exp.type)) {
      return `Expense '${exp.id}' has an invalid expense type '${exp.type}'.`
    }
    if (typeof exp.date !== 'string' || Number.isNaN(Date.parse(exp.date))) {
      return `Expense '${exp.id}' has an invalid date '${exp.date}'.`
    }
    return null
  }

  // 1. Plain array of expenses
  if (Array.isArray(parsed)) {
    for (let i = 0; i < parsed.length; i++) {
      const err = validateExpense(parsed[i], i)
      if (err) return { valid: false, error: err }
    }
    const expenses: Expense[] = parsed.map((e: Partial<Expense>) => ({
      id: String(e.id),
      amount: Number(e.amount),
      category: e.category!,
      mode: e.mode!,
      type: e.type!,
      note: typeof e.note === 'string' ? e.note : '',
      date: e.date!,
    }))
    return {
      valid: true,
      isLegacyArray: true,
      counts: {
        expenses: expenses.length,
        goals: 0,
        contributions: 0,
        pauseItems: 0,
        sipLogs: 0,
      },
      data: {
        schemaVersion: 2,
        expenses,
        settings: defaultSettings,
        goals: [],
        contributions: [],
        pauseItems: [],
        sipConfig: { amountPaise: 50000, day: 5, reminder: true },
        sipLogs: [],
        assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
        netWorthSnapshots: [],
        challenge: { completed: [], reflection: '' },
        ui: { dismissedInsightWeek: '' },
      },
    }
  }

  // 2. Versioned object
  const obj = parsed as Record<string, unknown>
  const isMonthKey = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
  const ver = obj.version ?? obj.schemaVersion
  if (ver !== 2) {
    return { valid: false, error: 'Unsupported backup version. Expected version 2.' }
  }

  if (!Array.isArray(obj.expenses)) {
    return { valid: false, error: 'Backup must contain an "expenses" array.' }
  }

  for (let i = 0; i < obj.expenses.length; i++) {
    const err = validateExpense(obj.expenses[i], i)
    if (err) return { valid: false, error: err }
  }

  const goals: Goal[] = []
  if (obj.goals) {
    if (!Array.isArray(obj.goals)) return { valid: false, error: '"goals" must be an array.' }
    for (let i = 0; i < obj.goals.length; i++) {
      const g = obj.goals[i] as Partial<Goal>
      if (!g || typeof g !== 'object') return { valid: false, error: `Goal at index ${i} is invalid.` }
      if (typeof g.id !== 'string' || !g.id) return { valid: false, error: `Goal at index ${i} has an invalid id.` }
      if (typeof g.name !== 'string' || !g.name.trim()) return { valid: false, error: `Goal '${g.id}' has an empty name.` }
      if (!Number.isInteger(g.targetPaise) || (g.targetPaise ?? -1) < 0) {
        return { valid: false, error: `Goal '${g.name}' target must be an integer >= 0.` }
      }
      if (!g.level || ![1, 2, 3, 4, 5].includes(g.level)) {
        return { valid: false, error: `Goal '${g.name}' has invalid pyramid level (${g.level}).` }
      }
      goals.push({
        id: g.id,
        name: g.name.trim(),
        targetPaise: g.targetPaise!,
        level: g.level,
        isEmergency: Boolean(g.isEmergency),
        createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
      })
    }
  }

  const goalIds = new Set(goals.map(g => g.id))

  const contributions: Contribution[] = []
  if (obj.contributions) {
    if (!Array.isArray(obj.contributions)) return { valid: false, error: '"contributions" must be an array.' }
    for (let i = 0; i < obj.contributions.length; i++) {
      const c = obj.contributions[i] as Partial<Contribution>
      if (!c || typeof c !== 'object') return { valid: false, error: `Contribution at index ${i} is invalid.` }
      if (typeof c.id !== 'string' || typeof c.goalId !== 'string') {
        return { valid: false, error: `Contribution at index ${i} has invalid id or goalId.` }
      }
      if (!Number.isInteger(c.amountPaise) || (c.amountPaise ?? -1) < 0) {
        return { valid: false, error: `Contribution '${c.id}' amount must be integer >= 0.` }
      }
      if (typeof c.date !== 'string' || Number.isNaN(Date.parse(c.date))) {
        return { valid: false, error: `Contribution '${c.id}' has an invalid date.` }
      }
      contributions.push({
        id: c.id,
        goalId: c.goalId,
        amountPaise: c.amountPaise!,
        date: c.date,
      })
    }
    const goalIds = new Set(goals.map(g => g.id))
    for (const c of contributions) {
      if (!goalIds.has(c.goalId)) {
        return { valid: false, error: `Contribution '${c.id}' references non-existent goal ID '${c.goalId}'.` }
      }
    }
  }

  const pauseItems: PauseItem[] = []
  if (obj.pauseItems) {
    if (!Array.isArray(obj.pauseItems)) return { valid: false, error: '"pauseItems" must be an array.' }
    for (let i = 0; i < obj.pauseItems.length; i++) {
      const p = obj.pauseItems[i] as Partial<PauseItem>
      if (!p || typeof p !== 'object') return { valid: false, error: `Pause item at index ${i} is invalid.` }
      if (typeof p.id !== 'string' || typeof p.name !== 'string') {
        return { valid: false, error: `Pause item at index ${i} has invalid id or name.` }
      }
      if (!Number.isInteger(p.pricePaise) || (p.pricePaise ?? -1) < 0) {
        return { valid: false, error: `Pause item '${p.name}' price must be integer >= 0.` }
      }
      if (!p.status || !['waiting', 'bought', 'skipped'].includes(p.status)) {
        return { valid: false, error: `Pause item '${p.name}' has invalid status '${p.status}'.` }
      }
      pauseItems.push({
        id: p.id,
        name: p.name,
        pricePaise: p.pricePaise!,
        startedAt: p.startedAt || new Date().toISOString(),
        readyAt: p.readyAt || new Date().toISOString(),
        status: p.status,
        decidedAt: p.decidedAt,
      })
    }
  }

  const sipLogs: SipLog[] = []
  if (obj.sipLogs !== undefined) {
    if (!Array.isArray(obj.sipLogs)) return { valid: false, error: '"sipLogs" must be an array.' }
    for (let i = 0; i < obj.sipLogs.length; i++) {
      const l = obj.sipLogs[i] as Partial<SipLog> | null
      if (!l || typeof l !== 'object') return { valid: false, error: `SIP log at index ${i} is invalid.` }
      if (typeof l.id !== 'string' || !l.id.trim() || !isMonthKey(l.monthKey)) {
        return { valid: false, error: `SIP log at index ${i} has an invalid id or month key.` }
      }
      if (!Number.isInteger(l.amountPaise) || (l.amountPaise ?? -1) < 0) {
        return { valid: false, error: `SIP log '${l.id}' amount must be an integer >= 0.` }
      }
      if (l.date !== undefined && (typeof l.date !== 'string' || Number.isNaN(Date.parse(l.date)))) {
        return { valid: false, error: `SIP log '${l.id}' has an invalid date.` }
      }
      sipLogs.push({
        id: l.id,
        monthKey: l.monthKey,
        amountPaise: l.amountPaise!,
        date: l.date || new Date().toISOString(),
      })
    }
  }

  if (
    obj.settings !== undefined &&
    (!obj.settings || typeof obj.settings !== 'object' || Array.isArray(obj.settings))
  ) {
    return { valid: false, error: '"settings" must be an object.' }
  }
  const rawSettings = (obj.settings || {}) as Partial<Settings>
  for (const key of ['budget', 'pocketMoney'] as const) {
    const value = rawSettings[key]
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      return { valid: false, error: `Setting '${key}' must be an integer >= 0.` }
    }
  }
  if (
    rawSettings.receivedDay !== undefined &&
    (!Number.isInteger(rawSettings.receivedDay) || rawSettings.receivedDay < 1 || rawSettings.receivedDay > 31)
  ) {
    return { valid: false, error: "Setting 'receivedDay' must be an integer from 1 to 31." }
  }
  for (const key of ['reminder', 'warnings', 'pauseReminders', 'sipReminders', 'amoled'] as const) {
    const value = rawSettings[key]
    if (value !== undefined && typeof value !== 'boolean') {
      return { valid: false, error: `Setting '${key}' must be a boolean.` }
    }
  }
  if (rawSettings.theme !== undefined && !['dark', 'light', 'system'].includes(rawSettings.theme)) {
    return { valid: false, error: "Setting 'theme' must be 'dark', 'light', or 'system'." }
  }
  if (rawSettings.name !== undefined && typeof rawSettings.name !== 'string') {
    return { valid: false, error: "Setting 'name' must be a string." }
  }
  const numericSettings = [
    ['moneyMap', rawSettings.moneyMap],
    ['plannedEssentials', rawSettings.plannedEssentials],
    ['categoryLimits', rawSettings.categoryLimits],
  ] as const
  for (const [name, values] of numericSettings) {
    if (values === undefined) continue
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { valid: false, error: `Setting '${name}' must be an object.` }
    }
    for (const [key, value] of Object.entries(values)) {
      if (!Number.isInteger(value) || value < 0) {
        return { valid: false, error: `Setting '${name}.${key}' must be an integer >= 0.` }
      }
    }
  }
  const settings: Settings = {
    ...defaultSettings,
    ...rawSettings,
    moneyMap: { ...defaultSettings.moneyMap, ...(rawSettings.moneyMap || {}) },
    plannedEssentials: {
      ...defaultSettings.plannedEssentials,
      ...(rawSettings.plannedEssentials || {}),
    },
    categoryLimits: { ...(rawSettings.categoryLimits || {}) },
  }

  if (obj.assets !== undefined && (!obj.assets || typeof obj.assets !== 'object' || Array.isArray(obj.assets))) {
    return { valid: false, error: '"assets" must be an object.' }
  }
  const rawAssets = (obj.assets || {}) as Partial<Assets>
  for (const key of ['cashInHand', 'otherAssets', 'owed'] as const) {
    const value = rawAssets[key]
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      return { valid: false, error: `Asset '${key}' must be an integer >= 0.` }
    }
  }
  const assets: Assets = {
    cashInHand: Number.isInteger(rawAssets.cashInHand) ? Math.max(0, rawAssets.cashInHand!) : 0,
    otherAssets: Number.isInteger(rawAssets.otherAssets) ? Math.max(0, rawAssets.otherAssets!) : 0,
    owed: Number.isInteger(rawAssets.owed) ? Math.max(0, rawAssets.owed!) : 0,
  }

  const netWorthSnapshots: NetWorthSnapshot[] = []
  if (obj.netWorthSnapshots !== undefined) {
    if (!Array.isArray(obj.netWorthSnapshots)) {
      return { valid: false, error: '"netWorthSnapshots" must be an array.' }
    }
    for (let i = 0; i < obj.netWorthSnapshots.length; i++) {
      const snapshot = obj.netWorthSnapshots[i] as Partial<NetWorthSnapshot> | null
      if (
        !snapshot ||
        typeof snapshot !== 'object' ||
        !isMonthKey(snapshot.monthKey) ||
        !Number.isInteger(snapshot.netWorthPaise)
      ) {
        return { valid: false, error: `Net worth snapshot at index ${i} is invalid.` }
      }
      netWorthSnapshots.push({
        monthKey: snapshot.monthKey,
        netWorthPaise: snapshot.netWorthPaise!,
      })
    }
  }

  const rawChallenge = (obj.challenge || {}) as Partial<Challenge>
  const challenge: Challenge = {
    completed: Array.isArray(rawChallenge.completed)
      ? rawChallenge.completed.filter(n => Number.isInteger(n))
      : [],
    reflection: typeof rawChallenge.reflection === 'string' ? rawChallenge.reflection : '',
  }

  const rawSip = (obj.sipConfig || {}) as Partial<SipConfig>
  if (rawSip.linkedGoalId !== undefined && typeof rawSip.linkedGoalId === 'string') {
    if (!goalIds.has(rawSip.linkedGoalId)) {
      return { valid: false, error: `SIP config references non-existent linkedGoalId '${rawSip.linkedGoalId}'.` }
    }
  }
  const sipConfig: SipConfig = {
    amountPaise: Number.isInteger(rawSip.amountPaise) ? Math.max(0, rawSip.amountPaise!) : 50000,
    day: Number.isInteger(rawSip.day) ? Math.min(28, Math.max(1, rawSip.day!)) : 5,
    reminder: typeof rawSip.reminder === 'boolean' ? rawSip.reminder : true,
    linkedGoalId: rawSip.linkedGoalId,
  }

  const rawUi = (obj.ui || {}) as Partial<UIState>
  const ui: UIState = {
    dismissedInsightWeek: typeof rawUi.dismissedInsightWeek === 'string' ? rawUi.dismissedInsightWeek : '',
    triggeredBudgetAlerts: rawUi.triggeredBudgetAlerts && typeof rawUi.triggeredBudgetAlerts === 'object' ? rawUi.triggeredBudgetAlerts : {}
  }

  return {
    valid: true,
    isLegacyArray: false,
    counts: {
      expenses: (obj.expenses as unknown[]).length,
      goals: goals.length,
      contributions: contributions.length,
      pauseItems: pauseItems.length,
      sipLogs: sipLogs.length,
    },
    data: {
      schemaVersion: 2,
      expenses: obj.expenses as Expense[],
      settings,
      goals,
      contributions,
      pauseItems,
      sipConfig,
      sipLogs,
      assets,
      netWorthSnapshots,
      challenge,
      ui,
    },
  }
}

function initStore(): StoredData {
  try {
    const v2Data = storage.get<unknown>(STORE_KEY)
    if (v2Data) {
      const res = validateBackup(v2Data)
      if (res.valid) {
        return res.data
      }
    }

    // Migration from legacy schema (v1)
    const oldExpensesRaw = storage.get<Partial<Expense>[]>('spendly-expenses')
    const oldSettings = storage.get<Partial<Settings> & { challengeCompleted?: number[] }>('spendly-settings')
    if (oldExpensesRaw || oldSettings) {
      const oldExpenses: Expense[] = Array.isArray(oldExpensesRaw)
        ? oldExpensesRaw.map((e: Partial<Expense>) => ({
            id: e.id || crypto.randomUUID(),
            amount: e.amount || 0,
            category: e.category || 'Food',
            mode: e.mode || 'UPI',
            type: e.type || 'Need',
            note: e.note || '',
            date: e.date || new Date().toISOString(),
          }))
        : []
      const migratedSettings: Settings = {
        ...defaultSettings,
        ...(oldSettings || {}),
        moneyMap: { ...defaultSettings.moneyMap, ...(oldSettings?.moneyMap || {}) },
        plannedEssentials: { ...defaultSettings.plannedEssentials },
        categoryLimits: { ...(oldSettings?.categoryLimits || {}) },
      }

      const initialV2: StoredData = {
        schemaVersion: 2,
        expenses: oldExpenses,
        settings: migratedSettings,
        goals: [],
        contributions: [],
        pauseItems: [],
        sipConfig: { amountPaise: 50000, day: 5, reminder: true },
        sipLogs: [],
        assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
        netWorthSnapshots: [],
        challenge: {
          completed: Array.isArray(oldSettings?.challengeCompleted) ? oldSettings.challengeCompleted : [],
          reflection: '',
        },
        ui: { dismissedInsightWeek: '' },
      }

      const persistSuccess = storage.set(STORE_KEY, initialV2)
      if (persistSuccess) {
        storage.remove('spendly-expenses')
        storage.remove('spendly-settings')
        return initialV2
      } else {
        console.error('[ExpenseStore] Safe migration failed to persist v2 state. Preserving legacy data.')
      }
    }
  } catch (err) {
    console.error('Error loading Spendly store:', err)
  }

  // Fresh start
  return {
    schemaVersion: 2,
    expenses: [],
    settings: defaultSettings,
    goals: [],
    contributions: [],
    pauseItems: [],
    sipConfig: { amountPaise: 50000, day: 5, reminder: true },
    sipLogs: [],
    assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
    netWorthSnapshots: [],
    challenge: { completed: [], reflection: '' },
    ui: { dismissedInsightWeek: '' },
  }
}

export type Store = {
  expenses: Expense[]
  settings: Settings
  goals: Goal[]
  contributions: Contribution[]
  pauseItems: PauseItem[]
  sipConfig: SipConfig
  sipLogs: SipLog[]
  assets: Assets
  netWorthSnapshots: NetWorthSnapshot[]
  challenge: Challenge
  ui: UIState
  draft: Draft
  deleted?: Expense
  setDraft: Dispatch<SetStateAction<Draft>>
  save: () => boolean
  edit: (expense: Expense) => void
  remove: (id: string) => void
  undo: () => void
  updateSettings: (patch: Partial<Settings>) => void
  addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => void
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>) => void
  removeGoal: (id: string) => void
  addContribution: (goalId: string, amountPaise: number) => void
  addPauseItem: (name: string, pricePaise: number) => void
  decidePauseItem: (id: string, status: 'bought' | 'skipped') => void
  extendPauseItem: (id: string) => void
  removePauseItem: (id: string) => void
  updateSipConfig: (patch: Partial<SipConfig>) => void
  logSip: (amountPaise?: number) => boolean
  updateAssets: (patch: Partial<Assets>) => void
  recordNetWorthSnapshot: (monthKey: string, netWorthPaise: number) => void
  toggleChallengeDay: (dayIndex: number) => void
  setChallengeReflection: (reflection: string) => void
  dismissWeeklyInsight: (weekKey: string) => void
  loadDemoData: () => void
  removeDemoData: () => void
  clearAllData: () => void
  restoreValidatedData: (data: StoredData) => void
  exportAllData: () => string
}

const Context = createContext<Store | null>(null)

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoredData>(initStore)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [deleted, setDeleted] = useState<Expense>()

  // Persist whenever data changes & sync notifications
  useEffect(() => {
    const success = storage.set(STORE_KEY, data)
    if (!success) {
      console.error('[ExpenseStore] CRITICAL: Failed to persist data to storage!')
    }
    void syncNotifications(data, thresholdKey => {
      setData(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          triggeredBudgetAlerts: {
            ...(prev.ui.triggeredBudgetAlerts || {}),
            [thresholdKey]: true,
          },
        },
      }))
    })
  }, [data])

  // Monthly net worth snapshot upsert
  useEffect(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const goalAssets = data.contributions.reduce((s, c) => s + c.amountPaise, 0)
    const currentNetWorth = goalAssets + data.assets.cashInHand + data.assets.otherAssets - data.assets.owed
    const existing = data.netWorthSnapshots.find(s => s.monthKey === monthKey)

    if (!existing || existing.netWorthPaise !== currentNetWorth) {
      setData(prev => {
        const filtered = prev.netWorthSnapshots.filter(s => s.monthKey !== monthKey)
        const updated = [...filtered, { monthKey, netWorthPaise: currentNetWorth }].sort((a, b) =>
          a.monthKey.localeCompare(b.monthKey)
        )
        return {
          ...prev,
          netWorthSnapshots: updated,
        }
      })
    }
  }, [data.contributions, data.assets.cashInHand, data.assets.otherAssets, data.assets.owed])

  // Apply theme & AMOLED
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      document.documentElement.dataset.theme =
        data.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : data.settings.theme
      document.documentElement.dataset.amoled = data.settings.amoled ? 'true' : 'false'
      void syncStatusBar(data.settings.theme, data.settings.amoled)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [data.settings.theme, data.settings.amoled])

  const value = useMemo<Store>(
    () => ({
      expenses: data.expenses,
      settings: data.settings,
      goals: data.goals,
      contributions: data.contributions,
      pauseItems: data.pauseItems,
      sipConfig: data.sipConfig,
      sipLogs: data.sipLogs,
      assets: data.assets,
      netWorthSnapshots: data.netWorthSnapshots,
      challenge: data.challenge,
      ui: data.ui,
      draft,
      deleted,
      setDraft,
      save: () => {
        const amount = toPaise(draft.amountText)
        if (!amount) return false
        const expense: Expense = {
          id: draft.editId || crypto.randomUUID(),
          amount,
          category: draft.category,
          mode: draft.mode,
          type: draft.type || 'Need',
          note: draft.note.trim(),
          date: new Date(draft.date).toISOString(),
        }
        setData(prev => ({
          ...prev,
          expenses: [expense, ...prev.expenses.filter(e => e.id !== draft.editId)],
        }))
        setDraft(blankDraft())
        void hapticLight()
        return true
      },
      edit: (e: Expense) =>
        setDraft({
          editId: e.id,
          amountText: (e.amount / 100).toString(),
          category: e.category,
          mode: e.mode,
          type: e.type || 'Need',
          note: e.note,
          date: (() => {
            const d = new Date(e.date)
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
            return d.toISOString().slice(0, 16)
          })(),
        }),
      remove: (id: string) => {
        setData(prev => {
          const item = prev.expenses.find(e => e.id === id)
          if (item) setDeleted(item)
          return {
            ...prev,
            expenses: prev.expenses.filter(e => e.id !== id),
          }
        })
      },
      undo: () => {
        if (deleted) {
          setData(prev => ({ ...prev, expenses: [deleted, ...prev.expenses] }))
          setDeleted(undefined)
        }
      },
      updateSettings: (patch: Partial<Settings>) =>
        setData(prev => ({ ...prev, settings: { ...prev.settings, ...patch } })),
      addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => {
        const goal: Goal = {
          ...g,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        setData(prev => ({ ...prev, goals: [...prev.goals, goal] }))
        void hapticLight()
      },
      updateGoal: (id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>) => {
        setData(prev => ({
          ...prev,
          goals: prev.goals.map(g => (g.id === id ? { ...g, ...patch } : g)),
        }))
      },
      removeGoal: (id: string) => {
        setData(prev => ({
          ...prev,
          goals: prev.goals.filter(g => g.id !== id),
          contributions: prev.contributions.filter(c => c.goalId !== id),
        }))
      },
      addContribution: (goalId: string, amountPaise: number) => {
        if (amountPaise <= 0) return
        const contribution: Contribution = {
          id: crypto.randomUUID(),
          goalId,
          amountPaise,
          date: new Date().toISOString(),
        }
        setData(prev => ({
          ...prev,
          contributions: [contribution, ...prev.contributions],
        }))
        void hapticLight()
      },
      addPauseItem: (name: string, pricePaise: number) => {
        if (!name.trim() || pricePaise <= 0) return
        const now = new Date()
        const ready = new Date(now.getTime() + 24 * 3600000)
        const item: PauseItem = {
          id: crypto.randomUUID(),
          name: name.trim(),
          pricePaise,
          startedAt: now.toISOString(),
          readyAt: ready.toISOString(),
          status: 'waiting',
        }
        setData(prev => ({ ...prev, pauseItems: [item, ...prev.pauseItems] }))
      },
      decidePauseItem: (id: string, status: 'bought' | 'skipped') => {
        setData(prev => ({
          ...prev,
          pauseItems: prev.pauseItems.map(p =>
            p.id === id ? { ...p, status, decidedAt: new Date().toISOString() } : p
          ),
        }))
      },
      extendPauseItem: (id: string) => {
        setData(prev => ({
          ...prev,
          pauseItems: prev.pauseItems.map(p =>
            p.id === id
              ? {
                  ...p,
                  readyAt: new Date(Date.now() + 24 * 3600000).toISOString(),
                }
              : p
          ),
        }))
      },
      removePauseItem: (id: string) => {
        setData(prev => ({
          ...prev,
          pauseItems: prev.pauseItems.filter(p => p.id !== id),
        }))
      },
      updateSipConfig: (patch: Partial<SipConfig>) => {
        setData(prev => ({ ...prev, sipConfig: { ...prev.sipConfig, ...patch } }))
      },
      logSip: (customAmount?: number): boolean => {
        const now = new Date()
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        if (data.sipLogs.some(l => l.monthKey === monthKey)) {
          return false
        }
        const amountPaise = customAmount ?? data.sipConfig.amountPaise
        const sipLog: SipLog = {
          id: crypto.randomUUID(),
          monthKey,
          amountPaise,
          date: now.toISOString(),
        }
        setData(prev => {
          let nextContributions = prev.contributions
          if (prev.sipConfig.linkedGoalId) {
            const contribution: Contribution = {
              id: crypto.randomUUID(),
              goalId: prev.sipConfig.linkedGoalId,
              amountPaise,
              date: now.toISOString(),
            }
            nextContributions = [contribution, ...prev.contributions]
          }
          return {
            ...prev,
            sipLogs: [...prev.sipLogs, sipLog],
            contributions: nextContributions,
          }
        })
        return true
      },
      updateAssets: (patch: Partial<Assets>) => {
        setData(prev => ({ ...prev, assets: { ...prev.assets, ...patch } }))
      },
      recordNetWorthSnapshot: (monthKey: string, netWorthPaise: number) => {
        setData(prev => ({
          ...prev,
          netWorthSnapshots: [
            ...prev.netWorthSnapshots.filter(s => s.monthKey !== monthKey),
            { monthKey, netWorthPaise },
          ].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
        }))
      },
      toggleChallengeDay: (dayIndex: number) => {
        setData(prev => {
          const exists = prev.challenge.completed.includes(dayIndex)
          const nextCompleted = exists
            ? prev.challenge.completed.filter(d => d !== dayIndex)
            : [...prev.challenge.completed, dayIndex]
          return {
            ...prev,
            challenge: { ...prev.challenge, completed: nextCompleted },
          }
        })
        void hapticLight()
      },
      setChallengeReflection: (reflection: string) => {
        setData(prev => ({
          ...prev,
          challenge: { ...prev.challenge, reflection },
        }))
      },
      dismissWeeklyInsight: (weekKey: string) => {
        setData(prev => ({ ...prev, ui: { ...prev.ui, dismissedInsightWeek: weekKey } }))
      },
      loadDemoData: () => {
        setData({
          schemaVersion: 2,
          expenses: sampleExpenses,
          settings: sampleSettings,
          goals: sampleGoals,
          contributions: sampleContributions,
          pauseItems: samplePauseItems,
          sipConfig: sampleSipConfig,
          sipLogs: sampleSipLogs,
          assets: sampleAssets,
          netWorthSnapshots: sampleNetWorthSnapshots,
          challenge: sampleChallenge,
          ui: { dismissedInsightWeek: '' },
        })
      },
      removeDemoData: () => {
        setData({
          schemaVersion: 2,
          expenses: [],
          settings: { ...defaultSettings, name: '' },
          goals: [],
          contributions: [],
          pauseItems: [],
          sipConfig: { amountPaise: 50000, day: 5, reminder: true },
          sipLogs: [],
          assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
          netWorthSnapshots: [],
          challenge: { completed: [], reflection: '' },
          ui: { dismissedInsightWeek: '' },
        })
      },
      clearAllData: () => {
        setData({
          schemaVersion: 2,
          expenses: [],
          settings: { ...defaultSettings, name: '' },
          goals: [],
          contributions: [],
          pauseItems: [],
          sipConfig: { amountPaise: 50000, day: 5, reminder: true },
          sipLogs: [],
          assets: { cashInHand: 0, otherAssets: 0, owed: 0 },
          netWorthSnapshots: [],
          challenge: { completed: [], reflection: '' },
          ui: { dismissedInsightWeek: '' },
        })
      },
      restoreValidatedData: (validData: StoredData) => {
        setData(validData)
      },
      exportAllData: () => {
        const payload = {
          version: 2,
          exportedAt: new Date().toISOString(),
          expenses: data.expenses,
          settings: data.settings,
          goals: data.goals,
          contributions: data.contributions,
          pauseItems: data.pauseItems,
          sipConfig: data.sipConfig,
          sipLogs: data.sipLogs,
          assets: data.assets,
          netWorthSnapshots: data.netWorthSnapshots,
          challenge: data.challenge,
          ui: data.ui,
        }
        return JSON.stringify(payload, null, 2)
      },
    }),
    [data, draft, deleted]
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useExpenses = () => {
  const value = useContext(Context)
  if (!value) throw new Error('useExpenses must be used within ExpenseProvider')
  return value
}
