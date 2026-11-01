import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch (err) {
    // Non-fatal if device doesn't support haptics
    console.debug('Haptics not available:', err)
  }
}
