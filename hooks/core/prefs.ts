import { read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EnabledMap } from '../../types'
import { clearStatus } from './errors'
import { enabledAtom, saveFailedAtom } from './state'

const STORE_KEY = 'prefs'

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

export async function loadPrefs($: EngineInterface): Promise<void> {
  const enabled = parseStored(await $.store.get(STORE_KEY))
  await update($, enabledAtom, () => enabled)
}

export async function isEnabled(
  $: EngineInterface,
  id: string,
  defaultEnabled: boolean,
): Promise<boolean> {
  const map = await read($, enabledAtom)

  return map[id] ?? defaultEnabled
}

export async function toggleFeature(
  $: EngineInterface,
  id: string,
  defaultEnabled: boolean,
): Promise<void> {
  const next = !(await isEnabled($, id, defaultEnabled))
  await update($, enabledAtom, map => ({ ...map, [id]: next }))
  await clearStatus($, id)

  const enabled = await read($, enabledAtom)
  try {
    await $.store.set(STORE_KEY, { v: 1, enabled })
    await update($, saveFailedAtom, () => false)
  } catch {
    await update($, saveFailedAtom, () => true)
  }
}
