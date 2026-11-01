import { Button, Icon } from './ui'
export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return <div className="empty"><span className="empty-icon"><Icon name="wallet" size={28}/></span><strong>{title}</strong><p>{body}</p>{action && <Button className="text-button" onClick={onAction}>{action}</Button>}</div>
}
