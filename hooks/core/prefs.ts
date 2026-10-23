import { atom, update } from 'claude-code'
import type { Hook } from 'claude-code'

import type { EnabledMap } from '../../types'

export const STORE_KEY = 'prefs'

// The engine's module scan reads a state source only where it is written, so
// each file that touches a value declares its atom (see core/state.ts).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

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

// Loads the saved choices into state. An unreadable store means every feature
// uses its default (an empty map).
export const startSession: Hook<'session.start'> = async ($, e, next) => {
  let stored: EnabledMap = {}
  try {
    stored = parseStored(await $.store.get(STORE_KEY))
  } catch {
    // keep the empty map
  }
  await update($, enabledAtom, () => stored)

  return next(e)
}
