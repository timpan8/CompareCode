/**
 * Local persistence, and nothing more.
 *
 * Everything here stays inside this browser profile: there is no server to send
 * it to. Reads and writes are wrapped because storage can be unavailable or full
 * (a private window, blocked site data), and a diff tool must not break over a
 * convenience feature.
 */

export const SETTINGS_KEY = 'comparecode.settings.v1'
export const DOCUMENTS_KEY = 'comparecode.documents.v1'

export function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Out of quota or storage denied — the app works fine without it.
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do; there was nothing readable there either.
  }
}
