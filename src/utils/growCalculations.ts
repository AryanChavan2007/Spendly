import type { SipLog } from '../data/types'
import { formatMoney } from '../components/ui'

export type ScenarioRate = 6 | 10 | 14
export type ProjectionPoint = { year: number; contributed: number; growth: number; corpus: number }

export function projectMonthlyInvesting(
  monthlyPaise: number,
  years: number,
  annualRate: number,
  stepUpPercent = 0
): ProjectionPoint[] {
  const monthlyRate = annualRate / 100 / 12
  let corpus = 0
  let contributed = 0
  let currentMonthly = monthlyPaise
  const points: ProjectionPoint[] = []

  for (let month = 1; month <= years * 12; month++) {
    corpus = (corpus + currentMonthly) * (1 + monthlyRate)
    contributed += currentMonthly
    if (month % 12 === 0) {
      points.push({
        year: month / 12,
        contributed: Math.round(contributed),
        growth: Math.max(0, Math.round(corpus - contributed)),
        corpus: Math.round(corpus),
      })
      currentMonthly = Math.round(currentMonthly * (1 + stepUpPercent / 100))
    }
  }
  return points
}

export function monthlyNeededForTarget(
  targetPaise: number,
  years: number,
  annualRate: number,
  stepUpPercent = 0
): number {
  let low = 0
  let high = targetPaise
  for (let i = 0; i < 50; i++) {
    const mid = Math.round((low + high) / 2)
    const result = projectMonthlyInvesting(mid, years, annualRate, stepUpPercent).at(-1)?.corpus || 0
    if (result < targetPaise) low = mid
    else high = mid
  }
  return high
}

export function valueInTodaysMoney(nominalPaise: number, years: number, inflationPercent = 6): number {
  if (years <= 0) return nominalPaise
  return Math.round(nominalPaise / Math.pow(1 + inflationPercent / 100, years))
}

export function costOfWaiting(
  monthlyPaise: number,
  years: number,
  annualRate: number,
  stepUpPercent = 0,
  delayYears = 2
) {
  const now = projectMonthlyInvesting(monthlyPaise, years, annualRate, stepUpPercent).at(-1)?.corpus || 0
  const later =
    projectMonthlyInvesting(monthlyPaise, Math.max(0, years - delayYears), annualRate, stepUpPercent).at(-1)
      ?.corpus || 0
  return { now, later, difference: Math.max(0, now - later) }
}

export function effectiveAnnualInterest(
  cashPricePaise: number,
  monthlyEmiPaise: number,
  months: number,
  feePaise = 0
): number {
  const financed = cashPricePaise - feePaise
  if (financed <= 0 || monthlyEmiPaise * months <= cashPricePaise || months <= 0) return 0

  let low = 0
  let high = 1
  for (let i = 0; i < 80; i++) {
    const rate = (low + high) / 2
    const presentValue = (monthlyEmiPaise * (1 - Math.pow(1 + rate, -months))) / rate
    if (presentValue > financed) low = rate
    else high = rate
  }
  return (Math.pow(1 + high, 12) - 1) * 100
}

export function purchaseComparison(
  cashPaise: number,
  emiPaise: number,
  months: number,
  feePaise: number,
  monthlySavingsPaise: number
) {
  const totalPaid = emiPaise * months + feePaise
  const extraCost = Math.max(0, totalPaid - cashPaise)
  const effectiveAnnualRate = effectiveAnnualInterest(cashPaise, emiPaise, months, feePaise)

  const monthsToSave =
    monthlySavingsPaise > 0 ? Math.ceil(cashPaise / monthlySavingsPaise) : 0
  const monthsToSaveText =
    monthlySavingsPaise > 0 ? `${monthsToSave} months` : 'Set a savings plan first'

  return {
    totalPaid,
    extraCost,
    effectiveAnnualRate,
    monthsToSave,
    monthsToSaveText,
  }
}

export type ReadinessInputs = {
  emergencySaved: number
  monthlyEssentials: number
  loggedDays: number
  stayedInBudget: boolean
  goalProgress: number
  hasHighInterestDebt: boolean
  hasEmergencyGoal: boolean
}

