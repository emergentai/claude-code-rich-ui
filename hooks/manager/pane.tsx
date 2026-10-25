import type { Elements } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../types'
import type { Feature } from '../core/feature'
import { BANNER_COLUMNS, BANNER_ROWS, bannerCells } from './banner'
import { clip, contentRows, experimentalCount, HEADER_ROWS } from './size'

export type PaneView = {
  elements: Elements['terminal']
  features: Feature[]
  enabled: EnabledMap
  status: StatusMap
  saveFailed: boolean
  width: number
  isDocked: boolean
  // The rows the pane's room has (`scroll.bodyRows`); only a dock uses it.
  bodyRows?: number
  version: string
  welcome: string
  welcomeRev: number
  onToggle: (feature: Feature) => void
  onWelcome: (text: string) => void
  onWelcomeDone: () => void
}

// The switch beside a name: same width on and off, so names line up, and the
// glyph says the state where colour cannot (monochrome, colour-blind).
export const PILL_ON = '● on '
export const PILL_OFF = '○ off'
const PILL_GAP = 2
const GUTTER = 1
const CHIP_GAP = 2
// The feature whose text field sits under its row (the id of features/welcome-greeting).
const WELCOME_ID = 'welcome-greeting'

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
  const { Box, Text, Button, Raster, Input } = view.elements
  const inner = view.width - GUTTER * 2
  const indent = ' '.repeat(PILL_OFF.length + PILL_GAP)
  const onCount = view.features.filter(
    feature => view.enabled[feature.id] ?? feature.defaultEnabled,
  ).length
  const summary = `${onCount} of ${view.features.length} on`
  const hasBanner = inner >= BANNER_COLUMNS + summary.length + 2
  const statusLines = Object.values(view.status).reduce(
    (total, entry) => total + (entry.error ? 1 : 0) + entry.notes.length,
    0,
  )
  // A dock is as tall as the terminal: when the content leaves room, fill it so
  // the footer sits at the bottom. If the content is taller, leave it to scroll.
  const pinHeight =
    view.isDocked &&
    view.bodyRows !== undefined &&
    view.bodyRows >
      contentRows(view.features.length, statusLines, view.saveFailed, experimentalCount(view.features))
      ? view.bodyRows
      : undefined
  const rule = <Text color="text" dimColor>{'─'.repeat(Math.max(0, view.width))}</Text>

  const regular = view.features.filter(feature => feature.isExperimental !== true)
  const experimental = view.features.filter(feature => feature.isExperimental === true)
  const renderRow = (feature: Feature) => {
    const index = view.features.indexOf(feature)
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
        {feature.id === WELCOME_ID && (
          <Box paddingLeft={indent.length}>
            <Input
              key={`welcome-text-${view.welcomeRev}`}
              label="Welcome text (20 max)"
              placeholder="welcome"
              value={view.welcome}
              submitLabel="done"
              onInput={text => view.onWelcome(text)}
              onSubmit={() => view.onWelcomeDone()}
            />
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={view.isDocked ? 1 : 0} height={pinHeight}>
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
      {regular.map(renderRow)}
      {experimental.length > 0 && (
        <Box key="experimental" flexDirection="column" paddingX={GUTTER} marginTop={1}>
          <Box>
            <Text bold color="text">
              Experimental
            </Text>
            <Text dimColor>{clip('  ·  may be removed in any version', inner - 'Experimental'.length)}</Text>
          </Box>
        </Box>
      )}
      {experimental.map(renderRow)}
      {pinHeight !== undefined && <Box flexGrow={1} />}
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
