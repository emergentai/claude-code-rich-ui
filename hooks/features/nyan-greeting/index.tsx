import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { FRAME_MS, bandSize, createPacer } from '../aurora-common/aurora'
import { playStartedAt, setTicker, startPlay, stopTicker } from '../aurora-common/ticker'
import { BANNER_ROWS, TOTAL_MS, nyanCells } from './nyan'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const nyanGreeting: Feature = {
  id: 'nyan-greeting',
  name: 'Nyan greeting',
  description: 'A nyan cat flies across the window once per session, then it is gone',
  defaultEnabled: false,
}

export const MAX_COLUMNS = 400
const RASTER_KEY = 'nyan-greeting'

// The same shape as the aurora greeting: the band above the prompt, drawn once per
// session (and once more after /clear) on an idle prompt, repainted by one timer, then
// handed back to the engine. It spans the band's whole width (up to 400 columns), so
// the cat crosses the entire window.
export const renderNyan: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), nyanGreeting)) {
    stopTicker(nyanGreeting.id)

    return next(e)
  }
  if (bandSize(e.viewport) === undefined) return next(e)

  try {
    const now = await $.clock.now()
    let start = playStartedAt(nyanGreeting.id)
    if (start === undefined) {
      // Not begun: only start on an idle prompt.
      if (e.props.hasSurvey || e.props.isWorking) return next(e)
      start = now
      startPlay(nyanGreeting.id, now)
    }
    // A turn has started (the person pressed Enter): the greeting is over at once, so it
    // never sits over the transcript while Claude answers, and it does not come back.
    if (start !== undefined && e.props.isWorking) {
      stopTicker(nyanGreeting.id)
      startPlay(nyanGreeting.id, now - TOTAL_MS)

      return next(e)
    }
    // Played already; a redraw during the flight keeps drawing it, after it the engine's.
    if (now - start >= TOTAL_MS) return next(e)

    const rest = await next(e)
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId
    const columns = Math.max(1, Math.min(MAX_COLUMNS, e.props.bodyColumns ?? 80))

    let elapsed = now - start
    const pacer = createPacer()
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      if (!pacer.begin()) return
      let isDenied = true
      try {
        elapsed += FRAME_MS
        const result = await $.ui.blit({ requestId, key: RASTER_KEY, cells: nyanCells(columns, elapsed) })
        isDenied = result.deny !== undefined
      } catch {
        // A frame that fails is a frame skipped.
      }
      if (elapsed >= TOTAL_MS) {
        stopTicker(nyanGreeting.id, timer)
        // Ask for the redraw that hands the band back to the engine.
        $.ui.invalidate('ui.render')

        return
      }
      if (pacer.end(isDenied)) stopTicker(nyanGreeting.id, timer)
    })
    setTicker(nyanGreeting.id, timer)

    return (
      <Box flexDirection="column">
        <Raster key={RASTER_KEY} columns={columns} rows={BANNER_ROWS} cells={nyanCells(columns, elapsed)} />
        {rest}
      </Box>
    )
  } catch {
    stopTicker(nyanGreeting.id)

    return next(e)
  }
}
