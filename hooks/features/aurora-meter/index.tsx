import { atom, read } from 'claude-code'
import type { MatchedHook, Timer } from 'claude-code'

import type { EnabledMap, UsageSnapshot } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { FRAME_MS, createPacer, meterCells, toneOf } from '../aurora-common/aurora'
import { setTicker, stopTicker } from '../aurora-common/ticker'
import { segmentsFor } from '../status-band/band'

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

export const auroraMeter: Feature = {
  id: 'aurora-meter',
  name: 'Aurora usage meter',
  description: 'Show the status band as a row above the prompt with a drifting gradient bar',
  defaultEnabled: false,
}

export const METER_COLUMNS = 14
const RASTER_KEY = 'aurora-meter'
const SEPARATOR = '  ·  '

// The status band's segments (same thresholds, so a healthy session shows nothing) as one
// row above the prompt, the context bar drawn as a gradient that drifts. The status
// band's own text line is cleared while this is on (status-band/index.tsx), so the same
// figures are never shown twice.
export const renderMeter: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), auroraMeter) || e.props.hasSurvey) {
    stopTicker(auroraMeter.id)

    return next(e)
  }
  const usage = await read($, usageAtom)
  const now = await $.clock.now()
  const segments = segmentsFor(usage, now)
  if (segments.length === 0 || (e.props.bodyColumns ?? 0) < METER_COLUMNS + 30) {
    stopTicker(auroraMeter.id)

    return next(e)
  }

  try {
    const rest = await next(e)
    const tone = toneOf((await $.config.list()).find(row => row.key === 'theme')?.value)
    const { Box, Text, Raster } = $.ui.resolve(e)
    const requestId = e.requestId
    const fraction = (usage.contextPercent ?? 0) / 100

    // Only the context segment has a bar to animate; a limit alone is plain text.
    if (segments.some(segment => segment.id === 'context')) {
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
            cells: meterCells(METER_COLUMNS, fraction, (now + frame * FRAME_MS) / 1000, tone),
          })
          isDenied = result.deny !== undefined
        } catch {
          // A frame that fails is a frame skipped.
        }
        if (pacer.end(isDenied)) stopTicker(auroraMeter.id, timer)
      })
      setTicker(auroraMeter.id, timer)
    } else {
      stopTicker(auroraMeter.id)
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {segments.map((segment, index) => (
            <Box key={`seg-${segment.id}`} flexDirection="row">
              {index > 0 && <Text dimColor>{SEPARATOR}</Text>}
              {segment.id === 'context' ? (
                <Box flexDirection="row">
                  <Text color={segment.isWarning ? 'warning' : 'text'}>context </Text>
                  <Raster
                    key={RASTER_KEY}
                    columns={METER_COLUMNS}
                    rows={1}
                    cells={meterCells(METER_COLUMNS, fraction, now / 1000, tone)}
                  />
                  <Text color={segment.isWarning ? 'warning' : 'text'}>
                    {` ${Math.round(usage.contextPercent ?? 0)}%`}
                  </Text>
                </Box>
              ) : (
                <Text color={segment.isWarning ? 'warning' : 'text'}>{segment.text}</Text>
              )}
            </Box>
          ))}
        </Box>
        {rest}
      </Box>
    )
  } catch {
    stopTicker(auroraMeter.id)

    return next(e)
  }
}