export function readinessScore(input: ReadinessInputs) {
  const bufferMonths = input.monthlyEssentials > 0 ? input.emergencySaved / input.monthlyEssentials : 0

  // 1. Emergency buffer (up to 3 months): 35 points max
  const bufferScore = Math.min(35, (bufferMonths / 3) * 35)

  // 2. Consistent tracking: up to 30 days: 25 points max
  const trackingScore = Math.min(25, (input.loggedDays / 30) * 25)

  // 3. Stayed in budget (spent + saved <= pocket money): 20 points
  const budgetScore = input.stayedInBudget ? 20 : 0

  // 4. Savings goal progress: 20 points max
  const goalScore = Math.min(20, input.goalProgress * 20)

  let raw = bufferScore + trackingScore + budgetScore + goalScore
  if (input.hasHighInterestDebt) {
    raw = Math.max(0, raw - 20)
  }

  const score = Math.round(Math.min(100, Math.max(0, raw)))
  const level = score < 40 ? 'Build your base' : score < 75 ? 'Getting ready' : 'Ready to practice'

  let nextAction = ''
  if (!input.hasEmergencyGoal) {
    nextAction = 'Create an emergency buffer goal'
  } else if (bufferMonths < 3) {
    const needed = Math.max(0, Math.round(3 * input.monthlyEssentials - input.emergencySaved))
    nextAction = `Add ${formatMoney(needed)} to reach 3 months of emergency buffer`
  } else if (input.hasHighInterestDebt) {
    nextAction = 'Focus on clearing high-interest debt first'
  } else if (input.loggedDays < 15) {
    nextAction = 'Log expenses consistently for at least 15 days this month'
  } else if (!input.stayedInBudget) {
    nextAction = 'Keep total spending and saving within your pocket money'
  } else if (input.goalProgress < 0.5) {
    nextAction = 'Keep contributing to reach 50% on your savings goals'
  } else {
    nextAction = 'You’re in great shape! Practice monthly SIP and maintain your habits'
  }

  return { score, level, bufferMonths, nextAction }
}

export function computeVirtualCorpus(sipLogs: SipLog[]): {
  virtualCorpus: number
  totalContributed: number
  series: { monthKey: string; corpus: number }[]
} {
  if (sipLogs.length === 0) {
    return { virtualCorpus: 0, totalContributed: 0, series: [] }
  }

  const sorted = [...sipLogs].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  const monthlyRate = 0.1 / 12
  let corpus = 0
  let totalContributed = 0
  const series: { monthKey: string; corpus: number }[] = []

  let prevYear: number | null = null
  let prevMonth: number | null = null

  for (const log of sorted) {
    const [yStr, mStr] = log.monthKey.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)

    if (prevYear !== null && prevMonth !== null) {
      const monthDiff = (y - prevYear) * 12 + (m - prevMonth)
      if (monthDiff > 1) {
        for (let i = 1; i < monthDiff; i++) {
          corpus = corpus * (1 + monthlyRate)
        }
      }
    }

    corpus = (corpus + log.amountPaise) * (1 + monthlyRate)
    totalContributed += log.amountPaise
    series.push({ monthKey: log.monthKey, corpus: Math.round(corpus) })

    prevYear = y
    prevMonth = m
  }

  return {
    virtualCorpus: Math.round(corpus),
    totalContributed,
    series,
  }
}

export function calculateSipStreak(sipLogs: SipLog[], now = new Date()): number {
  if (sipLogs.length === 0) return 0
  const loggedMonths = new Set(sipLogs.map(l => l.monthKey))

  let year = now.getFullYear()
  let month = now.getMonth() + 1
  const currentKey = `${year}-${String(month).padStart(2, '0')}`

  let checkKey = currentKey
  if (!loggedMonths.has(checkKey)) {
    month--
    if (month === 0) {
      month = 12
      year--
    }
    checkKey = `${year}-${String(month).padStart(2, '0')}`
  }

  let streak = 0
  while (loggedMonths.has(checkKey)) {
    streak++
    month--
    if (month === 0) {
      month = 12
      year--
    }
    checkKey = `${year}-${String(month).padStart(2, '0')}`
  }

  return streak
}
