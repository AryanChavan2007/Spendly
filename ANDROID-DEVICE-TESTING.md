# Spendly Android Device Testing Checklist

This checklist is for a real Android device. The browser checks and APK build do
not count as completion. Record the device, Android version, app version, date,
and results before sharing findings.

## Before testing

- [ ] Install the latest debug APK on a physical Android device.
- [ ] Record device model, Android version/API level, and Spendly app version.
- [ ] Use a disposable test profile or export a backup before testing.
- [ ] Keep notification and battery-optimization settings unchanged initially;
  test the default device configuration first.
- [ ] Mark each test **Pass**, **Fail**, or **Blocked**, and attach notes or a
  screen recording for failures.

## Notifications

- [ ] On Android 13+, enable a reminder from Settings and accept the system
  notification permission prompt. Confirm the toggle stays enabled.
- [ ] Repeat and deny the permission prompt. Confirm the reminder toggle stays
  off; grant permission later in Android Settings and enable it again.
- [ ] Use **Test notification**. Confirm one Spendly notification is delivered
  while the app is foregrounded and again while it is backgrounded.
- [ ] Schedule the daily reminder a few minutes ahead. Background the app and
  confirm delivery near the selected time.
- [ ] Change the reminder time and confirm the old scheduled time does not
  produce an extra notification.
- [ ] Turn each reminder type off and confirm its pending notification no
  longer fires. Test daily, SIP, pause-list, and budget notifications separately.
- [ ] With disposable data, cross the 80% and 100% monthly budget thresholds.
  Confirm each alert fires once and does not duplicate after another expense,
  app restart, or a settings change.
- [ ] Add a future pause-list item and confirm one alert at its ready time.
  Mark it bought or skipped first and confirm its pending alert is cancelled.
- [ ] Log the current month's practice SIP and confirm the month's SIP reminder
  is not scheduled again.
- [ ] Restart the app and confirm enabled reminders remain scheduled exactly
  once, with disabled reminders still absent.
- [ ] On Android 12+, note whether the app opens **Alarms & reminders** access
  during scheduling and whether delivery works when exact-alarm access is
  denied. Record the device's battery-optimization setting.

## Offline, launch, and app lifecycle

- [ ] After a successful online launch, enable airplane mode and force-stop
  Spendly. Cold-launch it while still offline; confirm the app opens without a
  network error.
- [ ] While offline, navigate Home, History, Goals, and Grow.
- [ ] While offline, add an expense and confirm it appears in the relevant
  screens.
- [ ] Background the app during normal use, wait briefly, and return. Confirm
  the current screen and unsaved form state behave consistently.
- [ ] Force-stop and relaunch. Confirm saved expenses, goals, settings, and
  challenge progress persist.

## Forms, keyboard, and back button

- [ ] Open Add Expense, focus the note field, and confirm keyboard resizing or
  scrolling leaves the active field visible.
- [ ] Confirm the sheet's Save action remains reachable while the keyboard is
  visible, including on a smaller phone screen.
- [ ] Use Android Back once with the keyboard open. Confirm it dismisses the
  keyboard before closing the form.
- [ ] With Add Expense open and keyboard hidden, press Android Back. Confirm the
  sheet closes without saving.
- [ ] Open Settings and press Android Back. Confirm Settings closes.
- [ ] Select History, Goals, or Grow and press Android Back. Confirm navigation
  returns to Home.
- [ ] At Home with no overlay, press Android Back. Confirm Spendly exits or
  backgrounds according to normal Android behavior.

## System bars and safe areas

- [ ] Check the status-bar icon contrast and background in dark, light, and
  system theme modes; repeat with AMOLED enabled.
- [ ] Check content and the bottom navigation against gesture navigation and
  three-button navigation. Confirm neither overlaps the system navigation area.
- [ ] On a device with a display cutout, verify the top header and status bar
  remain readable.
- [ ] Rotate the device if supported by its app configuration and check that
  the sheet, bottom navigation, and screen scrolling remain usable.

## Backup round-trip

- [ ] Create disposable expenses, a goal with contributions, a pause-list item,
  SIP log, and non-default settings.
- [ ] Export a backup using Android's share/save flow and confirm a JSON file is
  saved to a user-accessible location.
- [ ] Clear only the disposable test data, then import that backup and confirm
  the confirmation dialog shows expected record counts.
- [ ] Confirm restore reproduces the test records and settings.
- [ ] Import an invalid JSON file and a structurally invalid backup. Confirm
  restore is rejected and existing device data is unchanged.

## Results

- Device / Android version:
- App version / APK build:
- Test date:
- Pass / Fail / Blocked summary:
- Defects and reproduction steps:
