import { useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ExpenseProvider, useExpenses } from './data/ExpenseStore'
import { AddExpense } from './screens/AddExpense'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { Goals } from './screens/Goals'
import { Grow } from './screens/Grow'
import { BottomNav, type Tab } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { PauseItem } from './data/types'

function AppContent() {
  const [tab, setTab] = useState<Tab>('home')
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)
  const navigationState = useRef({ adding, settings, tab })
  const { setDraft } = useExpenses()

  navigationState.current = { adding, settings, tab }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let mounted = true
    let removeListener: (() => void) | undefined
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const current = navigationState.current
      if (current.adding) {
        setAdding(false)
      } else if (current.settings) {
        setSettings(false)
      } else if (current.tab !== 'home') {
        setTab('home')
      } else if (canGoBack) {
        window.history.back()
      } else {
        void CapacitorApp.exitApp()
      }
    }).then(listener => {
      if (mounted) {
        removeListener = () => {
          void listener.remove()
        }
      } else {
        void listener.remove()
      }
    })

    return () => {
      mounted = false
      removeListener?.()
    }
  }, [])

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
    <ErrorBoundary>
      <ExpenseProvider>
        <AppContent />
      </ExpenseProvider>
    </ErrorBoundary>
  )
}
