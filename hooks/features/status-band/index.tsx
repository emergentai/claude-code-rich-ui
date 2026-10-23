import { atom, read, update } from 'claude-code'
import type { Hook } from 'claude-code'

import type { EnabledMap, UsageSnapshot } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
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
  description: 'Show context and plan usage under the prompt when they run high',
  defaultEnabled: true,
}

// The line lives in the engine's own status row under the prompt, not in the
// band above it: that band shares its space with the slash menu and surveys
// and carries a collapse mark. The engine raises session.measure when a figure
// moves, which is when the line is rewritten. The manager clears or restores it
// when the feature is toggled (manager/index.ts).
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

  const isShown = isOn(await read($, enabledAtom), statusBand)
  $.ui.status(
    isShown ? bandText(segmentsFor(snapshot, await $.clock.now())) : undefined,
  )

  return next(e)
}
