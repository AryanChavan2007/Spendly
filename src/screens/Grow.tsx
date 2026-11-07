import { useMemo, useState } from 'react'
import { Button, formatMoney, Input, MoneyInput, Title } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import { calculatePortfolioValuePaise } from '../investment/investmentCalculations'
import { Investments } from './Investments'
import {
  getGoalSavedPaise,
  getMonthlyEssentials,
  isThisMonth,
  calculateNetWorthPaise,
  monthlySummary,
} from '../utils/financeSummary'
import {
  calculateSipStreak,
  computeVirtualCorpus,
  costOfWaiting,
  monthlyNeededForTarget,
  projectMonthlyInvesting,
  purchaseComparison,
  readinessScore,
  valueInTodaysMoney,
  type ScenarioRate,
} from '../utils/growCalculations'

const levels = [
  ['Speculation / high risk', 'Money here can move sharply and losses may be substantial.'],
  ['Growth investments', 'Designed for long horizons, with meaningful ups and downs along the way.'],
  ['Lower-risk investments', 'May reduce volatility, but value and returns can still change.'],
  ['Savings & liquidity', 'Money kept accessible for near-term needs and planned goals.'],
  ['Safety & security', 'Your emergency buffer and financial protection form the foundation.'],
]

export function Grow() {
  const {
    expenses,
    settings,
    goals,
    contributions,
    sipConfig,
    sipLogs,
    assets,
    investmentInstruments,
    investmentTransactions,
    investmentCashMovements,
    investmentValuations,
    netWorthSnapshots,
    updateSipConfig,
    logSip,
    updateAssets,
    addPauseItem,
  } = useExpenses()
  const [investmentsOpen, setInvestmentsOpen] = useState(false)

  // Planner state with clamping
  const [mode, setMode] = useState<'future' | 'needed'>('future')
  const [monthly, setMonthly] = useState(50000)
  const [target, setTarget] = useState(5000000)
  const [rawYears, setRawYears] = useState(8)
  const [rawStep, setRawStep] = useState(5)
  const [inflation, setInflation] = useState(true)
  const [scenario, setScenario] = useState<ScenarioRate>(10)

  // Clamped values
  const years = Math.min(30, Math.max(1, rawYears || 1))
  const step = Math.min(50, Math.max(0, rawStep || 0))
  const yearsClamped = rawYears < 1 || rawYears > 30
  const stepClamped = rawStep < 0 || rawStep > 50

  // Readiness state
  const [debt, setDebt] = useState(false)
  const [targetText, setTargetText] = useState('Higher education')
  const [horizon, setHorizon] = useState('3+ years')
  const [risk, setRisk] = useState('medium')
  const [understands, setUnderstands] = useState(false)

  // Smart purchase check state (Default matches sanity check: cash 30,000, EMI 2,000, 18m, fee 0)
  const [item, setItem] = useState('Laptop')
  const [cash, setCash] = useState(3000000)
  const [emi, setEmi] = useState(200000)
  const [months, setMonths] = useState(18)
  const [fee, setFee] = useState(0)
  const [addedToPause, setAddedToPause] = useState(false)

  // Pyramid level state
  const [selectedLevel, setSelectedLevel] = useState(4)

  // Calculations
  const emergencyGoal = goals.find(g => g.isEmergency)
  const emergencySaved = emergencyGoal ? getGoalSavedPaise(emergencyGoal.id, contributions) : 0
  const monthlyEssentials = getMonthlyEssentials(expenses, settings)

  const summary = monthlySummary(expenses, contributions, settings, investmentCashMovements)
  const monthSpent = summary.spent
  const monthSaved = summary.saved
  const stayedInBudget = monthSpent + monthSaved <= settings.pocketMoney

  const loggedDays = new Set(
    expenses
      .filter(e => Date.now() - +new Date(e.date) < 30 * 86400000)
      .map(e => new Date(e.date).toDateString())
  ).size

  const goalAvgProgress =
    goals.length > 0
      ? goals.reduce((sum, g) => {
          const s = getGoalSavedPaise(g.id, contributions)
          return sum + (g.targetPaise > 0 ? Math.min(1, s / g.targetPaise) : 0)
        }, 0) / goals.length
      : 0

  const readiness = readinessScore({
    emergencySaved,
    monthlyEssentials,
    loggedDays,
    stayedInBudget,
    goalProgress: goalAvgProgress,
    hasHighInterestDebt: debt,
    hasEmergencyGoal: Boolean(emergencyGoal),
  })

  // Real monthly savings capacity based on pocket money & moneyMap.Savings %
  const monthlySavingsCapacity = Math.round((settings.pocketMoney * (settings.moneyMap.Savings || 0)) / 100)
  const purchase = purchaseComparison(cash, emi, months, fee, monthlySavingsCapacity)

  // SIP calculations
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isLoggedThisMonth = sipLogs.some(l => l.monthKey === currentMonthKey)
  const sipStreak = calculateSipStreak(sipLogs)
  const sipCorpusData = computeVirtualCorpus(sipLogs)

  const nextDue = useMemo(() => {
    const d = new Date()
    d.setDate(sipConfig.day)
    if (d <= new Date()) d.setMonth(d.getMonth() + 1)
    return d
  }, [sipConfig.day])

  // Planner calculations memoized
  const usedMonthly = useMemo(() => {
    return mode === 'needed'
      ? monthlyNeededForTarget(target, years, scenario, step)
      : Math.max(0, monthly)
  }, [mode, target, years, scenario, step, monthly])

  const scenarios = useMemo(() => {
    return ([6, 10, 14] as ScenarioRate[]).map(rate => ({
      rate,
      result: projectMonthlyInvesting(
        mode === 'needed' ? monthlyNeededForTarget(target, years, rate, step) : Math.max(0, monthly),
        years,
        rate,
        step
      ).at(-1),
    }))
  }, [mode, target, years, step, monthly])

  const selectedSeries = useMemo(() => {
    return projectMonthlyInvesting(usedMonthly, years, scenario, step)
  }, [usedMonthly, years, scenario, step])

  const result = selectedSeries.at(-1)
  const wait = useMemo(() => costOfWaiting(usedMonthly, years, scenario, step), [usedMonthly, years, scenario, step])
  const maxChart = Math.max(...selectedSeries.map(x => x.corpus), 1)

  // Net worth calculation
  const goalAssets = contributions.reduce((n, c) => n + c.amountPaise, 0)
  const investmentAssets = calculatePortfolioValuePaise(investmentTransactions, investmentValuations)
  const netWorth = calculateNetWorthPaise(
    goalAssets,
    assets.cashInHand,
    assets.otherAssets,
    assets.owed,
    investmentAssets
  )

  const handleSmartPurchaseAddToPause = () => {
    if (cash > 0) {
      addPauseItem(item.trim() || 'New purchase', cash)
      setAddedToPause(true)
      setTimeout(() => setAddedToPause(false), 2500)
    }
  }

  if (investmentsOpen) {
    return <Investments onBack={() => setInvestmentsOpen(false)} />
  }

  return (
    <div className="page grow-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Learn with zero risk</p>
          <Title>Grow</Title>
        </div>
        <Button className="secondary" onClick={() => setInvestmentsOpen(true)}>Investments</Button>
      </header>
      <div className="education-banner">
        Educational tools only. Numbers are hypothetical—not recommendations or promised returns.
      </div>

      {/* Investment Planner */}
      <article className="card grow-section">
        <div className="section-title top">
          <div>
            <p className="label">Investment planner</p>
            <h2>Plan with a range, not a promise</h2>
          </div>
        </div>

        <div className="segment planner-mode">
          <Button className={mode === 'future' ? 'selected' : ''} onClick={() => setMode('future')}>
            How much will I have?
          </Button>
          <Button className={mode === 'needed' ? 'selected' : ''} onClick={() => setMode('needed')}>
            What monthly amount do I need?
          </Button>
        </div>

        {mode === 'needed' && (
          <label className="grow-field">
            Target amount
            <div className="money-input">
              <span>₹</span>
              <MoneyInput valuePaise={target} onChangePaise={p => setTarget(Math.max(0, p))} />
            </div>
          </label>
        )}

        {mode === 'future' && (
          <div className="quick-picks">
            <Button onClick={() => setMonthly(10000)}>₹100</Button>
            <Button onClick={() => setMonthly(25000)}>₹250</Button>
            <Button onClick={() => setMonthly(50000)}>₹500</Button>
            <div className="money-input" style={{ marginTop: 0 }}>
              <span>₹</span>
              <MoneyInput
                aria-label="Custom monthly amount"
                valuePaise={monthly}
                onChangePaise={p => setMonthly(Math.max(0, p))}
              />
            </div>
          </div>
        )}

        {mode === 'needed' && (
          <div className="needed-amount">
            <small>Monthly amount needed</small>
            <strong>{formatMoney(usedMonthly)}</strong>
          </div>
        )}

        <div className="planner-inputs">
          <label>
            Years (1–30)
            <Input
              type="number"
              min="1"
              max="30"
              value={rawYears}
              onChange={e => setRawYears(Number(e.target.value))}
            />
            {yearsClamped && <span className="error-text" style={{ fontSize: 9 }}>Clamped to 1–30 years</span>}
          </label>
          <label>
            Yearly step-up % (0–50%)
            <Input
              type="number"
              min="0"
              max="50"
              value={rawStep}
              onChange={e => setRawStep(Number(e.target.value))}
            />
            {stepClamped && <span className="error-text" style={{ fontSize: 9 }}>Clamped to 0–50%</span>}
          </label>
        </div>

        <label className="check-row">
          <input type="checkbox" checked={inflation} onChange={e => setInflation(e.target.checked)} />
          Show today’s money using 6% inflation
        </label>

        <div className="scenario-chips">
          {scenarios.map(s => (
            <Button
              key={s.rate}
              className={scenario === s.rate ? 'active' : ''}
              onClick={() => setScenario(s.rate)}
            >
              <small>
                {s.rate === 6 ? 'Low' : s.rate === 10 ? 'Base' : 'High'} · {s.rate}%
              </small>
              <strong>{formatMoney(s.result?.corpus || 0)}</strong>
            </Button>
          ))}
        </div>

        <div className="projection-range">
          <small>Illustrative range</small>
          <strong>
            {formatMoney(scenarios[0].result?.corpus || 0)} – {formatMoney(scenarios[2].result?.corpus || 0)}
          </strong>
          <span>Base {formatMoney(scenarios[1].result?.corpus || 0)}</span>
        </div>

        <div className="planner-results">
          <p>
            <small>{inflation ? 'Projected corpus in today’s money' : 'Projected nominal corpus'}</small>
            <strong>
              {formatMoney(inflation ? valueInTodaysMoney(result?.corpus || 0, years) : result?.corpus || 0)}
            </strong>
          </p>
          <p>
            <small>Nominal value</small>
            <strong>{formatMoney(result?.corpus || 0)}</strong>
          </p>
          <p>
            <small>Total contributed</small>
            <b>{formatMoney(result?.contributed || 0)}</b>
          </p>
          <p>
            <small>Illustrative growth</small>
            <b>{formatMoney(result?.growth || 0)}</b>
          </p>
        </div>

        <GrowthChart points={selectedSeries} max={maxChart} />

        <Button
          className="secondary full"
          onClick={() => setMonthly(monthlySavingsCapacity > 0 ? monthlySavingsCapacity : 50000)}
        >
          Use my savings budget · {formatMoney(monthlySavingsCapacity)}
        </Button>
        <p className="assumption">
          10% nominal annual return, monthly compounding, contributions at start of each month. Returns are not
          guaranteed and can be negative.
        </p>
      </article>

      {/* Cost of Waiting */}
      <article className="wait-card">
        <div>
          <p>Cost of waiting 2 years</p>
          <strong>{formatMoney(wait.difference)}</strong>
          <small>less in the final corpus</small>
        </div>
        <div>
          <span>
            Start now <b>{formatMoney(wait.now)}</b>
          </span>
          <span>
            Start later <b>{formatMoney(wait.later)}</b>
          </span>
        </div>
      </article>

      {/* Investment Readiness (Real behavior data) */}
      <Readiness
        score={readiness.score}
        level={readiness.level}
        factors={[
          [
            'Emergency buffer',
            emergencyGoal
              ? `${readiness.bufferMonths.toFixed(1)} months saved (${formatMoney(emergencySaved)})`
              : '0 (No emergency buffer goal)',
            readiness.bufferMonths >= 1,
          ],
          ['Expense tracking', `${loggedDays} of 30 days logged`, loggedDays >= 15],
          [
            'Spent + saved within pocket money',
            stayedInBudget
              ? `Yes (${formatMoney(monthSpent + monthSaved)} / ${formatMoney(settings.pocketMoney)})`
              : `No (Over by ${formatMoney(monthSpent + monthSaved - settings.pocketMoney)})`,
            stayedInBudget,
          ],
          [
            'Savings progress',
            goals.length > 0
              ? `${Math.round(goalAvgProgress * 100)}% across ${goals.length} goal${goals.length > 1 ? 's' : ''}`
              : 'No goals yet',
            goals.length > 0 && goalAvgProgress > 0,
          ],
        ]}
        debt={debt}
        setDebt={setDebt}
        target={targetText}
        setTarget={setTargetText}
        horizon={horizon}
        setHorizon={setHorizon}
        risk={risk}
        setRisk={setRisk}
        understands={understands}
        setUnderstands={setUnderstands}
        nextActionText={readiness.nextAction}
      />

      {/* Practice SIP */}
      <article className="card grow-section">
        <div className="section-title top">
          <div>
            <p className="label">Pay yourself first</p>
            <h2>Practice SIP</h2>
          </div>
          <span className="streak">{sipStreak} month streak</span>
        </div>
        <div className="planner-inputs">
          <label>
            Monthly amount
            <div className="money-input">
              <span>₹</span>
              <MoneyInput
                valuePaise={sipConfig.amountPaise}
                onChangePaise={paise => updateSipConfig({ amountPaise: paise })}
              />
            </div>
          </label>
          <label>
            Day of month (1–28)
            <Input
              type="number"
              min="1"
              max="28"
              value={sipConfig.day}
              onChange={e => updateSipConfig({ day: Math.min(28, Math.max(1, Number(e.target.value))) })}
            />
          </label>
        </div>

        <div className="setting-row">
          <div>
            <strong>Next due {nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
            <small>Monthly practice reminder</small>
          </div>
          <Button
            className={sipConfig.reminder ? 'toggle on' : 'toggle'}
            onClick={() => updateSipConfig({ reminder: !sipConfig.reminder })}
          >
            <i />
          </Button>
        </div>

        <MiniCorpus
          virtualCorpus={sipCorpusData.virtualCorpus}
          totalContributed={sipCorpusData.totalContributed}
          series={sipCorpusData.series}
        />

        {goals.length > 0 && (
          <label className="check-row" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(sipConfig.linkedGoalId)}
              onChange={e =>
                updateSipConfig({
                  linkedGoalId: e.target.checked ? (goals.find(g => g.isEmergency)?.id || goals[0]?.id) : undefined,
                })
              }
            />
            Link contributions to {goals.find(g => g.id === sipConfig.linkedGoalId)?.name || goals[0]?.name}
          </label>
        )}

        <Button
          className={`primary full ${isLoggedThisMonth ? 'secondary' : ''}`}
          disabled={isLoggedThisMonth}
          onClick={() => logSip()}
        >
          {isLoggedThisMonth ? '✓ Logged for this month' : `Log this month · ${formatMoney(sipConfig.amountPaise)}`}
        </Button>
      </article>

      {/* Smart Purchase Check */}
      <article className="card grow-section">
        <div className="section-title top">
          <div>
            <p className="label">Smart purchase check</p>
            <h2>{item || 'New purchase'}</h2>
          </div>
        </div>
        <label className="grow-field">
          Item name
          <Input value={item} onChange={e => setItem(e.target.value)} />
        </label>
        <div className="purchase-inputs">
          <label>
            Cash price
            <div className="money-input">
              <span>₹</span>
              <MoneyInput valuePaise={cash} onChangePaise={p => setCash(Math.max(0, p))} />
            </div>
          </label>
          <label>
            Monthly EMI
            <div className="money-input">
              <span>₹</span>
              <MoneyInput valuePaise={emi} onChangePaise={p => setEmi(Math.max(0, p))} />
            </div>
          </label>
          <label>
            Months
            <Input
              type="number"
              min="1"
              max="60"
              value={months}
              onChange={e => setMonths(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <label>
            Processing fee
            <div className="money-input">
              <span>₹</span>
              <MoneyInput valuePaise={fee} onChangePaise={p => setFee(Math.max(0, p))} />
            </div>
          </label>
        </div>

        <div className="purchase-summary">
          <p>
            <small>Total paid</small>
            <strong>{formatMoney(purchase.totalPaid)}</strong>
          </p>
          <p>
            <small>Extra vs cash</small>
            <strong>{formatMoney(purchase.extraCost)}</strong>
          </p>
          <p>
            <small>Effective yearly rate</small>
            <strong>~{purchase.effectiveAnnualRate.toFixed(1)}%</strong>
          </p>
          <p>
            <small>Months to save</small>
            <strong>{purchase.monthsToSaveText}</strong>
          </p>
        </div>

        <div className="purchase-options">
          <Option name="Pay cash now" cost={formatMoney(cash)} time="Today" />
          <Option name="Take the EMI" cost={formatMoney(purchase.totalPaid)} time={`${months} months`} />
          <Option name="Save and wait" cost={formatMoney(cash)} time={purchase.monthsToSaveText} />
        </div>

        <Button
          className="secondary full"
          onClick={handleSmartPurchaseAddToPause}
          disabled={cash <= 0}
        >
          {addedToPause ? '✓ Added to 24-hour pause list!' : 'Add to 24-hour pause list'}
        </Button>
      </article>

      {/* Net Worth (Real Snapshot Data) */}
      <article className="card grow-section">
        <div className="section-title top">
          <div>
            <p className="label">Automatic snapshot</p>
            <h2>Net worth</h2>
          </div>
          <strong className="net-total">{formatMoney(netWorth)}</strong>
        </div>
        <p className="formula" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Net Worth = Savings goals ({formatMoney(goalAssets)}) + Cash ({formatMoney(assets.cashInHand)}) + Other assets ({formatMoney(assets.otherAssets)}) + Investments ({formatMoney(investmentAssets)}) − Money owed ({formatMoney(assets.owed)}). Other assets must exclude investments tracked here. Investment purchases transfer cash into holdings; they are not expenses.
        </p>

        <div className="planner-inputs">
          <label>
            Cash in hand
            <div className="money-input">
              <span>₹</span>
              <MoneyInput
                valuePaise={assets.cashInHand}
                onChangePaise={paise => updateAssets({ cashInHand: paise })}
              />
            </div>
          </label>
          <label>
            Other assets
            <div className="money-input">
              <span>₹</span>
              <MoneyInput
                valuePaise={assets.otherAssets}
                onChangePaise={paise => updateAssets({ otherAssets: paise })}
              />
            </div>
          </label>
          <label>
            Money owed
            <div className="money-input">
              <span>₹</span>
              <MoneyInput
                valuePaise={assets.owed}
                onChangePaise={paise => updateAssets({ owed: paise })}
              />
            </div>
          </label>
        </div>

        <div className="asset-row">
          <span>Savings goals</span>
          <strong>{formatMoney(goalAssets)}</strong>
        </div>
        <div className="asset-row">
          <span>Investments</span>
          <strong>{formatMoney(investmentAssets)}</strong>
        </div>

        <NetWorthChart snapshots={netWorthSnapshots} />
        <small className="assumption">Monthly snapshots track your progress over time.</small>
      </article>

      {/* Where my money sits (Pyramid) */}
      <div className="section-title">
        <h2>Where my money sits</h2>
        <span>Tap a level</span>
      </div>
      <div className="pyramid money-pyramid">
        {levels.map(([name], i) => {
          const amount = goals
            .filter(g => g.level === ((i + 1) as 1 | 2 | 3 | 4 | 5))
            .reduce((n, g) => n + getGoalSavedPaise(g.id, contributions), 0)
          return (
            <Button
              key={name}
              className={`${selectedLevel === i ? 'active ' : ''}${amount > 0 ? 'funded' : ''}`}
              onClick={() => setSelectedLevel(i)}
            >
              <span>{name}</span>
              {amount > 0 && <b>{formatMoney(amount)}</b>}
            </Button>
          )
        })}
      </div>
      <div className="pyramid-note">
        <strong>{levels[selectedLevel][1]}</strong> Lower risk never means no risk.
      </div>
    </div>
  )
}

function GrowthChart({
  points,
  max,
}: {
  points: ReturnType<typeof projectMonthlyInvesting>
  max: number
}) {
  return (
    <div className="year-chart">
      {points.map(p => (
        <div key={p.year}>
          <span title={`Year ${p.year}`}>
            <i style={{ height: `${(p.contributed / max) * 100}%` }} />
            <b style={{ height: `${(p.growth / max) * 100}%` }} />
          </span>
          <small>{p.year}</small>
        </div>
      ))}
    </div>
  )
}

function MiniCorpus({
  virtualCorpus,
  totalContributed,
  series,
}: {
  virtualCorpus: number
  totalContributed: number
  series: { monthKey: string; corpus: number }[]
}) {
  const max = series.length > 0 ? Math.max(...series.map(s => s.corpus), 1) : 1
  return (
    <div className="mini-corpus">
      <div>
        <small>Virtual corpus</small>
        <strong>{formatMoney(virtualCorpus)}</strong>
      </div>
      <div>
        <small>Total contributed</small>
        <strong>{formatMoney(totalContributed)}</strong>
      </div>
      {series.length > 1 ? (
        <svg viewBox="0 0 100 30" preserveAspectRatio="none">
          <polyline
            points={series
              .map((p, i) => `${(i / (series.length - 1)) * 100},${28 - (p.corpus / max) * 25}`)
              .join(' ')}
          />
        </svg>
      ) : null}
    </div>
  )
}

function Option({ name, cost, time }: { name: string; cost: string; time: string }) {
  return (
    <div>
      <small>{name}</small>
      <strong>{cost}</strong>
      <span>{time}</span>
    </div>
  )
}

function NetWorthChart({ snapshots }: { snapshots: { monthKey: string; netWorthPaise: number }[] }) {
  if (snapshots.length < 2) {
    return (
      <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
        Your trend appears after your second month.
      </div>
    )
  }

  const values = snapshots.map(s => s.netWorthPaise)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return (
    <div className="net-chart">
      <svg viewBox="0 0 100 34" preserveAspectRatio="none">
        <polyline
          points={values
            .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 25}`)
            .join(' ')}
        />
      </svg>
      <div>
        {snapshots.map(s => {
          const parts = s.monthKey.split('-')
          const monthNum = Number(parts[1]) - 1
          const d = new Date(Number(parts[0]), monthNum, 1)
          const label = d.toLocaleDateString('en', { month: 'short' })
          return <small key={s.monthKey}>{label}</small>
        })}
      </div>
    </div>
  )
}

function Readiness(p: {
  score: number
  level: string
  factors: [string, string, boolean][]
  debt: boolean
  setDebt: (v: boolean) => void
  target: string
  setTarget: (v: string) => void
  horizon: string
  setHorizon: (v: string) => void
  risk: string
  setRisk: (v: string) => void
  understands: boolean
  setUnderstands: (v: boolean) => void
  nextActionText: string
}) {
  return (
    <article className="card grow-section readiness-v2">
      <div className="score-head">
        <div
          className="score-ring"
          style={{ background: `conic-gradient(var(--accent) ${p.score}%, var(--surface-3) 0)` }}
        >
          <i>
            <strong>{p.score}</strong>
            <small>/100</small>
          </i>
        </div>
        <div>
          <p className="label">Investment readiness</p>
          <h2>{p.level}</h2>
        </div>
      </div>

      {p.factors.map(([name, value, ok]) => (
        <div className="factor" key={name}>
          <i className={ok ? 'ok' : ''}>{ok ? '✓' : '!'}</i>
          <span>
            <strong>{name}</strong>
            <small>{value}</small>
          </span>
        </div>
      ))}

      <div className="manual-readiness">
        <label>
          <input type="checkbox" checked={p.debt} onChange={e => p.setDebt(e.target.checked)} />
          I have high-interest debt
        </label>
        <label>
          Target
          <Input value={p.target} onChange={e => p.setTarget(e.target.value)} />
        </label>
        <label>
          Time horizon
          <select value={p.horizon} onChange={e => p.setHorizon(e.target.value)}>
            <option>under 1 year</option>
            <option>1-3 years</option>
            <option>3+ years</option>
          </select>
        </label>
        <label>
          Risk tolerance
          <select value={p.risk} onChange={e => p.setRisk(e.target.value)}>
            <option>low</option>
            <option>medium</option>
            <option>high</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={p.understands}
            onChange={e => p.setUnderstands(e.target.checked)}
          />
          I understand charges and liquidity
        </label>
      </div>

      <div className="next-action">
        <small>Next best action</small>
        <strong>{p.nextActionText}</strong>
      </div>
    </article>
  )
}
