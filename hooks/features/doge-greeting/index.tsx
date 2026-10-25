import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { FRAME_MS, bandSize, createPacer } from '../aurora-common/aurora'
import { playStartedAt, setTicker, startPlay, stopTicker } from '../aurora-common/ticker'
import { CAPTION, TOTAL_MS, dogeCells, rowsFor } from './doge'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

const welcomeAtom = atom(
  { plugin: 'rich-ui', key: 'welcome' } as const,
  CAPTION,
  { shape: 'welcome-1' },
)

export const dogeGreeting: Feature = {
  id: 'doge-greeting',
  name: 'Doge greeting',
  description: 'A big orange "welcome" fades in from the left above the prompt, then disappear, once per session',
  defaultEnabled: false,
}

export const MAX_COLUMNS = 400
const RASTER_KEY = 'doge-greeting'

// The same shape as the other greetings: the band above the prompt, drawn once per
// session (and once more after /clear) on an idle prompt, repainted by one timer, then
// handed back to the engine. The band is as wide as the prompt and as tall as the engine
// allows (at most half the terminal, less one row); "welcome" is centred in it over
// the terminal's own background, fading in from the left and out from the left.
export const renderDoge: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), dogeGreeting)) {
    stopTicker(dogeGreeting.id)

    return next(e)
  }
  const rows = rowsFor(e.props.maxRows)
  if (bandSize(e.viewport) === undefined || rows === undefined) return next(e)

  try {
    const now = await $.clock.now()
    let start = playStartedAt(dogeGreeting.id)
    if (start === undefined) {
      // Not begun: only start on an idle prompt.
      if (e.props.hasSurvey || e.props.isWorking) return next(e)
      start = now
      startPlay(dogeGreeting.id, now)
    }
    // Played already; a redraw during the show keeps drawing it, after it the engine's.
    if (now - start >= TOTAL_MS) return next(e)

    const rest = await next(e)
    const text = await read($, welcomeAtom)
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId
    const columns = Math.max(1, Math.min(MAX_COLUMNS, e.props.bodyColumns ?? 80))

    let elapsed = now - start
    let lastCells = dogeCells(columns, rows, elapsed, text)
    const pacer = createPacer()
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      if (!pacer.begin()) return
      let isDenied = true
      try {
        elapsed += FRAME_MS
        // While it holds the picture is still: nothing to send until it ends.
        const cells = dogeCells(columns, rows, elapsed, text)
        if (cells === lastCells) isDenied = false
        else {
          lastCells = cells
          const result = await $.ui.blit({ requestId, key: RASTER_KEY, cells })
          isDenied = result.deny !== undefined
        }
      } catch {
        // A frame that fails is a frame skipped.
      }
      if (elapsed >= TOTAL_MS) {
        stopTicker(dogeGreeting.id, timer)
        // Ask for the redraw that hands the band back to the engine.
        $.ui.invalidate('ui.render')

        return
      }
      if (pacer.end(isDenied)) stopTicker(dogeGreeting.id, timer)
    })
    setTicker(dogeGreeting.id, timer)

    return (
      <Box flexDirection="column">
        <Raster key={RASTER_KEY} columns={columns} rows={rows} cells={lastCells} />
        {rest}
      </Box>
    )
  } catch {
    stopTicker(dogeGreeting.id)

    return next(e)
  }
}
