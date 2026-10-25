import type { Elements } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../types'
import type { Feature } from '../core/feature'
import { BANNER_COLUMNS, BANNER_ROWS, bannerCells } from './banner'
import { clip, HEADER_ROWS } from './size'

export type PaneView = {
  elements: Elements['terminal']
  features: Feature[]
  enabled: EnabledMap
  status: StatusMap
  saveFailed: boolean
  width: number
  isDocked: boolean
  version: string
  onToggle: (feature: Feature) => void
}

// The switch beside a name: same width on and off, so names line up, and the
// glyph says the state where colour cannot (monochrome, colour-blind).
export const PILL_ON = '● on '
export const PILL_OFF = '○ off'
const PILL_GAP = 2
const GUTTER = 1
const CHIP_GAP = 2

// What a row's chip says, if anything: a healthy feature has none.
export function chipFor(entry: StatusMap[string] | undefined) {
  if (entry?.error) return { text: 'error', color: 'error' } as const
  if (entry && entry.notes.length > 0) return { text: 'note', color: 'warning' } as const

  return undefined
}

// Builds the pane from plain data and a callback: the engine's module scan
// rejects a function that is handed `$`, so the hook reads the state and writes
// the toggle itself. Colours are theme keys; only the banner's Raster is raw.
export function buildPane(view: PaneView) {
  const { Box, Text, Button, Raster } = view.elements
  const inner = view.width - GUTTER * 2
  const indent = ' '.repeat(PILL_OFF.length + PILL_GAP)
  const onCount = view.features.filter(
    feature => view.enabled[feature.id] ?? feature.defaultEnabled,
  ).length
  const summary = `${onCount} of ${view.features.length} on`
  const hasBanner = inner >= BANNER_COLUMNS + summary.length + 2
  const rule = <Text color="text" dimColor>{'─'.repeat(Math.max(0, view.width))}</Text>

  return (
    <Box flexDirection="column" paddingX={view.isDocked ? 1 : 0}>
      <Box key="header" height={HEADER_ROWS} paddingX={GUTTER} justifyContent="space-between">
        {hasBanner ? (
          <Raster key="banner" columns={BANNER_COLUMNS} rows={BANNER_ROWS} cells={bannerCells()} />
        ) : (
          <Box height={HEADER_ROWS} alignItems="center">
            <Text bold color="text">
              rich-ui
            </Text>
          </Box>
        )}
        <Box height={HEADER_ROWS} alignItems="flex-end">
          <Text dimColor>{clip(summary, inner)}</Text>
        </Box>
      </Box>
      {rule}
      {view.features.map((feature, index) => {
        const isOn = view.enabled[feature.id] ?? feature.defaultEnabled
        const entry = view.status[feature.id]
        const chip = chipFor(entry)
        const nameWidth =
          inner - PILL_OFF.length - PILL_GAP - (chip ? chip.text.length + CHIP_GAP : 0)

        return (
          <Box
            key={`row-${feature.id}`}
            flexDirection="column"
            paddingX={GUTTER}
            marginTop={1}
            hover={{ backgroundColor: 'subtle' }}
          >
            <Box>
              <Button
                key={feature.id}
                plain
                autoFocus={index === 0 ? true : undefined}
                onPress={() => view.onToggle(feature)}
              >
                <Text color={isOn ? 'success' : 'inactive'} bold={isOn}>
                  {isOn ? PILL_ON : PILL_OFF}
                </Text>
                <Text color="text">{' '.repeat(PILL_GAP)}</Text>
                <Text color="text">{clip(feature.name, nameWidth)}</Text>
              </Button>
              {chip && (
                <Text color={chip.color}>
                  {' '.repeat(CHIP_GAP)}
                  {chip.text}
                </Text>
              )}
            </Box>
            <Text dimColor hover={{ dimColor: false }}>
              {clip(`${indent}${feature.description}`, inner)}
            </Text>
            {entry?.error && (
              <Text color="warning">
                {clip(
                  `${indent}${feature.name}: failed ${entry.error.count} time${
                    entry.error.count === 1 ? '' : 's'
                  }, last error: ${entry.error.message}`,
                  inner,
                )}
              </Text>
            )}
            {entry?.notes.map(note => (
              <Text dimColor>{clip(`${indent}${note}`, inner)}</Text>
            ))}
          </Box>
        )
      })}
      {view.saveFailed && (
        <Box paddingX={GUTTER} marginTop={1}>
          <Text color="warning">Couldn't save your choice</Text>
        </Box>
      )}
      <Box paddingX={GUTTER} marginTop={view.saveFailed ? 0 : 1}>
        <Text dimColor>
          {clip(`Enter toggles · Esc closes · rich-ui ${view.version}`, inner)}
        </Text>
      </Box>
    </Box>
  )
}
