import type {
  Category,
  Contribution,
  Expense,
  MoneyBucket,
  PauseItem,
  PlannedEssentialCategory,
  Settings,
} from '../data/types'
import { toPaise } from '../data/types'

export { toPaise }

export function isThisMonth(dateStrOrObj: string | Date, now = new Date()): boolean {
  const d = new Date(dateStrOrObj)
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export function currentMonthExpenses(expenses: Expense[], now = new Date()): Expense[] {
  return expenses.filter(e => isThisMonth(e.date, now))
}

export function currentMonthContributions(contributions: Contribution[], now = new Date()): Contribution[] {
  return contributions.filter(c => isThisMonth(c.date, now))
}

export function getGoalSavedPaise(goalId: string, contributions: Contribution[]): number {
  return contributions
    .filter(c => c.goalId === goalId)
    .reduce((sum, c) => sum + c.amountPaise, 0)
}

export function getMonthlyEssentials(expenses: Expense[], settings: Settings): number {
  const needExpenses = expenses.filter(e => (e.type || 'Need') === 'Need')
  const planned = settings.plannedEssentials
  const fallback =
    (planned.Travel ?? 70000) +
    (planned.Food ?? 150000) +
    (planned['Phone & Data'] ?? 30000) +
    (planned.Academic ?? 60000)

  if (needExpenses.length === 0) {
    return fallback
  }

  const monthlyTotals: Record<string, number> = {}
  for (const e of needExpenses) {
    const d = new Date(e.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyTotals[key] = (monthlyTotals[key] || 0) + e.amount
  }

  const sortedMonthKeys = Object.keys(monthlyTotals).sort().reverse()
  const lastMonths = sortedMonthKeys.slice(0, 3)
  if (lastMonths.length === 0) {
    return fallback
  }

  const sum = lastMonths.reduce((total, key) => total + monthlyTotals[key], 0)
  return Math.round(sum / lastMonths.length)
}

export function monthlySummary(
  expenses: Expense[],
  contributions: Contribution[],
  settings: Settings,
  now = new Date()
) {
  const monthExpenses = currentMonthExpenses(expenses, now)
  const spent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const saved = currentMonthContributions(contributions, now).reduce((sum, c) => sum + c.amountPaise, 0)
  const received = settings.pocketMoney
  const remaining = received - spent - saved
  return { received, spent, saved, remaining }
}

export function moneyMapActuals(
  expenses: Expense[],
  contributions: Contribution[],
  settings: Settings,
  now = new Date()
): Record<MoneyBucket, number> {
  const monthSaved = currentMonthContributions(contributions, now).reduce((sum, c) => sum + c.amountPaise, 0)
  const totals: Record<MoneyBucket, number> = {
    Essentials: 0,
    Savings: monthSaved,
    Skills: 0,
    Enjoyment: 0,
    Unexpected: 0,
  }

  currentMonthExpenses(expenses, now).forEach(expense => {
    if (expense.category === 'Skills/Learning') {
      totals.Skills += expense.amount
    } else if (expense.category === 'Other') {
      totals.Unexpected += expense.amount
    } else if (expense.type === 'Want') {
      totals.Enjoyment += expense.amount
    } else {
      totals.Essentials += expense.amount
    }
  })

  const base = settings.pocketMoney
  return {
    Essentials: base > 0 ? Math.round((totals.Essentials / base) * 100) : 0,
    Savings: base > 0 ? Math.round((totals.Savings / base) * 100) : 0,
    Skills: base > 0 ? Math.round((totals.Skills / base) * 100) : 0,
    Enjoyment: base > 0 ? Math.round((totals.Enjoyment / base) * 100) : 0,
    Unexpected: base > 0 ? Math.round((totals.Unexpected / base) * 100) : 0,
  }
}

export function calculateLoggingStreak(expenses: Expense[], now = new Date()): number {
  if (expenses.length === 0) return 0
  const dateSet = new Set(
    expenses.map(e => {
      const d = new Date(e.date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )

  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let checkDate = new Date(now)
  let streak = 0

  if (dateSet.has(toKey(checkDate))) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
    while (dateSet.has(toKey(checkDate))) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }
    return streak
  }

  checkDate.setDate(checkDate.getDate() - 1)
  if (dateSet.has(toKey(checkDate))) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
    while (dateSet.has(toKey(checkDate))) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }
    return streak
  }

  return 0
}

export function getCalendarWeekRange(d = new Date()): { start: Date; end: Date; weekKey: string } {
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  // Thursday in current week decides the ISO week-year
  const dayNum = target.getDay() || 7
  target.setDate(target.getDate() + 4 - dayNum)
  const year = target.getFullYear()

  const yearStart = new Date(year, 0, 1)
  const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7)

  // Find Monday of current week
  const monday = new Date(d)
  const day = monday.getDay()
  const diffToMonday = monday.getDate() - day + (day === 0 ? -6 : 1)
  monday.setDate(diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

  return { start: monday, end: sunday, weekKey }
}

export function getWeekKey(d = new Date()): string {
  return getCalendarWeekRange(d).weekKey
}

export type WeeklyInsight = {
  type: 'wants_increase' | 'top_category' | 'no_spend_days'
  title: string
  subtitle: string
  actionLabel?: string
}

export function computeWeeklyInsight(
  expenses: Expense[],
  dismissedWeek?: string,
  now = new Date()
): WeeklyInsight | null {
  const currentRange = getCalendarWeekRange(now)
  if (dismissedWeek === currentRange.weekKey) return null
  if (expenses.length < 3) return null

  const prevDate = new Date(currentRange.start)
  prevDate.setDate(prevDate.getDate() - 7)
  const prevRange = getCalendarWeekRange(prevDate)

  const thisWeekExpenses = expenses.filter(e => {
    const t = new Date(e.date).getTime()
    return t >= currentRange.start.getTime() && t <= currentRange.end.getTime()
  })
  const lastWeekExpenses = expenses.filter(e => {
    const t = new Date(e.date).getTime()
    return t >= prevRange.start.getTime() && t <= prevRange.end.getTime()
  })

  if (thisWeekExpenses.length === 0) return null

  const thisWeekWants = thisWeekExpenses.filter(e => e.type === 'Want').reduce((s, e) => s + e.amount, 0)
  const lastWeekWants = lastWeekExpenses.filter(e => e.type === 'Want').reduce((s, e) => s + e.amount, 0)

  if (lastWeekWants > 0 && thisWeekWants > lastWeekWants) {
    const pct = Math.round(((thisWeekWants - lastWeekWants) / lastWeekWants) * 100)
    return {
      type: 'wants_increase',
      title: `You spent ${pct}% more on Wants this week`,
      subtitle: 'A small limit can make next week feel easier.',
      actionLabel: 'Set a limit',
    }
  }

  const thisWeekTotal = thisWeekExpenses.reduce((s, e) => s + e.amount, 0)
  if (thisWeekTotal > 0) {
    const catTotals: Record<string, number> = {}
    for (const e of thisWeekExpenses) {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount
    }
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0 && sorted[0][1] / thisWeekTotal >= 0.4) {
      const pct = Math.round((sorted[0][1] / thisWeekTotal) * 100)
      return {
        type: 'top_category',
        title: `${sorted[0][0]} made up ${pct}% of your spending this week`,
        subtitle: `Review your ${sorted[0][0]} expenses to stay on track.`,
        actionLabel: 'Check limits',
      }
    }
  }

  const daysWithSpending = new Set(
    thisWeekExpenses.map(e => new Date(e.date).toDateString())
  ).size
  const noSpendDays = Math.max(0, 7 - daysWithSpending)
  if (noSpendDays >= 2) {
    return {
      type: 'no_spend_days',
      title: `You had ${noSpendDays} no-spend days this week`,
      subtitle: 'Giving your wallet a break is a great habit to maintain.',
    }
  }

  return null
}

