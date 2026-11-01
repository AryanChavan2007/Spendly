import { useState } from 'react'
import { ExpenseProvider, useExpenses } from './data/ExpenseStore'
import { AddExpense } from './screens/AddExpense'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { Goals } from './screens/Goals'
import { Grow } from './screens/Grow'
import { BottomNav, type Tab } from './components/BottomNav'
import type { PauseItem } from './data/types'

function AppContent() {
  const [tab, setTab] = useState<Tab>('home')
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)
  const { setDraft } = useExpenses()

  const handleBuyPause = (item: PauseItem) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    setDraft({
      amountText: (item.pricePaise / 100).toString(),
      category: 'Shopping',
      mode: 'UPI',
      type: 'Want',
      note: item.name,
      date: d.toISOString().slice(0, 16),
    })
    setAdding(true)
  }

  return (
    <main className="app-shell">
      <section className={tab === 'home' ? 'screen' : 'screen hidden'}>
        <Home
          onAdd={() => setAdding(true)}
          onSettings={() => setSettings(true)}
          onGoals={() => setTab('goals')}
        />
      </section>
      <section className={tab === 'history' ? 'screen' : 'screen hidden'}>
        <History onEdit={() => setAdding(true)} />
      </section>
      <section className={tab === 'goals' ? 'screen' : 'screen hidden'}>
        <Goals onBuyPause={handleBuyPause} />
      </section>
      <section className={tab === 'grow' ? 'screen' : 'screen hidden'}>
        <Grow />
      </section>
      <BottomNav active={tab} onChange={setTab} onAdd={() => setAdding(true)} />
      <AddExpense open={adding} onClose={() => setAdding(false)} />
      <div className={`settings-layer ${settings ? 'open' : ''}`}>
        <Settings onClose={() => setSettings(false)} />
      </div>
    </main>
  )
}

export default function App() {
  return (
    <ExpenseProvider>
      <AppContent />
    </ExpenseProvider>
  )
}
