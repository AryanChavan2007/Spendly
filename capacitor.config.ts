import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.aryan.spendly',
  appName: 'Spendly',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#e8643c',
    },
  },
}

export default config
