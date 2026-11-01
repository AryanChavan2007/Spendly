import type {
  Assets,
  Challenge,
  Contribution,
  Expense,
  Goal,
  NetWorthSnapshot,
  PauseItem,
  Settings,
  SipConfig,
  SipLog,
} from './types'

const at = (d: number, h: number, m = 0) => {
  const x = new Date()
  x.setDate(x.getDate() - d)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}

export const sampleExpenses: Expense[] = [
  ['1', 26500, 'Food', 'UPI', 'Need', 'Campus lunch', 0, 13],
  ['2', 6000, 'Travel', 'Cash', 'Need', 'Bus fare', 0, 9],
  ['3', 79900, 'Skills/Learning', 'Card', 'Goal', 'Design course', 1, 19],
  ['4', 14900, 'Entertainment', 'UPI', 'Want', 'Movie', 1, 17],
  ['5', 29900, 'Phone & Data', 'UPI', 'Need', 'Data recharge', 2, 11],
  ['6', 8500, 'Food', 'Cash', 'Want', 'Coffee', 2, 16],
  ['7', 45000, 'Academic', 'Card', 'Need', 'Reference books', 3, 14],
  ['8', 12000, 'Travel', 'UPI', 'Need', 'Metro card', 4, 8],
  ['9', 59900, 'Shopping', 'Card', 'Want', 'College bag', 5, 18],
  ['10', 18000, 'Food', 'UPI', 'Need', 'Groceries', 6, 12],
  ['11', 25000, 'Skills/Learning', 'Net Banking', 'Goal', 'Workshop', 7, 10],
  ['12', 9000, 'Other', 'Cash', 'Want', 'Birthday gift', 8, 17],
  ['13', 16000, 'Entertainment', 'UPI', 'Want', 'Concert pass', 9, 20],
  ['14', 7500, 'Travel', 'Cash', 'Need', 'Auto', 10, 9],
  ['15', 22000, 'Academic', 'UPI', 'Need', 'Lab supplies', 11, 15],
].map(([id, amount, category, mode, type, note, d, h]) => ({
  id: String(id),
  amount: Number(amount),
  category: category as Expense['category'],
  mode: mode as Expense['mode'],
  type: type as Expense['type'],
  note: String(note),
  date: at(Number(d), Number(h)),
}))

export const sampleGoals: Goal[] = [
  {
    id: 'demo-goal-course',
    name: 'Course fee',
    targetPaise: 300000,
    level: 3,
    isEmergency: false,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-goal-emergency',
    name: 'Emergency buffer',
    targetPaise: 500000,
    level: 5,
    isEmergency: true,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
]

export const sampleContributions: Contribution[] = [
  {
    id: 'demo-c1',
    goalId: 'demo-goal-course',
    amountPaise: 125000,
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'demo-c2',
    goalId: 'demo-goal-emergency',
    amountPaise: 180000,
    date: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
]

export const samplePauseItems: PauseItem[] = [
  {
    id: 'demo-pause-1',
    name: 'Wireless headphones',
    pricePaise: 129900,
    startedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
    readyAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    status: 'waiting',
  },
  {
    id: 'demo-pause-2',
    name: 'Oversized hoodie',
    pricePaise: 89900,
    startedAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    readyAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'waiting',
  },
  {
    id: 'demo-pause-3',
    name: 'Vintage jacket',
    pricePaise: 65000,
    startedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    readyAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'skipped',
    decidedAt: new Date(Date.now() - 23 * 3600000).toISOString(),
  },
]

export const sampleSipConfig: SipConfig = {
  amountPaise: 50000,
  day: 5,
  reminder: true,
  linkedGoalId: 'demo-goal-course',
}

export const sampleSipLogs: SipLog[] = [
  {
    id: 'demo-sip-1',
    monthKey: '2026-08',
    amountPaise: 50000,
    date: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'demo-sip-2',
    monthKey: '2026-09',
    amountPaise: 50000,
    date: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-sip-3',
    monthKey: '2026-10',
    amountPaise: 50000,
    date: new Date().toISOString(),
  },
]

export const sampleAssets: Assets = {
  cashInHand: 250000,
  otherAssets: 100000,
  owed: 120000,
}

export const sampleNetWorthSnapshots: NetWorthSnapshot[] = [
  { monthKey: '2026-06', netWorthPaise: 260000 },
  { monthKey: '2026-07', netWorthPaise: 290000 },
  { monthKey: '2026-08', netWorthPaise: 315000 },
  { monthKey: '2026-09', netWorthPaise: 340000 },
  { monthKey: '2026-10', netWorthPaise: 535000 },
]

export const sampleChallenge: Challenge = {
  completed: [0, 1],
  reflection: 'Tracking small purchases daily opened my eyes to where pocket money was leaking.',
}

export const sampleSettings: Settings = {
  budget: 500000,
  pocketMoney: 500000,
  receivedDay: 1,
  categoryLimits: { Food: 150000, Shopping: 80000 },
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
  name: 'Aryan',
  moneyMap: {
    Essentials: 45,
    Savings: 20,
    Skills: 15,
    Enjoyment: 15,
    Unexpected: 5,
  },
}
