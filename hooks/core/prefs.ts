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

export function serialize(enabled: EnabledMap) {
  return { v: 1, enabled }
}

// The flag a toggle would set: the opposite of the feature's effective flag.
export function toggled(
  enabled: EnabledMap,
  feature: { id: string; defaultEnabled: boolean },
): EnabledMap {
  const current = enabled[feature.id] ?? feature.defaultEnabled

  return { ...enabled, [feature.id]: !current }
}
