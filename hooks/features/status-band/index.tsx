import { atom, read, update } from 'claude-code'
import type { Hook } from 'claude-code'

import type { EnabledMap, UsageSnapshot } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { resetGreeting, stopTicker } from '../welcome-greeting/clock'
import { bandText, segmentsFor } from './band'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)
const usageAtom = atom(
  { plugin: 'rich-ui', key: 'usage' } as const,
  { limits: [] } as UsageSnapshot,
  { shape: 'usage-1' },
)

export const statusBand: Feature = {
  id: 'status-band',
  name: 'Status band',
  description: 'Show context and plan usage when they run high',
  defaultEnabled: true,
}

// The line lives in the engine's own status row under the prompt, not in the
// band above it: that band shares its space with the slash menu and surveys
// and carries a collapse mark. The engine raises session.measure when a figure
// moves, which is when the line is rewritten. The manager clears or restores it
// when the feature is toggled (manager/index.ts).
async function refreshStatus($: Parameters<Hook<'session.measure'>>[0]) {
  const isShown = isOn(await read($, enabledAtom), statusBand)
  $.ui.status(
    isShown ? bandText(segmentsFor(await read($, usageAtom), await $.clock.now())) : undefined,
  )
}

export const recordUsage: Hook<'session.measure'> = async ($, e, next) => {
  const snapshot: UsageSnapshot = {
    contextPercent: e.context.percent,
    limits: e.rateLimits.map(limit => ({
      kind: limit.kind,
      percentUsed: limit.percentUsed,
      resetsAt: limit.resetsAt,
    })),
  }
  await update($, usageAtom, () => snapshot)
  await refreshStatus($)

  return next(e)
}

// /clear ends the session under reason 'clear' and the process goes on under
// a new session id with no session.start (docs: SessionEndInput.reason). The
// usage atom survives that handoff with its pre-clear reading, so it is reset
// here instead of waiting on a session.measure that may not come soon.
export const onSessionEnd: Hook<'session.end'> = async ($, e, next) => {
  // The engine allows one unmatched session.end hook, so the welcome greeting's stop rides
  // here (every reason; /clear also lets it play again). Synchronous, and cannot throw.
  if (e.reason === 'clear') resetGreeting()
  else stopTicker()
  if (e.reason === 'clear') {
    await update($, usageAtom, () => ({ limits: [] }) as UsageSnapshot)
    await refreshStatus($)
  }

  return next(e)
}
