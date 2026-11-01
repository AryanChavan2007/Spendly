import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { StoredData } from '../data/ExpenseStore'

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isPluginAvailable('LocalNotifications')) return false
  try {
    const status = await LocalNotifications.checkPermissions()
    return status.display === 'granted'
  } catch {
    return false
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isPluginAvailable('LocalNotifications')) return false
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch (err) {
    console.warn('[notifications] Failed to request permissions:', err)
    return false
  }
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (!Capacitor.isPluginAvailable('LocalNotifications')) return
  try {
    await LocalNotifications.changeExactNotificationSetting()
  } catch (err) {
    console.debug('Could not open exact alarm settings:', err)
  }
}

export async function sendTestNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) {
    alert('Notifications are supported on native Android devices.')
    return false
  }
  const granted = await requestNotificationPermission()
  if (!granted) {
    alert('Notification permission was not granted.')
    return false
  }
  try {
    await LocalNotifications.createChannel({
      id: 'spendly_reminders',
      name: 'Spendly Reminders',
      description: 'Daily reminders, pause list alerts, and budget warnings',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999,
          title: 'Spendly Test Notification 🔔',
          body: 'Notifications are working successfully!',
          channelId: 'spendly_reminders',
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    })
    return true
  } catch (err) {
    console.warn('Failed to send test notification:', err)
    return false
  }
}

let isSyncing = false
let pendingState: StoredData | null = null

export async function syncNotifications(
  state: StoredData,
  onTriggerThreshold?: (key: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) {
    return
  }

  if (isSyncing) {
    pendingState = state
    return
  }

  isSyncing = true
  try {
    const hasPerm = await hasNotificationPermission()
    if (!hasPerm) {
      return
    }

    try {
      await LocalNotifications.createChannel({
        id: 'spendly_reminders',
        name: 'Spendly Reminders',
        description: 'Daily reminders, pause list alerts, and budget warnings',
        importance: 4,
        visibility: 1,
        vibration: true,
      })
    } catch {}

    // Cancel ONLY Spendly's owned notifications using explicit ID registry ranges
    // Reserved ranges: 1001 (daily), 1002 (SIP), 1003 (80% budget), 1004 (100% budget), 9999 (test),
    // 3000-3999 (category limits), 20000-69999 (pause items).
    try {
      const pending = await LocalNotifications.getPending()
      const spendlyIds = pending.notifications
        .map(n => n.id)
        .filter(
          id =>
            id === 1001 ||
            id === 1002 ||
            id === 1003 ||
            id === 1004 ||
            id === 9999 ||
            (id >= 3000 && id < 4000) ||
            (id >= 20000 && id < 70000)
        )
      if (spendlyIds.length > 0) {
        await LocalNotifications.cancel({ notifications: spendlyIds.map(id => ({ id })) })
      }
    } catch (err) {
      console.debug('Could not fetch/cancel pending notifications:', err)
    }

    const toSchedule: LocalNotificationSchema[] = []

    // 1. Daily Log Reminder
    if (state.settings.reminder) {
      const timeStr = state.settings.reminderTime || '20:30'
      const [h, m] = timeStr.split(':').map(Number)
      toSchedule.push({
        id: 1001,
        title: 'Spendly Daily Check-in',
        body: 'Did you spend anything today? Log your expenses in 5 seconds.',
        channelId: 'spendly_reminders',
        schedule: {
          on: {
            hour: isNaN(h) ? 20 : h,
            minute: isNaN(m) ? 30 : m,
          },
          allowWhileIdle: true,
        },
      })
    }

    // 2. Practice SIP Reminder (monthly on sipConfig.day, skip if already logged this month)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const alreadyLoggedSip = state.sipLogs.some(l => l.monthKey === currentMonth)
    if (state.settings.sipReminders && state.sipConfig.reminder && !alreadyLoggedSip) {
      const targetDay = Math.min(28, Math.max(1, state.sipConfig.day || 5))
      const sipAmountRupees = Math.round(state.sipConfig.amountPaise / 100)
      toSchedule.push({
        id: 1002,
        title: 'Practice SIP Day! 📈',
        body: `Today is Day ${targetDay} — invest virtual ₹${sipAmountRupees} in your practice SIP!`,
        channelId: 'spendly_reminders',
        schedule: {
          on: {
            day: targetDay,
            hour: 9,
            minute: 0,
          },
          allowWhileIdle: true,
        },
      })
    }

    // 3. 24h pause list item ready: schedule at item.readyAt (only if waiting and un-decided)
    if (state.settings.pauseReminders) {
      const now = Date.now()
      state.pauseItems
        .filter(item => item.status === 'waiting' && !item.decidedAt)
        .forEach(item => {
          const readyAtMs = new Date(item.readyAt).getTime()
          if (readyAtMs > now) {
            toSchedule.push({
              id: 20000 + (hashString(item.id) % 50000),
              title: '24h Pause Complete! ⏳',
              body: `Your cooling-off pause on "${item.name}" has completed. Ready to decide?`,
              channelId: 'spendly_reminders',
              schedule: {
                at: new Date(readyAtMs),
                allowWhileIdle: true,
              },
            })
          }
        })
    }

    // 4. Budget warnings: when spending crosses 80% and 100% of pocket money (triggered once per calendar month)
    if (state.settings.warnings && state.settings.pocketMoney > 0) {
      const monthlySpent = state.expenses
        .filter(e => e.date.startsWith(currentMonth))
        .reduce((sum, e) => sum + e.amount, 0)

      const ratio = monthlySpent / state.settings.pocketMoney
      const triggeredMap = state.ui.triggeredBudgetAlerts || {}

      if (ratio >= 1.0 && !triggeredMap[`${currentMonth}-100`]) {
        toSchedule.push({
          id: 1004,
          title: 'Budget Limit Exceeded! ⚠️',
          body: `You have crossed 100% of your monthly pocket money limit (₹${Math.round(monthlySpent / 100)} spent).`,
          channelId: 'spendly_reminders',
          schedule: {
            at: new Date(Date.now() + 1500),
            allowWhileIdle: true,
          },
        })
        onTriggerThreshold?.(`${currentMonth}-100`)
      } else if (ratio >= 0.8 && ratio < 1.0 && !triggeredMap[`${currentMonth}-80`]) {
        toSchedule.push({
          id: 1003,
          title: 'Budget Alert (80%) ⚠️',
          body: `You have spent 80% of your monthly pocket money limit (₹${Math.round(monthlySpent / 100)} spent).`,
          channelId: 'spendly_reminders',
          schedule: {
            at: new Date(Date.now() + 1500),
            allowWhileIdle: true,
          },
        })
        onTriggerThreshold?.(`${currentMonth}-80`)
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule })
    }

    if (import.meta.env.DEV) {
      const pending = await LocalNotifications.getPending()
      console.log('[LocalNotifications] Pending scheduled notifications:', pending)
    }
  } catch (err) {
    console.warn('[notifications] Failed to sync notifications:', err)
  } finally {
    isSyncing = false
    if (pendingState) {
      const next = pendingState
      pendingState = null
      void syncNotifications(next, onTriggerThreshold)
    }
  }
}
