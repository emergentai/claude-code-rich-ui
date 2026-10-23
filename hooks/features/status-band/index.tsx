import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, UsageSnapshot } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { fitSegments, segmentsFor } from './band'
import { buildBand, INDENT } from './view'

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
  description: 'Show context and plan usage above the prompt when they run high',
  defaultEnabled: true,
}

// The engine raises session.measure when a figure moves; the band redraws
// because it reads the atom this writes.
export const recordUsage: Hook<'session.measure'> = async ($, e, next) => {
  await update($, usageAtom, () => ({
    contextPercent: e.context.percent,
    limits: e.rateLimits.map(limit => ({
      kind: limit.kind,
      percentUsed: limit.percentUsed,
      resetsAt: limit.resetsAt,
    })),
  }))

  return next(e)
}

export const renderBand: MatchedHook<
  'ui.render',
  { component: 'AbovePrompt' }
> = async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)
  if (e.props.hasSurvey) return next(e)
  if (!isOn(await read($, enabledAtom), statusBand)) return next(e)

  const segments = segmentsFor(await read($, usageAtom), await $.clock.now())
  if (segments.length === 0) return next(e)

  const width = e.props.bodyColumns
  const { Box } = $.ui.resolve(e)
  const others = await next(e)
  const band = buildBand({
    elements: $.ui.resolve(e),
    segments: fitSegments(segments, width - INDENT),
    width,
  })

  return others ? (
    <Box flexDirection="column">
      {others}
      {band}
    </Box>
  ) : (
    band
  )
}
