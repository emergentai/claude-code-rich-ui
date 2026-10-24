import { atom, read } from 'claude-code'
import type { Hook, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { FRAME_MS, auroraCells, bandSize, toneOf } from './aurora'
import type { Tone } from './aurora'
import { setTicker, stopAurora } from './ticker'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const auroraSpinner: Feature = {
  id: 'aurora-spinner',
  name: 'Aurora spinner',
  description: 'A slowly shifting gradient above the spinner while Claude works',
  defaultEnabled: false,
}

// Frames in flight beyond this many missed blits in a row mean the Raster is gone
// (the spinner unmounted, the turn ended): about two seconds at the frame rate.
export const MAX_MISSES = 25
const RASTER_KEY = 'aurora'

async function themeTone($: Parameters<MatchedHook<'ui.render', { component: 'Spinner' }>>[0]): Promise<Tone> {
  return toneOf((await $.config.list()).find(row => row.key === 'theme')?.value)
}

// The stock spinner line is kept whole: `next(e)` is the engine's own drawing (the
// word, elapsed time, tokens, the esc hint, tips), placed under a Raster that the
// timer below repaints with `$.ui.blit`. Nothing of the stock line is rewritten, so
// what Claude is doing stays exactly as visible as without the mod. The hook runs
// when the word, mode or message changes, not on every animation frame.
export const renderSpinner: MatchedHook<'ui.render', { component: 'Spinner' }> = async (
  $,
  e,
  next,
) => {
  // The desktop and VS Code draw this site too; only the terminal gets the band. The
  // site's requestId is the engine's own id for the drawing (seen in a real run: a
  // uuid, not an agent id), so it is used as given for the blit and never compared.
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), auroraSpinner)) {
    stopAurora()

    return next(e)
  }
  const size = bandSize(e.viewport)
  if (size === undefined) {
    stopAurora()

    return next(e)
  }

  try {
    const stock = await next(e)
    const tone = await themeTone($)
    const startedAt = await $.clock.now()
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId

    let frame = 0
    let misses = 0
    let isBusy = false
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      // A host slower than the frame rate drops frames rather than queueing them.
      if (isBusy) return
      isBusy = true
      try {
        frame += 1
        const t = (startedAt + frame * FRAME_MS) / 1000
        const result = await $.ui.blit({
          requestId,
          key: RASTER_KEY,
          cells: auroraCells(size.columns, size.rows, t, tone),
        })
        misses = result.deny === undefined ? 0 : misses + 1
        if (misses >= MAX_MISSES) stopAurora(timer)
      } catch {
        // A frame that fails is a frame skipped; the spinner line is not ours.
        misses += 1
        if (misses >= MAX_MISSES) stopAurora(timer)
      } finally {
        isBusy = false
      }
    })
    setTicker(timer)

    return (
      <Box flexDirection="column">
        <Raster
          key={RASTER_KEY}
          columns={size.columns}
          rows={size.rows}
          cells={auroraCells(size.columns, size.rows, startedAt / 1000, tone)}
        />
        {stock}
      </Box>
    )
  } catch {
    stopAurora()

    return next(e)
  }
}

// The turn is over, answered, interrupted or failed: stop painting. The unmount
// would end it within two seconds anyway; this makes it immediate. The turn's own
// end is passed on untouched and never waits on this.
export const stopOnTurnComplete: Hook<'turn.complete'> = (_, e, next) => {
  if (e.agentId === undefined) stopAurora()

  return next(e)
}
