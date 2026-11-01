import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { toPaise } from '../data/types'

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    stats: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
    wallet: <><path d="M4 6h15v13H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12v3"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.wallet}</svg>
}

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props} />
})

export function MoneyInput({
  valuePaise,
  onChangePaise,
  placeholder = '0',
  className = '',
  allowEmpty = false,
  onEmpty,
  autoFocus = false,
  'aria-label': ariaLabel,
  id,
}: {
  valuePaise: number | undefined
  onChangePaise: (paise: number) => void
  placeholder?: string
  className?: string
  allowEmpty?: boolean
  onEmpty?: () => void
  autoFocus?: boolean
  'aria-label'?: string
  id?: string
}) {
  const formatInitial = (p?: number) => (p !== undefined && p > 0 ? (p / 100).toString() : '')
  const [text, setText] = useState(() => formatInitial(valuePaise))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setText(formatInitial(valuePaise))
    }
  }, [valuePaise, isFocused])

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={`input ${className}`}
      placeholder={placeholder}
      value={text}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false)
        if (text === '' && allowEmpty) {
          if (onEmpty) onEmpty()
        } else {
          const p = toPaise(text)
          onChangePaise(p)
          setText(p > 0 ? (p / 100).toString() : (allowEmpty ? '' : '0'))
        }
      }}
      onChange={(e) => {
        const val = e.target.value
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
          setText(val)
          if (val === '') {
            if (allowEmpty && onEmpty) onEmpty()
            else onChangePaise(0)
          } else {
            onChangePaise(toPaise(val))
          }
        }
      }}
    />
  )
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h1 className={`title ${className}`}>{children}</h1>
}

export const formatMoney = (paise: number = 0, symbol = '₹') =>
  `${symbol}${Number.isFinite(paise) ? Math.round(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`

export const sameDay = (a: string | Date, b: string | Date) =>
  new Date(a).toDateString() === new Date(b).toDateString()

export const categoryGlyph: Record<string, string> = {
  Food: 'F',
  Travel: 'T',
  Transport: 'T',
  'Phone & Data': 'P',
  Bills: 'B',
  Academic: 'A',
  Education: 'Ed',
  Entertainment: 'E',
  Shopping: 'S',
  'Skills/Learning': 'Sk',
  Health: 'H',
  Groceries: 'G',
  Rent: 'R',
  Other: 'O',
}
