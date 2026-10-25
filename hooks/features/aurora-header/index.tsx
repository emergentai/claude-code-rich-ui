import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import {
  FRAME_MS,
  WORDMARK_ROWS,
  createPacer,
  toneOf,
  wordmarkCells,
  wordmarkWidth,
} from '../aurora-common/aurora'
import { setTicker, stopTicker } from '../aurora-common/ticker'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const auroraHeader: Feature = {
  id: 'aurora-header',
  name: 'Aurora pane header',
  description: 'The rich-ui wordmark in pixel type, shimmering, on top of this pane',
  defaultEnabled: false,
}

export const WORDMARK = 'rich-ui'
// The wordmark's rows plus the blank row under it.
export const HEADER_ROWS = WORDMARK_ROWS + 1
const RASTER_KEY = 'aurora-header'

// Wraps the manager's pane: the wordmark above whatever the pane draws, repainted while
// the pane is open. A closed pane denies the repaint, which ends the timer.
export const renderHeader: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: 'rich-ui' }
> = async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)
  const width = wordmarkWidth(WORDMARK)
  if (!isOn(await read($, enabledAtom), auroraHeader) || (e.props.bodyColumns ?? 0) < width + 2) {
    stopTicker(auroraHeader.id)

    return next(e)
  }

  try {
    const body = await next(e)
    const tone = toneOf((await $.config.list()).find(row => row.key === 'theme')?.value)
    const startedAt = await $.clock.now()
    const { Box, Text, Raster } = $.ui.resolve(e)
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
          cells: wordmarkCells(WORDMARK, (startedAt + frame * FRAME_MS) / 1000, tone),
        })
        isDenied = result.deny !== undefined
      } catch {
        // A frame that fails is a frame skipped.
      }
      if (pacer.end(isDenied)) stopTicker(auroraHeader.id, timer)
    })
    setTicker(auroraHeader.id, timer)

    return (
      <Box flexDirection="column">
        <Raster
          key={RASTER_KEY}
          columns={width}
          rows={WORDMARK_ROWS}
          cells={wordmarkCells(WORDMARK, startedAt / 1000, tone)}
        />
        <Text> </Text>
        {body}
      </Box>
    )
  } catch {
    stopTicker(auroraHeader.id)

    return next(e)
  }
}
