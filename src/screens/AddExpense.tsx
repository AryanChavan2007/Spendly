import { useEffect, useState } from 'react'
import { Button, Icon, Input } from '../components/ui'
import { useExpenses } from '../data/ExpenseStore'
import {
  categories,
  expenseTypes,
  paymentModes,
  toPaise,
  type Category,
  type ExpenseType,
  type PaymentMode,
} from '../data/types'

export function AddExpense({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { draft, setDraft, save, addPauseItem } = useExpenses()
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [quickText, setQuickText] = useState('')

  useEffect(() => {
    if (!open) {
      setError(false)
      setQuickText('')
    }
  }, [open])

  const key = (value: string) =>
    setDraft(d => ({
      ...d,
      amountText:
        value === '⌫'
          ? d.amountText.slice(0, -1)
          : value === '.' && d.amountText.includes('.')
            ? d.amountText
            : (d.amountText + value).replace(/^0+(?=\d)/, '').slice(0, 9),
    }))

  const doSave = (again = false) => {
    if (!save()) return setError(true)
    setSaved(true)
    setError(false)
    setQuickText('')
    setTimeout(() => {
      setSaved(false)
      if (!again) onClose()
    }, 650)
  }

  const parseQuick = (text: string) => {
    setQuickText(text)
    const lower = text.toLowerCase()
    const amount = lower.match(/(?:₹\s*)?(\d+(?:\.\d+)?)/)?.[1]
    const mode = lower.includes('cash')
      ? 'Cash'
      : lower.includes('card')
        ? 'Card'
        : lower.includes('net banking')
          ? 'Net Banking'
          : lower.includes('upi')
            ? 'UPI'
            : undefined
    const category =
      lower.includes('bus') || lower.includes('auto') || lower.includes('travel')
        ? 'Travel'
        : lower.includes('data') || lower.includes('recharge')
          ? 'Phone & Data'
          : lower.includes('book') || lower.includes('academic')
            ? 'Academic'
            : lower.includes('movie')
              ? 'Entertainment'
              : lower.includes('course') || lower.includes('skill')
                ? 'Skills/Learning'
                : lower.includes('lunch') || lower.includes('chai') || lower.includes('food')
                  ? 'Food'
                  : undefined

    const remainingNote = text
      .replace(/(?:₹\s*)?\d+(?:\.\d+)?/, '')
      .replace(/upi|cash|card|net banking/gi, '')
      .trim()

    setDraft(d => ({
      ...d,
      ...(amount ? { amountText: amount } : {}),
      ...(mode ? { mode: mode as PaymentMode } : {}),
      ...(category ? { category: category as Category } : {}),
      note: remainingNote,
    }))
  }

  const handleAddToPause = () => {
    const price = toPaise(draft.amountText)
    if (price > 0) {
      addPauseItem(draft.note || draft.category, price)
      setQuickText('')
      onClose()
    }
  }

  return (
    <div className={`sheet-layer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <Button className="scrim" aria-label="Close" onClick={onClose} />
      <section className="sheet">
        <header className="sheet-header">
          <div>
            <p className="eyebrow">{draft.editId ? 'Update transaction' : 'Quick add'}</p>
            <h2>{draft.editId ? 'Edit expense' : 'Add expense'}</h2>
          </div>
          <Button className="icon-button" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </header>

        <div className="quick-add-box">
          <Input
            value={quickText}
            onChange={e => parseQuick(e.target.value)}
            placeholder="Type something... e.g. lunch 120 upi"
          />
          <div>
            {['Chai ₹20', 'Lunch', 'Bus fare', 'Data recharge'].map(x => (
              <Button key={x} onClick={() => parseQuick(x)}>
                {x}
              </Button>
            ))}
          </div>
          {quickText && (
            <p>
              Parsed: <strong>{draft.category}</strong> · <strong>{draft.mode}</strong>
              {draft.amountText && <> · <strong>₹{draft.amountText}</strong></>}
            </p>
          )}
        </div>

        <div className={`amount-display ${error ? 'error' : ''}`}>
          <span>₹</span>
          <strong>{draft.amountText || '0'}</strong>
        </div>
        {error && <p className="error-text">Enter an amount greater than ₹0</p>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => (
            <Button key={k} onClick={() => key(k)}>
              {k}
            </Button>
          ))}
        </div>

        <div className="form-section">
          <label>Category</label>
          <div className="chips">
            {categories.map(c => (
              <Button
                key={c}
                className={draft.category === c ? 'chip selected' : 'chip'}
                onClick={() => setDraft(d => ({ ...d, category: c as Category }))}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label>Type</label>
          <div className="segment type-segment">
            {expenseTypes.map(t => (
              <Button
                key={t}
                className={draft.type === t ? 'selected' : ''}
                onClick={() => setDraft(d => ({ ...d, type: t as ExpenseType }))}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        {draft.type === 'Want' && Number(draft.amountText) > 500 && (
          <div className="pause-prompt">
            <div>
              <strong>Pause before purchasing?</strong>
              <p>Add this want to your 24-hour pause list instead.</p>
            </div>
            <Button className="text-button" onClick={handleAddToPause}>
              Add to pause list
            </Button>
            <Button className="skip" onClick={() => setDraft(d => ({ ...d, type: 'Want' }))}>
              Skip
            </Button>
          </div>
        )}

        <div className="form-section">
          <label>Payment mode</label>
          <div className="segment">
            {paymentModes.map(m => (
              <Button
                key={m}
                className={draft.mode === m ? 'selected' : ''}
                onClick={() => setDraft(d => ({ ...d, mode: m as PaymentMode }))}
              >
                {m}
              </Button>
            ))}
          </div>
          <p className="connection">
            <i /> {draft.mode === 'Cash' ? 'Offline expense' : 'Online expense'}
          </p>
        </div>

        <div className="form-grid">
          <label>
            Date & time
            <Input
              type="datetime-local"
              value={draft.date}
              onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
            />
          </label>
          <label>
            Note (optional)
            <Input
              placeholder="What was this for?"
              value={draft.note}
              onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
            />
          </label>
        </div>

        <Button
          className={`primary full ${saved ? 'save-success' : ''}`}
          onClick={() => doSave(false)}
        >
          {saved ? '✓ Saved successfully' : draft.editId ? 'Update expense' : 'Save expense'}
        </Button>
        {!draft.editId && (
          <Button className="secondary full" onClick={() => doSave(true)}>
            Save & add another
          </Button>
        )}
      </section>
    </div>
  )
}
