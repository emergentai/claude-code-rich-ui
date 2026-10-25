import { atom, read } from 'claude-code'
import type { Hook, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { FRAME_MS, auroraCells, bandSize, createPacer, toneOf } from '../aurora-common/aurora'
import { setTicker, stopTicker } from '../aurora-common/ticker'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const auroraSpinner: Feature = {
  id: 'aurora-spinner',
  name: 'Aurora spinner',
  description: 'A small drifting gradient swatch beside the spinner while Claude works',
  defaultEnabled: false,
}

const SWATCH_COLUMNS = 4
const SWATCH_ROWS = 1
const RASTER_KEY = 'aurora-spinner'

// The stock spinner block (the word, elapsed time, tokens, the esc hint, tips) is kept
// whole: `next(e)` is the engine's own drawing, placed to the right of a one-row swatch
// that a timer repaints with `$.ui.blit`. The hook runs when the word, mode or message
// changes, not on every frame. A window under 50 columns or 24 rows keeps the stock line.
export const renderSpinner: MatchedHook<'ui.render', { component: 'Spinner' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), auroraSpinner) || bandSize(e.viewport) === undefined) {
    stopTicker(auroraSpinner.id)

    return next(e)
  }

  try {
    const stock = await next(e)
    const tone = toneOf((await $.config.list()).find(row => row.key === 'theme')?.value)
    const startedAt = await $.clock.now()
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId

    let frame = 0
    const pacer = createPacer()
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      if (!pacer.begin()) return
      let isDenied = true
      try {
        frame += 1
        const result = await $.ui.blit({
          requestId,
          key: RASTER_KEY,
          cells: auroraCells(SWATCH_COLUMNS, SWATCH_ROWS, (startedAt + frame * FRAME_MS) / 1000, tone),
        })
        isDenied = result.deny !== undefined
      } catch {
        // A frame that fails is a frame skipped; the spinner line is not ours.
      }
      if (pacer.end(isDenied)) stopTicker(auroraSpinner.id, timer)
    })
    setTicker(auroraSpinner.id, timer)

    return (
      <Box flexDirection="row" alignItems="flex-start">
        <Box marginRight={1} marginTop={1}>
          <Raster
            key={RASTER_KEY}
            columns={SWATCH_COLUMNS}
            rows={SWATCH_ROWS}
            cells={auroraCells(SWATCH_COLUMNS, SWATCH_ROWS, startedAt / 1000, tone)}
          />
        </Box>
        {stock}
      </Box>
    )
  } catch {
    stopTicker(auroraSpinner.id)

    return next(e)
  }
}

// The one unmatched turn.complete hook of the plugin: it stops the spinner's timer at
// once (answered, interrupted or failed). The turn's own end is passed on untouched.
export const onTurnComplete: Hook<'turn.complete'> = (_, e, next) => {
  if (e.agentId === undefined) stopTicker(auroraSpinner.id)

  return next(e)
}
