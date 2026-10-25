import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { playStartedAt, setTicker, startPlay, stopTicker } from './clock'
import { FRAME_MS, bandSize, createPacer } from './frames'
import { CAPTION, TOTAL_MS, cleanText, rowsFor, welcomeCells } from './welcome'

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

export const welcomeGreeting: Feature = {
  id: 'welcome-greeting',
  name: 'Welcome greeting',
  description: 'A big orange "welcome" sweeps in above the prompt once per session, then is gone',
  isExperimental: true,
  defaultEnabled: false,
}

export const MAX_COLUMNS = 400
const RASTER_KEY = 'welcome-greeting'

// The band above the prompt, drawn once per
// session (and once more after /clear) on an idle prompt, repainted by one timer, then
// handed back to the engine. The band is as wide as the prompt and as tall as the engine
// allows (at most half the terminal, less one row); "welcome" is centred in it over
// the terminal's own background, fading in from the left and out from the left.
export const renderWelcome: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), welcomeGreeting)) {
    stopTicker()

    return next(e)
  }
  const rows = rowsFor(e.props.maxRows)
  if (bandSize(e.viewport) === undefined || rows === undefined) return next(e)

  try {
    const now = await $.clock.now()
    let start = playStartedAt()
    if (start === undefined) {
      // Not begun: only start on an idle prompt.
      if (e.props.hasSurvey || e.props.isWorking) return next(e)
      start = now
      startPlay(now)
    }
    // A turn has started (the person pressed Enter): the greeting is over at once, so it
    // never sits over the transcript while Claude answers, and it does not come back.
    if (start !== undefined && e.props.isWorking) {
      stopTicker()
      startPlay(now - TOTAL_MS)

      return next(e)
    }
    // Played already; a redraw during the show keeps drawing it, after it the engine's.
    if (now - start >= TOTAL_MS) return next(e)

    const rest = await next(e)
    // The field keeps what was typed; the sign shows it cleaned to what the font draws.
    const text = cleanText(await read($, welcomeAtom))
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId
    const columns = Math.max(1, Math.min(MAX_COLUMNS, e.props.bodyColumns ?? 80))

    let elapsed = now - start
    let lastCells = welcomeCells(columns, rows, elapsed, text)
    const pacer = createPacer()
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      if (!pacer.begin()) return
      let isDenied = true
      try {
        elapsed += FRAME_MS
        // While it holds the picture is still: nothing to send until it ends.
        const cells = welcomeCells(columns, rows, elapsed, text)
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
        stopTicker(timer)
        // Ask for the redraw that hands the band back to the engine.
        $.ui.invalidate('ui.render')

        return
      }
      if (pacer.end(isDenied)) stopTicker(timer)
    })
    setTicker(timer)

    return (
      <Box flexDirection="column">
        <Raster key={RASTER_KEY} columns={columns} rows={rows} cells={lastCells} />
        {rest}
      </Box>
    )
  } catch {
    stopTicker()

    return next(e)
  }
}
