import { useRef, useState } from 'react'
import { Button, Icon, Input, MoneyInput, Title } from '../components/ui'
import { useExpenses, validateBackup, type BackupValidationResult } from '../data/ExpenseStore'
import { categories, type Category, type PlannedEssentialCategory } from '../data/types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { openBatteryOptimizationSettings, requestNotificationPermission, sendTestNotification } from '../utils/notifications'

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <Button
      role="switch"
      aria-checked={on}
      className={on ? 'toggle on' : 'toggle'}
      onClick={() => set(!on)}
    >
      <i />
    </Button>
  )
}

const plannedEssentialList: PlannedEssentialCategory[] = ['Travel', 'Food', 'Phone & Data', 'Academic']

export function Settings({ onClose }: { onClose?: () => void }) {
  const {
    settings,
    updateSettings,
    clearAllData,
    restoreValidatedData,
    exportAllData,
    loadDemoData,
    removeDemoData,
  } = useExpenses()

  const [confirmClear, setConfirmClear] = useState(false)
  const [demoLoadedMsg, setDemoLoadedMsg] = useState(false)
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    const jsonStr = exportAllData()
    const fileName = `spendly-backup-v2-${new Date().toISOString().slice(0, 10)}.json`
    if (Capacitor.isNativePlatform()) {
      try {
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
        })
        await Share.share({
          title: 'Spendly Backup',
          text: 'Here is your Spendly backup JSON file.',
          url: fileResult.uri,
          dialogTitle: 'Save Backup',
        })
        return
      } catch (err) {
        console.warn('Native share backup failed:', err)
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
    a.download = fileName
    a.click()
  }

  const handleToggle = async (key: 'reminder' | 'warnings' | 'pauseReminders' | 'sipReminders', value: boolean) => {
    if (value) {
      await requestNotificationPermission()
    }
    updateSettings({ [key]: value })
  }

  const handleFileSelect = (f?: File) => {
    if (!f) return
    f.text().then(text => {
      try {
        const parsed: unknown = JSON.parse(text)
        const validation = validateBackup(parsed)
        if (validation.valid) {
          setRestoreValidation(validation)
          setRestoreError(null)
        } else {
          setRestoreError(validation.error)
          setRestoreValidation(null)
        }
      } catch {
        setRestoreError('The selected file is not valid JSON. No data was changed.')
        setRestoreValidation(null)
      }
      if (file.current) file.current.value = ''
    })
  }

  const confirmRestoreAction = () => {
    if (restoreValidation && restoreValidation.valid) {
      restoreValidatedData(restoreValidation.data)
      setRestoreValidation(null)
    }
  }

  const handleLoadDemo = () => {
    loadDemoData()
    setDemoLoadedMsg(true)
    setTimeout(() => setDemoLoadedMsg(false), 2000)
  }

  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Make it yours</p>
          <Title>Settings</Title>
        </div>
        {onClose && (
          <Button className="icon-button" onClick={onClose}>
            <Icon name="close" />
          </Button>
        )}
      </header>

      {!settings.name && (
        <div className="first-run-card">
          <strong>Welcome to Spendly</strong>
          <p>What should we call you?</p>
        </div>
      )}

      {/* Profile */}
      <section className="settings-section">
        <h2>Profile</h2>
        <article className="card setting-card">
          <label>
            Your name
            <Input
              placeholder="Enter your first name"
              value={settings.name}
              onChange={e => updateSettings({ name: e.target.value })}
            />
          </label>
        </article>
      </section>

      {/* Pocket Money & Planning */}
      <section className="settings-section">
        <h2>Pocket money & limits</h2>
        <article className="card setting-card">
          <label>
            Monthly pocket money
            <div className="money-input">
              <span>₹</span>
              <MoneyInput
                valuePaise={settings.pocketMoney}
                onChangePaise={paise => updateSettings({ pocketMoney: paise, budget: paise })}
              />
            </div>
          </label>

          <label className="received-day">
            Day received
            <Input
              type="number"
              min="1"
              max="28"
              value={settings.receivedDay}
              onChange={e => updateSettings({ receivedDay: Math.min(28, Math.max(1, Number(e.target.value))) })}
            />
          </label>

          <div className="divider" />
          <p className="setting-label">
            Planned essentials <small>Monthly budget</small>
          </p>
          {plannedEssentialList.map(c => (
            <label className="limit-row" key={c}>
              <span>{c}</span>
              <div>
                <span>₹</span>
                <MoneyInput
                  placeholder="0"
                  valuePaise={
                    settings.plannedEssentials[c] ??
                    (c === 'Food' ? 150000 : c === 'Travel' ? 70000 : c === 'Academic' ? 60000 : 30000)
                  }
                  onChangePaise={paise =>
                    updateSettings({
                      plannedEssentials: { ...settings.plannedEssentials, [c]: paise },
                    })
                  }
                />
              </div>
            </label>
          ))}

          <div className="divider" />
          <p className="setting-label">
            Category limits <small>Optional (leave empty to remove)</small>
          </p>
          {categories.map((c: Category) => (
            <label className="limit-row" key={c}>
              <span>{c}</span>
              <div>
                <span>₹</span>
                <MoneyInput
                  placeholder="No limit"
                  allowEmpty
                  valuePaise={settings.categoryLimits[c]}
                  onChangePaise={paise => {
                    const next = { ...settings.categoryLimits }
                    if (paise > 0) next[c] = paise
                    else delete next[c]
                    updateSettings({ categoryLimits: next })
                  }}
                  onEmpty={() => {
                    const next = { ...settings.categoryLimits }
                    delete next[c]
                    updateSettings({ categoryLimits: next })
                  }}
                />
              </div>
            </label>
          ))}
        </article>
      </section>

      {/* Preferences */}
      <section className="settings-section">
        <h2>Preferences</h2>
        <article className="card setting-list">
          <div className="setting-row">
            <div>
              <strong>Daily reminder</strong>
              <small>“Did you log all your expenses?”</small>
            </div>
            <div className="row">
              <Input
                className="time-input"
                type="time"
                value={settings.reminderTime}
                onChange={e => updateSettings({ reminderTime: e.target.value })}
              />
              <Toggle on={settings.reminder} set={v => handleToggle('reminder', v)} />
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Budget warnings</strong>
              <small>Notify at 80% and 100%</small>
            </div>
            <Toggle on={settings.warnings} set={v => handleToggle('warnings', v)} />
          </div>
          <div className="setting-row">
            <div>
              <strong>24-hour pause reminders</strong>
              <small>Revisit wants after a day</small>
            </div>
            <Toggle on={settings.pauseReminders} set={v => handleToggle('pauseReminders', v)} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Practice SIP reminder</strong>
              <small>Monthly virtual contribution</small>
            </div>
            <Toggle on={settings.sipReminders} set={v => handleToggle('sipReminders', v)} />
          </div>
          {Capacitor.isNativePlatform() && (
            <div className="setting-row action" onClick={() => openBatteryOptimizationSettings()}>
              <div>
                <strong>Reminders not firing?</strong>
                <small>Check exact alarms & battery optimization</small>
              </div>
              <Icon name="chevron" />
            </div>
          )}
          {Capacitor.isNativePlatform() && (
            <Button className="setting-row action" onClick={async () => {
              const success = await sendTestNotification()
              if (success) {
                alert('Test notification scheduled for 1 second from now!')
              }
            }}>
              <div>
                <strong>Test notification</strong>
                <small>Send a test alert right now</small>
              </div>
              <Icon name="chevron" />
            </Button>
          )}
          <div className="setting-row">
            <div>
              <strong>Currency symbol</strong>
              <small>Used across all amounts</small>
            </div>
            <Input
              className="currency-input"
              maxLength={3}
              aria-label="Currency symbol"
              value={settings.currency}
              onChange={e => updateSettings({ currency: e.target.value || '₹' })}
            />
          </div>
          <div className="setting-row theme-setting">
            <div>
              <strong>Theme</strong>
              <small>Choose your appearance</small>
            </div>
            <div className="theme-toggle three">
              <Button
                className={settings.theme === 'light' ? 'active' : ''}
                onClick={() => updateSettings({ theme: 'light' })}
              >
                <Icon name="sun" />
                <span>Light</span>
              </Button>
              <Button
                className={settings.theme === 'dark' ? 'active' : ''}
                onClick={() => updateSettings({ theme: 'dark' })}
              >
                <Icon name="moon" />
                <span>Dark</span>
              </Button>
              <Button
                className={settings.theme === 'system' ? 'active' : ''}
                onClick={() => updateSettings({ theme: 'system' })}
              >
                <Icon name="settings" />
                <span>System</span>
              </Button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Pure black (AMOLED)</strong>
              <small>Changes only the dark background</small>
            </div>
            <Toggle on={settings.amoled} set={v => updateSettings({ amoled: v })} />
          </div>
        </article>
      </section>

      {/* Cyber Security Banner */}
      <article className="safe-card">
        <strong>STOP · VERIFY · PROTECT · REPORT</strong>
        <p>Never share your UPI PIN or OTP. You don’t enter a PIN to receive money.</p>
        <span>Report cyber fraud: cybercrime.gov.in · 1930</span>
      </article>

      {/* Data Management */}
      <section className="settings-section">
        <h2>Your data</h2>
        <article className="card setting-list">
          <Button className="setting-row action" onClick={handleLoadDemo}>
            <div>
              <strong>Load demo data</strong>
              <small>{demoLoadedMsg ? '✓ Demo data loaded!' : 'Pre-fill with sample goals, expenses, and SIPs'}</small>
            </div>
            <Icon name="chevron" />
          </Button>

          <Button className="setting-row action" onClick={removeDemoData}>
            <div>
              <strong>Remove demo data</strong>
              <small>Reset to fresh start with empty data</small>
            </div>
            <Icon name="chevron" />
          </Button>

          <Button className="setting-row action" onClick={handleExport}>
            <div>
              <strong>Export backup</strong>
              <small>Save full version 2 JSON backup</small>
            </div>
            <Icon name="chevron" />
          </Button>

          <Button className="setting-row action" onClick={() => file.current?.click()}>
            <div>
              <strong>Restore backup</strong>
              <small>Import and validate spendly backup</small>
            </div>
            <Icon name="chevron" />
          </Button>
          <Input
            ref={file}
            className="hidden"
            type="file"
            accept=".json"
            onChange={e => handleFileSelect(e.target.files?.[0])}
          />

          <Button className="setting-row action danger-text" onClick={() => setConfirmClear(true)}>
            <div>
              <strong>Clear all data</strong>
              <small>Permanently wipe all records and settings</small>
            </div>
            <Icon name="trash" />
          </Button>
        </article>
      </section>

      <p className="version">Spendly · Offline on this device · v2.0</p>

      {/* Clear All Confirmation Dialog */}
      {confirmClear && (
        <div className="dialog-layer">
          <section className="dialog" style={{ maxWidth: 360 }}>
            <h2>Clear all data?</h2>
            <p>This will permanently remove:</p>
            <ul style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 16px', lineHeight: 1.6 }}>
              <li>All expenses and transactions</li>
              <li>All savings goals and contributions</li>
              <li>All 24-hour pause items</li>
              <li>All practice SIP logs and streaks</li>
              <li>All assets and net worth snapshots</li>
              <li>7-day challenge progress and reflections</li>
              <li>Custom limits, settings, and profile name</li>
            </ul>
            <div className="row">
              <Button className="secondary" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
              <Button
                className="danger-button"
                onClick={() => {
                  clearAllData()
                  setConfirmClear(false)
                }}
              >
                Clear all data
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Restore Confirmation Dialog with Counts */}
      {restoreValidation && restoreValidation.valid && (
        <div className="dialog-layer">
          <section className="dialog" style={{ maxWidth: 360 }}>
            <h2>Confirm Restore</h2>
            <p>The backup file is valid and contains:</p>
            <ul style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px 16px', lineHeight: 1.6 }}>
              <li><strong>{restoreValidation.counts.expenses}</strong> expenses</li>
              {!restoreValidation.isLegacyArray && (
                <>
                  <li><strong>{restoreValidation.counts.goals}</strong> savings goals</li>
                  <li><strong>{restoreValidation.counts.contributions}</strong> contributions</li>
                  <li><strong>{restoreValidation.counts.pauseItems}</strong> pause items</li>
                  <li><strong>{restoreValidation.counts.sipLogs}</strong> SIP records</li>
                </>
              )}
            </ul>
            <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 16 }}>
              Replacing data will overwrite your current device state.
            </p>
            <div className="row">
              <Button className="secondary" onClick={() => setRestoreValidation(null)}>
                Cancel
              </Button>
              <Button className="primary" onClick={confirmRestoreAction}>
                Confirm Replace
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Restore Error Dialog */}
      {restoreError && (
        <div className="dialog-layer">
          <section className="dialog" style={{ maxWidth: 360 }}>
            <h2 style={{ color: 'var(--danger)' }}>Restore Failed</h2>
            <p style={{ marginTop: 8 }}>{restoreError}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 0 16px' }}>
              Your existing data remains completely untouched.
            </p>
            <div className="row">
              <Button className="secondary" onClick={() => setRestoreError(null)}>
                Close
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
