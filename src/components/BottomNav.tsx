import { Button, Icon } from './ui'
export type Tab = 'home' | 'history' | 'goals' | 'grow'
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'history', label: 'History', icon: 'history' },
  { id: 'goals', label: 'Goals', icon: 'stats' }, { id: 'grow', label: 'Grow', icon: 'wallet' },
]
export function BottomNav({ active, onChange, onAdd }: { active: Tab; onChange: (tab: Tab) => void; onAdd: () => void }) {
  return <nav className="bottom-nav" aria-label="Main navigation">
    {tabs.map((tab, i) => <div className={i === 2 ? 'nav-item nav-gap' : 'nav-item'} key={tab.id}>
      <Button className={active === tab.id ? 'nav-button active' : 'nav-button'} onClick={() => onChange(tab.id)}><Icon name={tab.icon}/><span>{tab.label}</span></Button>
    </div>)}
    <Button className="fab" aria-label="Add expense" onClick={onAdd}><Icon name="plus" size={27}/></Button>
  </nav>
}