export function savedByWaitingThisMonth(pauseItems: PauseItem[], now = new Date()): number {
  return pauseItems
    .filter(p => p.status === 'skipped' && isThisMonth(p.decidedAt || p.startedAt, now))
    .reduce((sum, p) => sum + p.pricePaise, 0)
}

export function getCategoryOverLimit(
  expenses: Expense[],
  categoryLimits: Partial<Record<Category, number>>,
  now = new Date()
): [Category, number, number] | null {
  for (const [cat, limit] of Object.entries(categoryLimits) as [Category, number | undefined][]) {
    if (!limit || limit <= 0) continue
    const spent = expenses
      .filter(e => e.category === cat && isThisMonth(e.date, now))
      .reduce((sum, e) => sum + e.amount, 0)
    if (spent > limit) {
      return [cat, limit, spent]
    }
  }
  return null
}

export function getPlannedEssentialsActuals(
  expenses: Expense[],
  now = new Date()
): Record<PlannedEssentialCategory, number> {
  const result: Record<PlannedEssentialCategory, number> = {
    Travel: 0,
    Food: 0,
    'Phone & Data': 0,
    Academic: 0,
  }
  currentMonthExpenses(expenses, now).forEach(e => {
    if (e.category === 'Travel') result.Travel += e.amount
    else if (e.category === 'Food') result.Food += e.amount
    else if (e.category === 'Phone & Data') result['Phone & Data'] += e.amount
    else if (e.category === 'Academic') result.Academic += e.amount
  })
  return result
}
