export interface StorageDriver {
  get<T = unknown>(key: string): T | null
  set<T = unknown>(key: string, value: T): void
  remove(key: string): void
}

export class LocalStorageDriver implements StorageDriver {
  get<T = unknown>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return null
      return JSON.parse(item) as T
    } catch (e) {
      // If parsing fails, return raw string or null
      try {
        return (localStorage.getItem(key) as unknown) as T
      } catch {
        return null
      }
    }
  }

  set<T = unknown>(key: string, value: T): void {
    try {
      if (typeof value === 'string') {
        localStorage.setItem(key, value)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (e) {
      console.warn(`[Storage] Error setting key ${key}:`, e)
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn(`[Storage] Error removing key ${key}:`, e)
    }
  }
}

export const storage: StorageDriver = new LocalStorageDriver()
