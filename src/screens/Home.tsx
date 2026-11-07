import { CircleDollarSign, Pause, PiggyBank, Plus, Target, TrendingUp } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ExpenseRow } from '../components/ExpenseRow'
import { Button, formatMoney, Icon, sameDay, Title } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import {
  computeWeeklyInsight,
  getCategoryOverLimit,
  getWeekKey,
  getLastSevenDaysTotal,
  moneyMapActuals,
  monthlySummary,
} from '../utils/financeSummary'

export function Home({
  onAdd,
  onSettings,
  onGoals,
}: {
  onAdd: () => void
  onSettings: () => void
  onGoals: () => void
}) {
  const { expenses, contributions, settings, challenge, ui, investmentCashMovements, dismissWeeklyInsight, edit, remove } = useExpenses()

  const today = expenses
    .filter(e => sameDay(e.date, new Date()))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const todaySpent = today.reduce((n, e) => n + e.amount, 0)
  const summary = monthlySummary(expenses, contributions, settings, investmentCashMovements)
  const totalOut = summary.spent + summary.saved
  const isOver = summary.received > 0 && totalOut > summary.received
  const overAmt = totalOut - summary.received
  const rawPct = summary.received > 0 ? (totalOut / summary.received) * 100 : 0
  const pct = Math.min(100, rawPct)
  const actuals = moneyMapActuals(expenses, contributions, settings, investmentCashMovements)
  const buckets = Object.keys(settings.moneyMap) as (keyof typeof settings.moneyMap)[]
  const weekly = getLastSevenDaysTotal(expenses)
  const over = getCategoryOverLimit(expenses, settings.categoryLimits)
  const insight = computeWeeklyInsight(expenses, ui.dismissedInsightWeek)

  const actions = [
    ['Add expense', Plus, onAdd],
    ['Add money', CircleDollarSign, onGoals],
    ['Pause list', Pause, onGoals],
    ['Goal', Target, onGoals],
  ] as const

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <Title>Let’s start strong, {settings.name || 'friend'}!</Title>
        </div>
        <Button className="icon-button" aria-label="Settings" onClick={onSettings}>
          <Icon name="settings" />
        </Button>
      </header>

      {!settings.name && (
        <Button className="first-run-prompt" onClick={onSettings}>
          <strong>Make Spendly yours</strong>
          <span>Add your name →</span>
        </Button>
      )}

      {over && (
        <div className="warning-banner">
          <span>!</span>
          <p>
            <strong>{over[0]} limit crossed</strong>
            <small>Pause and check your Money Map before spending more.</small>
          </p>
        </div>
      )}

      <article className="card pocket-hero">
        <div>
          <p>{isOver ? `${formatMoney(overAmt)} over budget` : `You’re ${Math.round(rawPct)}% through this month’s pocket money`}</p>
          <span>
            {formatMoney(totalOut)} / {formatMoney(summary.received)}
          </span>
        </div>
        <b>
          <TrendingUp size={20} />
        </b>
        <div className="progress">
          <i style={{ width: `${pct}%`, background: isOver ? 'var(--danger)' : undefined }} />
        </div>
        {isOver ? (
          <small className="usage-chip danger" style={{ background: 'var(--danger)', color: '#fff' }}>
            {formatMoney(overAmt)} over budget
          </small>
        ) : rawPct >= 80 ? (
          <small className="usage-chip">{Math.round(rawPct)}% used</small>
        ) : null}
      </article>

      <div className="quick-actions">
        {actions.map(([label, ActionIcon, action]) => (
          <Button onClick={action} key={label}>
            <i>
              <ActionIcon size={19} />
            </i>
            <span>{label}</span>
          </Button>
        ))}
      </div>

      {insight && (
        <article className="insight-card">
          <i>
            <TrendingUp size={18} />
          </i>
          <p className="eyebrow">Weekly insight</p>
          <h2>{insight.title}</h2>
          <span>{insight.subtitle}</span>
          <div>
            <Button onClick={() => dismissWeeklyInsight(getWeekKey())}>Dismiss</Button>
            <Button onClick={insight.actionLabel === 'Check limits' ? onSettings : onGoals}>
              {insight.actionLabel || 'Set a limit'}
            </Button>
          </div>
        </article>
      )}

      <div className="section-title">
        <h2>Daily Summary</h2>
        <span>{new Date().toLocaleDateString('en-IN', { month: 'long' })}</span>
      </div>

      <div className="daily-summary">
        <article className="card">
          <div
            className="summary-ring"
            style={{
              background: `conic-gradient(var(--accent) ${
                summary.received > 0 ? Math.min(100, (todaySpent / summary.received) * 100) : 0
              }%, var(--surface-3) 0)`,
            }}
          >
            <i />
          </div>
          <p>
            <small>Spent today</small>
            <strong>{formatMoney(todaySpent)}</strong>
          </p>
        </article>
        <article className="card">
          <PiggyBank size={20} />
          <p>
            <small>This week</small>
            <strong>{formatMoney(weekly)}</strong>
          </p>
        </article>
      </div>

      <div className="section-title">
        <h2>Money Map</h2>
        <span>Plan vs actual</span>
      </div>
      <div className="map-strip">
        {buckets.map(name => {
          const plan = settings.moneyMap[name] || 0
          const actual = actuals[name] || 0
          const isDanger = actual > plan + 20
          return (
            <div key={name}>
              <div
                className="mini-ring"
                style={{
                  background: `conic-gradient(${isDanger ? 'var(--danger)' : 'var(--accent)'} ${Math.min(100, actual)}%, var(--surface-3) 0)`,
                }}
              >
                <i />
              </div>
              <strong>{name}</strong>
              <small>
                Plan {plan}% · Actual {actual}%
              </small>
            </div>
          )
        })}
      </div>

      <article className="challenge-card">
        <div>
          <p className="eyebrow">7-day challenge · {challenge.completed.length}/7</p>
          <h2>{challenge.completed.length < 7 ? 'Keep your momentum' : 'Challenge complete'}</h2>
          <span>Small money habits add up over time.</span>
        </div>
        <b>{challenge.completed.length}/7</b>
      </article>

      <div className="section-title">
        <h2>Today’s expenses</h2>
        <Button className="text-button" onClick={onAdd}>
          Add expense
        </Button>
      </div>
      {today.length ? (
        today.map(e => (
          <ExpenseRow
            key={e.id}
            expense={e}
            onDelete={() => remove(e.id)}
            onEdit={() => {
              edit(e)
              onAdd()
            }}
          />
        ))
      ) : (
        <EmptyState
          title="Nothing spent yet"
          body="A no-spend day is worth celebrating—or log your first expense."
          action="Add expense"
          onAction={onAdd}
        />
      )}
    </div>
  )
}
