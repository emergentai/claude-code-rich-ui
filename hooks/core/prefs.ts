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

// The flag a toggle would set: the opposite of the feature's effective flag.
export function toggled(
  enabled: EnabledMap,
  feature: { id: string; defaultEnabled: boolean },
): EnabledMap {
  const current = enabled[feature.id] ?? feature.defaultEnabled

  return { ...enabled, [feature.id]: !current }
}

// What a save changes. Each choice is its own store entry, so a save writes only the entries it names
// and cannot write back over one another session saved in the meantime: the store has no way to
// change a record only if it is unchanged, and a record holding every choice would lose a race
// between two sessions no matter how it was read first.
export type PrefsChange = {
  enabled?: EnabledMap
  welcome?: { text: string | undefined }
}

export const enabledKey = (id: string) => `prefs.enabled.${id}`
export const WELCOME_KEY = 'prefs.welcome'

// What the store holds for the welcome sign: the text, or null for the default (told apart from
// nothing, which leaves the legacy record's text standing).
export const welcomeValue = (text: string | undefined) => text ?? null

// The choices the store holds: one record under `prefs` (what v0.6.0 and before wrote) with each
// entry of its own laid over it. `entries` is what the store gave for each feature's key.
export function readPrefs(legacy: unknown, entries: Record<string, unknown>, welcome: unknown) {
  const enabled = parseStored(legacy)
  for (const [id, value] of Object.entries(entries)) {
    if (typeof value === 'boolean') enabled[id] = value
  }

  return {
    enabled,
    welcome: typeof welcome === 'string' ? welcome : welcome === null ? undefined : parseWelcome(legacy),
  }
}
