import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { BAND_ROWS, FRAME_MS, bandSize, createPacer, sweepCells, toneOf } from '../aurora-common/aurora'
import { playStartedAt, setTicker, startPlay, stopTicker } from '../aurora-common/ticker'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const auroraGreeting: Feature = {
  id: 'aurora-greeting',
  name: 'Aurora greeting',
  description: 'A brief aurora sweep above the prompt once per session, then it fades away',
  defaultEnabled: false,
}

export const GREETING_COLUMNS = 60
// In, hold, out.
export const SWEEP_IN_MS = 900
export const HOLD_MS = 1000
export const SWEEP_OUT_MS = 900
export const TOTAL_MS = SWEEP_IN_MS + HOLD_MS + SWEEP_OUT_MS
const RASTER_KEY = 'aurora-greeting'

// Where the sweep is at `ms`: the visible column range as fractions of the width.
export function sweepAt(ms: number): { from: number; to: number } {
  if (ms < SWEEP_IN_MS) return { from: 0, to: ms / SWEEP_IN_MS }
  if (ms < SWEEP_IN_MS + HOLD_MS) return { from: 0, to: 1 }

  return { from: Math.min(1, (ms - SWEEP_IN_MS - HOLD_MS) / SWEEP_OUT_MS), to: 1 }
}

// The band above the prompt, drawn once per session (and once more after /clear) when
// the prompt is idle, then handed back to the engine. Turned on mid-session it plays
// at the next redraw, so it can be judged without restarting.
export const renderGreeting: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), auroraGreeting)) {
    stopTicker(auroraGreeting.id)

    return next(e)
  }
  const size = bandSize(e.viewport)
  if (size === undefined) return next(e)

  try {
    const now = await $.clock.now()
    let start = playStartedAt(auroraGreeting.id)
    if (start === undefined) {
      // Not begun: only start on an idle prompt.
      if (e.props.hasSurvey || e.props.isWorking) return next(e)
      start = now
      startPlay(auroraGreeting.id, now)
    }
    // Played already; a redraw during the sweep keeps drawing it, after it the engine's.
    if (now - start >= TOTAL_MS) return next(e)

    const rest = await next(e)
    const tone = toneOf((await $.config.list()).find(row => row.key === 'theme')?.value)
    const { Box, Raster } = $.ui.resolve(e)
    const requestId = e.requestId
    const columns = Math.min(GREETING_COLUMNS, size.columns, Math.max(1, (e.props.bodyColumns ?? 60) - 1))

    let elapsed = now - start
    const pacer = createPacer()
    const timer: Timer = $.clock.every(FRAME_MS, async () => {
      if (!pacer.begin()) return
      let isDenied = true
      try {
        elapsed += FRAME_MS
        const { from, to } = sweepAt(elapsed)
        const result = await $.ui.blit({
          requestId,
          key: RASTER_KEY,
          cells: sweepCells(columns, BAND_ROWS, elapsed / 1000, tone, from, to),
        })
        isDenied = result.deny !== undefined
      } catch {
        // A frame that fails is a frame skipped.
      }
      if (elapsed >= TOTAL_MS) {
        stopTicker(auroraGreeting.id, timer)
        // Ask for the redraw that hands the band back to the engine.
        $.ui.invalidate('ui.render')

        return
      }
      if (pacer.end(isDenied)) stopTicker(auroraGreeting.id, timer)
    })
    setTicker(auroraGreeting.id, timer)
    const { from, to } = sweepAt(elapsed)

    return (
      <Box flexDirection="column">
        <Raster
          key={RASTER_KEY}
          columns={columns}
          rows={BAND_ROWS}
          cells={sweepCells(columns, BAND_ROWS, elapsed / 1000, tone, from, to)}
        />
        {rest}
      </Box>
    )
  } catch {
    stopTicker(auroraGreeting.id)

    return next(e)
  }
}
