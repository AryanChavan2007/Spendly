import { useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ExpenseRow } from '../components/ExpenseRow'
import { Button, formatMoney, Icon, Input, Title } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import { Stats } from './Stats'

export function History({ onEdit }: { onEdit: () => void }) {
  const { expenses, edit, remove, deleted, undo } = useExpenses()
  const [view, setView] = useState<'List' | 'Stats'>('List')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [range, setRange] = useState('All time')

  const shown = expenses.filter(e => {
    const daysOld = (Date.now() - +new Date(e.date)) / 86400000
    const inRange =
      range === 'All time' ||
      (range === '7 days' && daysOld <= 7) ||
      (range === '30 days' && daysOld <= 30)

    const matchesQuery = !query || `${e.note} ${e.category}`.toLowerCase().includes(query.toLowerCase())

    const matchesFilter =
      filter === 'All' ||
      e.category === filter ||
      e.mode === filter ||
      (filter === 'Online' ? e.mode !== 'Cash' : filter === 'Offline' ? e.mode === 'Cash' : false)

    return inRange && matchesQuery && matchesFilter
  })

  const groups = useMemo(
    () =>
      Object.entries(
        shown
          .sort((a, b) => +new Date(b.date) - +new Date(a.date))
          .reduce<Record<string, typeof expenses>>((all, e) => {
            const k = new Date(e.date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            ;(all[k] ||= []).push(e)
            return all
          }, {})
      ),
    [shown]
  )

  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Your spending</p>
          <Title>History</Title>
        </div>
        <span className="count">{expenses.length} entries</span>
      </header>

      <div className="segment history-switch">
        {['List', 'Stats'].map(v => (
          <Button
            key={v}
            className={view === v ? 'selected' : ''}
            onClick={() => setView(v as 'List' | 'Stats')}
          >
            {v}
          </Button>
        ))}
      </div>

      {view === 'Stats' ? (
        <Stats embedded />
      ) : (
        <>
          <div className="search">
            <Icon name="search" />
            <Input
              aria-label="Search expenses"
              placeholder="Search expenses"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="history-filters">
            <div className="filter-scroll">
              {['All', 'Food', 'Travel', 'Shopping', 'UPI', 'Cash', 'Online', 'Offline'].map(f => (
                <Button
                  key={f}
                  className={filter === f ? 'filter active' : 'filter'}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <div className="range-filter">
              {['All time', '7 days', '30 days'].map(r => (
                <Button
                  key={r}
                  className={range === r ? 'active' : ''}
                  onClick={() => setRange(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
          {groups.length ? (
            groups.map(([date, items]) => (
              <section className="history-group" key={date}>
                <div className="section-title">
                  <h2>{date}</h2>
                  <span>{formatMoney(items.reduce((n, e) => n + e.amount, 0))}</span>
                </div>
                {items.map(e => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    onDelete={() => remove(e.id)}
                    onEdit={() => {
                      edit(e)
                      onEdit()
                    }}
                  />
                ))}
              </section>
            ))
          ) : (
            <EmptyState title="Nothing found" body="Try changing your search or filters." />
          )}
          {deleted && (
            <div className="snackbar">
              <span>Expense deleted</span>
              <Button onClick={undo}>Undo</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
