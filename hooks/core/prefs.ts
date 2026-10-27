import type { EnabledMap } from '../../types'

export const STORE_KEY = 'prefs'

export function parseStored(raw: unknown): EnabledMap {
  if (typeof raw !== 'object' || raw === null) return {}
  const stored = raw as { v?: unknown; enabled?: unknown }
  if (stored.v !== 1) return {}
  if (typeof stored.enabled !== 'object' || stored.enabled === null) return {}

  const out: EnabledMap = {}
  for (const [id, value] of Object.entries(stored.enabled)) {
    if (typeof value === 'boolean') out[id] = value
  }

  return out
}

// The text the welcome sign shows, if the person set one.
export function parseWelcome(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const stored = raw as { v?: unknown; welcome?: unknown }
  if (stored.v !== 1 || typeof stored.welcome !== 'string') return undefined

  return stored.welcome
}

export function serialize(enabled: EnabledMap, welcome?: string) {
  return welcome === undefined ? { v: 1, enabled } : { v: 1, enabled, welcome }
}

// The flag a toggle would set: the opposite of the feature's effective flag.
export function toggled(
  enabled: EnabledMap,
  feature: { id: string; defaultEnabled: boolean },
): EnabledMap {
  const current = enabled[feature.id] ?? feature.defaultEnabled

  return { ...enabled, [feature.id]: !current }
}

// What a save changes. Anything not named here is taken from the store as it is now,
// so a save never writes back a value this session only remembers from when it loaded.
export type PrefsChange = {
  enabled?: EnabledMap
  welcome?: { text: string | undefined }
}

export function mergePrefs(raw: unknown, change: PrefsChange) {
  return {
    enabled: { ...parseStored(raw), ...change.enabled },
    welcome: change.welcome ? change.welcome.text : parseWelcome(raw),
  }
}
