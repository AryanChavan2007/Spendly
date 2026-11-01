import { useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Button, formatMoney, Icon, Input, MoneyInput, Title } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import type { Goal, PauseItem, PlannedEssentialCategory } from '../data/types'
import {
  calculateLoggingStreak,
  getGoalSavedPaise,
  getPlannedEssentialsActuals,
  monthlySummary,
  savedByWaitingThisMonth,
} from '../utils/financeSummary'

const challengeItems = [
  'Write down money received and essential expenses',
  'Track every expense, however small',
  'Identify a spending habit worth improving',
  'Choose one realistic savings goal',
  'Read how a SIP works and its risks',
  'Identify one skill to develop over 12 months',
  'Review and choose one habit to sustain',
]

const pyramidLevelNames: Record<number, string> = {
  1: '1. Speculation / high risk',
  2: '2. Growth investments',
  3: '3. Lower-risk investments',
  4: '4. Savings & liquidity',
  5: '5. Safety & security (emergency buffer)',
}

export function Goals({ onBuyPause }: { onBuyPause?: (item: PauseItem) => void }) {
  const {
    expenses,
    contributions,
    settings,
    goals,
    pauseItems,
    challenge,
    updateSettings,
    addGoal,
    updateGoal,
    removeGoal,
    addContribution,
    addPauseItem,
    decidePauseItem,
    extendPauseItem,
    toggleChallengeDay,
    setChallengeReflection,
  } = useExpenses()

  const summary = monthlySummary(expenses, contributions, settings)
  const streak = calculateLoggingStreak(expenses)
  const waitingSaved = savedByWaitingThisMonth(pauseItems)
  const plannedActuals = getPlannedEssentialsActuals(expenses)
  const plannedCategories: PlannedEssentialCategory[] = ['Travel', 'Food', 'Phone & Data', 'Academic']

  const names = ['Essentials', 'Savings', 'Skills', 'Enjoyment', 'Unexpected'] as const
  const alloc = names.map(name => settings.moneyMap[name])
  const allocTotal = alloc.reduce((n, x) => n + x, 0)
  const left = 100 - allocTotal

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(id)
  }, [])

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalName, setGoalName] = useState('')
  const [goalTargetPaise, setGoalTargetPaise] = useState(500000)
  const [goalLevel, setGoalLevel] = useState<1 | 2 | 3 | 4 | 5>(4)
  const [goalIsEmergency, setGoalIsEmergency] = useState(false)

  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState<Goal | null>(null)

  const [customContributionGoal, setCustomContributionGoal] = useState<Goal | null>(null)
  const [customContributionPaise, setCustomContributionPaise] = useState(100000)

  const [showAddPauseModal, setShowAddPauseModal] = useState(false)
  const [pauseName, setPauseName] = useState('')
  const [pausePricePaise, setPausePricePaise] = useState(100000)

  const openCreateGoal = () => {
    setEditingGoal(null)
    setGoalName('')
    setGoalTargetPaise(500000)
    setGoalLevel(4)
    setGoalIsEmergency(false)
    setShowGoalModal(true)
  }

  const openEditGoal = (g: Goal) => {
    setEditingGoal(g)
    setGoalName(g.name)
    setGoalTargetPaise(g.targetPaise)
    setGoalLevel(g.level)
    setGoalIsEmergency(g.isEmergency)
    setShowGoalModal(true)
  }

  const handleSaveGoal = () => {
    if (!goalName.trim() || goalTargetPaise <= 0) return
    if (editingGoal) {
      updateGoal(editingGoal.id, {
        name: goalName.trim(),
        targetPaise: goalTargetPaise,
        level: goalIsEmergency ? 5 : goalLevel,
        isEmergency: goalIsEmergency,
      })
    } else {
      addGoal({
        name: goalName.trim(),
        targetPaise: goalTargetPaise,
        level: goalIsEmergency ? 5 : goalLevel,
        isEmergency: goalIsEmergency,
      })
    }
    setShowGoalModal(false)
  }

  const handleCustomContribution = () => {
    if (customContributionGoal && customContributionPaise > 0) {
      addContribution(customContributionGoal.id, customContributionPaise)
      setCustomContributionGoal(null)
    }
  }

  const handleAddPauseItem = () => {
    if (pauseName.trim() && pausePricePaise > 0) {
      addPauseItem(pauseName.trim(), pausePricePaise)
      setShowAddPauseModal(false)
      setPauseName('')
      setPausePricePaise(100000)
    }
  }

  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Plan and save</p>
          <Title>Goals</Title>
        </div>
        {streak > 0 && <span className="streak">{streak} day streak</span>}
      </header>

      {/* Pocket Money & Money Map Allocation */}
      <article className="card receive-card">
        <p className="label">Receive money</p>
        <h2>Add pocket money</h2>
        <div className="money-input">
          <span>₹</span>
          <MoneyInput
            valuePaise={settings.pocketMoney}
            onChangePaise={paise => updateSettings({ pocketMoney: paise, budget: paise })}
          />
        </div>
        <div className="summary-line">
          <span>Spent {formatMoney(summary.spent)}</span>
          <span style={{ color: 'var(--positive)' }}>Saved {formatMoney(summary.saved)}</span>
          <strong>Left {formatMoney(summary.remaining)}</strong>
        </div>

        <div className="allocation-head">
          <strong>Build your Money Map</strong>
          <span className={left !== 0 ? 'red' : ''}>{left === 0 ? '100% allocated' : `${left}% left`}</span>
        </div>
        {names.map((x, i) => (
          <label className="slider-row" key={x}>
            <span>
              {x}
              <b>{alloc[i]}%</b>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={alloc[i]}
              onChange={e =>
                updateSettings({
                  moneyMap: { ...settings.moneyMap, [x]: Number(e.target.value) },
                })
              }
            />
          </label>
        ))}

        {left !== 0 && (
          <div className="warning-banner" style={{ margin: '12px 0 6px', fontSize: '11px' }}>
            <span>!</span>
            <p style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: 0 }}>
              <span>Total allocation is {allocTotal}%.</span>
              <small style={{ color: 'inherit', opacity: 0.9 }}>Aim for 100% across your 5 buckets.</small>
            </p>
          </div>
        )}
        <p className="muted" style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px' }}>
          ✓ Saved automatically
        </p>
      </article>

      <div className="money-flow">
        <span>Money received</span>
        <i>→</i>
        <span>Essentials</span>
        <i>→</i>
        <span>Goals</span>
        <i>→</i>
        <span>Flex</span>
      </div>

      {/* Planned Essentials */}
      <div className="section-title">
        <h2>Planned essentials</h2>
        <span>This month</span>
      </div>
      <article className="card">
        {plannedCategories.map(cat => {
          const actual = plannedActuals[cat]
          const planned =
            settings.plannedEssentials[cat] ??
            (cat === 'Food' ? 150000 : cat === 'Travel' ? 70000 : cat === 'Academic' ? 60000 : 30000)
          const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0
          return (
            <div className="plan-row" key={cat}>
              <span>{cat}</span>
              <div>
                <i style={{ width: `${pct}%` }} />
              </div>
              <small>
                {formatMoney(actual)} / {formatMoney(planned)}
              </small>
            </div>
          )
        })}
      </article>

      {/* Savings Goals */}
      <div className="section-title">
        <h2>Savings goals</h2>
        <Button className="text-button" onClick={openCreateGoal}>
          Create goal
        </Button>
      </div>
      {goals.length > 0 ? (
        <div className="goal-grid">
          {goals.map(g => {
            const saved = getGoalSavedPaise(g.id, contributions)
            const pct = g.targetPaise > 0 ? Math.min(100, (saved / g.targetPaise) * 100) : 0
            return (
              <article className="card goal-card" key={g.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p>
                    {g.name}
                    {g.isEmergency && <small className="tag" style={{ marginLeft: 6 }}>Buffer</small>}
                  </p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button
                      className="icon-button goal-icon-button"
                      onClick={() => openEditGoal(g)}
                      aria-label={`Edit ${g.name}`}
                    >
                      <Icon name="chevron" size={16} />
                    </Button>
                    <Button
                      className="icon-button goal-icon-button"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setDeleteGoalConfirm(g)}
                      aria-label={`Delete ${g.name}`}
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  </div>
                </div>
                <strong>{formatMoney(saved)}</strong>
                <small>of {formatMoney(g.targetPaise)}</small>
                <div className="progress">
                  <i style={{ width: `${pct}%`, background: 'var(--positive)' }} />
                </div>
                <div className="goal-actions">
                  <Button className="secondary" onClick={() => addContribution(g.id, 10000)}>
                    +₹100
                  </Button>
                  <Button className="secondary" onClick={() => addContribution(g.id, 50000)}>
                    +₹500
                  </Button>
                  <Button
                    className="secondary"
                    onClick={() => {
                      setCustomContributionGoal(g)
                      setCustomContributionPaise(100000)
                    }}
                  >
                    Custom
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="No savings goals yet"
          body="Set a goal for a course, emergency fund, or a personal milestone."
          action="Create goal"
          onAction={openCreateGoal}
        />
      )}

      {/* 24-Hour Pause List */}
      <div className="section-title">
        <h2>24-hour pause</h2>
        <span>{waitingSaved > 0 ? `Saved ${formatMoney(waitingSaved)} by waiting` : 'Prevent impulse buys'}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Button className="secondary full" onClick={() => setShowAddPauseModal(true)}>
          + Add item to pause list
        </Button>
      </div>

      {pauseItems.length > 0 ? (
        pauseItems.map(p => {
          const readyMs = new Date(p.readyAt).getTime()
          const remain = Math.max(0, readyMs - now)
          const ended = remain === 0

          if (p.status !== 'waiting') return null

          return (
            <article className="card pause-item" key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <small>{formatMoney(p.pricePaise)}</small>
              </div>
              <b>
                {ended
                  ? 'Ready to decide'
                  : `${Math.floor(remain / 3600000)}h ${Math.floor((remain % 3600000) / 60000)}m left`}
              </b>
              {ended && (
                <>
                  <p>Do I need it? Can I afford it? What goal might this delay?</p>
                  <div className="row">
                    <Button
                      onClick={() => {
                        decidePauseItem(p.id, 'bought')
                        if (onBuyPause) onBuyPause(p)
                      }}
                    >
                      Buy
                    </Button>
                    <Button className="primary" onClick={() => decidePauseItem(p.id, 'skipped')}>
                      Skip
                    </Button>
                    <Button onClick={() => extendPauseItem(p.id)}>Wait more</Button>
                  </div>
                </>
              )}
            </article>
          )
        })
      ) : (
        <EmptyState
          title="No items on pause"
          body="Whenever you feel an urge to make a non-essential purchase, add it here for 24 hours."
          action="Add to pause list"
          onAction={() => setShowAddPauseModal(true)}
        />
      )}

      {/* 7-Day Challenge */}
      <div className="section-title">
        <h2>7-Day Challenge</h2>
        <span>{challenge.completed.length}/7 complete</span>
      </div>
      <article className="card challenge-list">
        {challengeItems.map((text, i) => (
          <Button
            key={text}
            className={challenge.completed.includes(i) ? 'complete' : ''}
            onClick={() => toggleChallengeDay(i)}
          >
            <i>{challenge.completed.includes(i) ? '✓' : i + 1}</i>
            <span>{text}</span>
          </Button>
        ))}
        <label>
          What surprised me?
          <Input
            placeholder="Write a short reflection…"
            value={challenge.reflection}
            onChange={e => setChallengeReflection(e.target.value)}
          />
        </label>
      </article>

      {/* Create / Edit Goal Modal */}
      {showGoalModal && (
        <div className="sheet-layer open">
          <Button className="scrim" aria-label="Close" onClick={() => setShowGoalModal(false)} />
          <section className="sheet">
            <header className="sheet-header">
              <div>
                <p className="eyebrow">{editingGoal ? 'Update goal' : 'New goal'}</p>
                <h2>{editingGoal ? 'Edit savings goal' : 'Create savings goal'}</h2>
              </div>
              <Button className="icon-button" onClick={() => setShowGoalModal(false)}>
                <Icon name="close" />
              </Button>
            </header>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                Goal name
                <Input
                  placeholder="e.g. Design course, Laptop, Buffer"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                />
              </label>

              <label>
                Target amount
                <div className="money-input">
                  <span>₹</span>
                  <MoneyInput valuePaise={goalTargetPaise} onChangePaise={setGoalTargetPaise} />
                </div>
              </label>

              <label className="check-row" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={goalIsEmergency}
                  onChange={e => {
                    setGoalIsEmergency(e.target.checked)
                    if (e.target.checked) setGoalLevel(5)
                  }}
                />
                This is my emergency buffer (Level 5 Safety & Security)
              </label>

              {!goalIsEmergency && (
                <label>
                  Pyramid level
                  <select
                    className="input"
                    value={goalLevel}
                    onChange={e => setGoalLevel(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  >
                    <option value={1}>{pyramidLevelNames[1]}</option>
                    <option value={2}>{pyramidLevelNames[2]}</option>
                    <option value={3}>{pyramidLevelNames[3]}</option>
                    <option value={4}>{pyramidLevelNames[4]}</option>
                    <option value={5}>{pyramidLevelNames[5]}</option>
                  </select>
                </label>
              )}

              <Button className="primary full" onClick={handleSaveGoal} disabled={!goalName.trim() || goalTargetPaise <= 0}>
                {editingGoal ? 'Update goal' : 'Create goal'}
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Custom Contribution Modal */}
      {customContributionGoal && (
        <div className="dialog-layer">
          <section className="dialog">
            <h2>Add to {customContributionGoal.name}</h2>
            <p>Enter the contribution amount for this goal:</p>
            <div className="money-input" style={{ marginBottom: 16 }}>
              <span>₹</span>
              <MoneyInput
                valuePaise={customContributionPaise}
                onChangePaise={setCustomContributionPaise}
                autoFocus
              />
            </div>
            <div className="row">
              <Button className="secondary" onClick={() => setCustomContributionGoal(null)}>
                Cancel
              </Button>
              <Button className="primary" onClick={handleCustomContribution}>
                Add {formatMoney(customContributionPaise)}
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Delete Goal Confirmation */}
      {deleteGoalConfirm && (
        <div className="dialog-layer">
          <section className="dialog">
            <h2>Delete goal?</h2>
            <p>
              Are you sure you want to delete “{deleteGoalConfirm.name}”? All contributions for this goal
              will also be removed.
            </p>
            <div className="row">
              <Button className="secondary" onClick={() => setDeleteGoalConfirm(null)}>
                Cancel
              </Button>
              <Button
                className="danger-button"
                onClick={() => {
                  removeGoal(deleteGoalConfirm.id)
                  setDeleteGoalConfirm(null)
                }}
              >
                Delete goal
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Add to Pause List Modal */}
      {showAddPauseModal && (
        <div className="sheet-layer open">
          <Button className="scrim" aria-label="Close" onClick={() => setShowAddPauseModal(false)} />
          <section className="sheet">
            <header className="sheet-header">
              <div>
                <p className="eyebrow">Pause impulse buy</p>
                <h2>Add to 24-hour pause</h2>
              </div>
              <Button className="icon-button" onClick={() => setShowAddPauseModal(false)}>
                <Icon name="close" />
              </Button>
            </header>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                Item description
                <Input
                  placeholder="e.g. Wireless headphones, sneakers"
                  value={pauseName}
                  onChange={e => setPauseName(e.target.value)}
                />
              </label>

              <label>
                Price
                <div className="money-input">
                  <span>₹</span>
                  <MoneyInput valuePaise={pausePricePaise} onChangePaise={setPausePricePaise} />
                </div>
              </label>

              <Button
                className="primary full"
                onClick={handleAddPauseItem}
                disabled={!pauseName.trim() || pausePricePaise <= 0}
              >
                Start 24-hour pause
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
