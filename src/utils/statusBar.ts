import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function syncStatusBar(theme: 'light' | 'dark' | 'system', amoled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  let color = '#e9e9e9'
  let style = Style.Light

  if (isDark) {
    color = amoled ? '#000000' : '#0e0e10'
    style = Style.Dark
  }

  try {
    await StatusBar.setStyle({ style })
    await StatusBar.setBackgroundColor({ color })
  } catch (err) {
    console.debug('StatusBar sync error:', err)
  }
}
