import { useRef, useState } from 'react'
import type { Expense } from '../data/types'
import { categoryGlyph, formatMoney, Button, Icon } from './ui'
import { Bus, GraduationCap, MoreHorizontal, Popcorn, ShoppingBag, Smartphone, Soup, Wrench, type LucideIcon } from 'lucide-react'

const categoryIcons: Record<string, LucideIcon> = {
  Travel: Bus, Food: Soup, 'Phone & Data': Smartphone, Academic: GraduationCap,
  Entertainment: Popcorn, Shopping: ShoppingBag, 'Skills/Learning': Wrench, Other: MoreHorizontal,
}

export function ExpenseRow({ expense, onEdit, onDelete }: { expense: Expense; onEdit: () => void; onDelete: () => void }) {
  const CategoryIcon = categoryIcons[expense.category]
  const start = useRef(0)
  const [revealed, setRevealed] = useState(false)
  return <div className="expense-wrap">
    <Button className="delete-action" aria-label={`Delete ${expense.note || expense.category}`} onClick={onDelete}><Icon name="trash"/></Button>
    <Button className={`expense-row ${revealed ? 'revealed' : ''}`} onClick={onEdit}
      onTouchStart={(e) => start.current = e.touches[0].clientX}
      onTouchEnd={(e) => setRevealed(start.current - e.changedTouches[0].clientX > 45)}>
      <span className={`category-icon cat-${expense.category.toLowerCase()}`}>{CategoryIcon ? <CategoryIcon size={19} strokeWidth={1.8}/> : categoryGlyph[expense.category]}</span>
      <span className="expense-copy"><strong>{expense.note || expense.category}</strong><small>{expense.category} · {expense.type || 'Need'} · {new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span>
      <span className="expense-amount"><strong>-{formatMoney(expense.amount)}</strong><small className={expense.mode === 'Cash' ? 'tag cash' : 'tag'}>{expense.mode}</small></span>
    </Button>
  </div>
}
