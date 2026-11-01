export interface StorageDriver {
  get<T = unknown>(key: string): T | null
  set<T = unknown>(key: string, value: T): boolean
  remove(key: string): void
}

export class LocalStorageDriver implements StorageDriver {
  get<T = unknown>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return null
      return JSON.parse(item) as T
    } catch (e) {
      try {
        return (localStorage.getItem(key) as unknown) as T
      } catch {
        return null
      }
    }
  }

  set<T = unknown>(key: string, value: T): boolean {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(key, serialized)
      return true
    } catch (e) {
      console.error(`[Storage] Failed to persist key ${key} (Storage quota exceeded or storage disabled):`, e)
      return false
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
