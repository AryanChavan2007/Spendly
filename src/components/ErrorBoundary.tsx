import { Component, type ReactNode } from 'react'
import { Button } from './ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 320 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <Button
            className="primary"
            onClick={() => {
              this.setState({ hasError: false, error: undefined })
              window.location.reload()
            }}
          >
            Reload application
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
