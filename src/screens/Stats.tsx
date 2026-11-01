import { useState } from 'react'
import { Button, formatMoney, Title } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import { categories, type Expense } from '../data/types'
import { getCalendarWeekRange, isThisMonth } from '../utils/financeSummary'

export function Stats({ embedded = false }: { embedded?: boolean }) {
  const { expenses } = useExpenses()
  const [range, setRange] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly')

  const now = new Date()
  let shown: Expense[] = []
  let prevShown: Expense[] = []

  if (range === 'Daily') {
    shown = expenses.filter(e => {
      const d = new Date(e.date)
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const prevDay = new Date(now)
    prevDay.setDate(prevDay.getDate() - 1)
    prevShown = expenses.filter(e => {
      const d = new Date(e.date)
      return d.getDate() === prevDay.getDate() && d.getMonth() === prevDay.getMonth() && d.getFullYear() === prevDay.getFullYear()
    })
  } else if (range === 'Weekly') {
    const currentWeekRange = getCalendarWeekRange(now)
    shown = expenses.filter(e => {
      const t = new Date(e.date).getTime()
      return t >= currentWeekRange.start.getTime() && t <= currentWeekRange.end.getTime()
    })
    const prevWeekStart = new Date(currentWeekRange.start)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(currentWeekRange.start)
    prevWeekEnd.setMilliseconds(-1)
    prevShown = expenses.filter(e => {
      const t = new Date(e.date).getTime()
      return t >= prevWeekStart.getTime() && t <= prevWeekEnd.getTime()
    })
  } else {
    shown = expenses.filter(e => isThisMonth(e.date, now))
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    prevShown = expenses.filter(e => isThisMonth(e.date, prevMonthDate))
  }

  const total = shown.reduce((n, e) => n + e.amount, 0)
  const prevTotal = prevShown.reduce((n, e) => n + e.amount, 0)
  const trend = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null

  const byCat = categories
    .map(c => ({
      name: c,
      value: shown.filter(e => e.category === c).reduce((n, e) => n + e.amount, 0),
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  const online = shown.filter(e => e.mode !== 'Cash').reduce((n, e) => n + e.amount, 0)

  const modes = ['UPI', 'Card', 'Cash', 'Net Banking']
    .map(name => ({
      name,
      value: shown.filter(e => e.mode === name).reduce((n, e) => n + e.amount, 0),
    }))
    .filter(x => x.value > 0)

  const daily = [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1),
      value: shown
        .filter(e => new Date(e.date).toDateString() === d.toDateString())
        .reduce((n, e) => n + e.amount, 0),
    }
  })
  const max = Math.max(...daily.map(d => d.value), 1)

  const byDay = Object.values(
    shown.reduce<Record<string, { date: string; value: number }>>((all, e) => {
      const date = new Date(e.date).toDateString()
      all[date] ||= { date, value: 0 }
      all[date].value += e.amount
      return all
    }, {})
  )
  const highest = byDay.sort((a, b) => b.value - a.value)[0]

  return (
    <div className={embedded ? 'stats-embedded' : 'page'}>
      {!embedded && (
        <header className="page-header compact">
          <div>
            <p className="eyebrow">Insights</p>
            <Title>Spending stats</Title>
          </div>
        </header>
      )}

      <div className="segment range">
        {(['Daily', 'Weekly', 'Monthly'] as const).map(x => (
          <Button
            className={x === range ? 'selected' : ''}
            onClick={() => setRange(x)}
            key={x}
          >
            {x}
          </Button>
        ))}
      </div>

      {!shown.length ? (
        <div className="card empty">No spending data in this period.</div>
      ) : (
        <>
          <article className="card">
            <div className="section-title top">
              <div>
                <p className="label">Total spent</p>
                <h2>{formatMoney(total)}</h2>
              </div>
              {trend !== null && (
                <span className="trend">
                  {trend >= 0 ? `↑ ${trend}%` : `↓ ${Math.abs(trend)}%`}
                </span>
              )}
            </div>
            <div className="donut-area">
              <div
                className="donut"
                style={{
                  background:
                    total > 0
                      ? `conic-gradient(var(--accent) 0 ${(byCat[0]?.value / total) * 100 || 0}%, var(--purple) 0 ${
                          (((byCat[0]?.value || 0) + (byCat[1]?.value || 0)) / total) * 100
                        }%, var(--amber) 0 80%, var(--surface-3) 0)`
                      : 'var(--surface-3)',
                }}
              >
                <div>
                  <strong>{byCat.length}</strong>
                  <small>categories</small>
                </div>
              </div>
              <div className="legend">
                {byCat.slice(0, 4).map((x, i) => (
                  <p key={x.name}>
                    <i className={`dot d${i}`} />
                    <span>{x.name}</span>
                    <strong>{total > 0 ? Math.round((x.value / total) * 100) : 0}%</strong>
                  </p>
                ))}
              </div>
            </div>
          </article>

          <article className="card">
            <div className="section-title">
              <h2>Daily spending</h2>
              <span>Last 7 days</span>
            </div>
            <div className="bars">
              {daily.map(d => (
                <div key={d.key}>
                  <span>
                    <i style={{ height: `${Math.max(5, (d.value / max) * 100)}%` }} />
                  </span>
                  <small>{d.label}</small>
                </div>
              ))}
            </div>
          </article>

          <div className="split-cards">
            <article className="card mini">
              <p className="label">Online</p>
              <strong>{total > 0 ? Math.round((online / total) * 100) : 0}%</strong>
              <small>{formatMoney(online)}</small>
            </article>
            <article className="card mini">
              <p className="label">Offline</p>
              <strong>{total > 0 ? Math.round(((total - online) / total) * 100) : 0}%</strong>
              <small>{formatMoney(total - online)}</small>
            </article>
          </div>

          <article className="card">
            <div className="section-title top">
              <h2>Need · Want · Goal</h2>
            </div>
            {['Need', 'Want', 'Goal'].map(t => {
              const v = shown
                .filter(e => (e.type || 'Need') === t)
                .reduce((n, e) => n + e.amount, 0)
              const pct = total > 0 ? Math.round((v / total) * 100) : 0
              return (
                <div className="mode-row" key={t}>
                  <span>{t}</span>
                  <div>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{pct}%</strong>
                </div>
              )
            })}
          </article>

          <article className="card">
            <div className="section-title top">
              <h2>Payment modes</h2>
            </div>
            {modes.map(m => {
              const maxVal = Math.max(...modes.map(x => x.value), 1)
              const pct = total > 0 ? Math.round((m.value / total) * 100) : 0
              return (
                <div className="mode-row" key={m.name}>
                  <span>{m.name}</span>
                  <div>
                    <i style={{ width: `${(m.value / maxVal) * 100}%` }} />
                  </div>
                  <strong>{pct}%</strong>
                </div>
              )
            })}
          </article>

          <article className="card">
            <div className="section-title">
              <h2>Top categories</h2>
            </div>
            {byCat.slice(0, 3).map((x, i) => (
              <div className="rank" key={x.name}>
                <span>{i + 1}</span>
                <p>
                  <strong>{x.name}</strong>
                  <small>{total > 0 ? Math.round((x.value / total) * 100) : 0}% of spending</small>
                </p>
                <b>{formatMoney(x.value)}</b>
              </div>
            ))}
          </article>

          {highest && (
            <article className="highlight-card">
              <p>Highest-spend day</p>
              <strong>
                {new Date(highest.date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </strong>
              <span>{formatMoney(highest.value)}</span>
            </article>
          )}
        </>
      )}
    </div>
  )
}
