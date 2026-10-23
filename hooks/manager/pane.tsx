import type { Elements } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../types'
import type { Feature } from '../core/feature'
import { clip } from './size'

export type PaneView = {
  elements: Elements['terminal']
  features: Feature[]
  enabled: EnabledMap
  status: StatusMap
  saveFailed: boolean
  width: number
  version: string
  onToggle: (feature: Feature) => void
  onClose: () => void
}

// Builds the manager from plain data and callbacks: the engine's module scan
// rejects a function that is handed `$`, so the hook reads the state and writes
// the toggle itself.
export function buildPane(view: PaneView) {
  const { Box, Text, Button } = view.elements

  return (
    <Box flexDirection="column">
      <Text bold>rich-ui features</Text>
      {view.features.map((feature, index) => {
        const isOn = view.enabled[feature.id] ?? feature.defaultEnabled
        const mark = isOn ? '[x]' : '[ ]'
        const entry = view.status[feature.id]

        return (
          <Box key={`row-${feature.id}`} flexDirection="column">
            <Button
              key={feature.id}
              plain
              autoFocus={index === 0 ? true : undefined}
              onPress={() => view.onToggle(feature)}
            >
              {mark} {feature.name}
            </Button>
            <Text dimColor>{clip(`    ${feature.description}`, view.width)}</Text>
            {entry?.error && (
              <Text color="warning">
                {clip(
                  `    ${feature.name}: failed ${entry.error.count} time${
                    entry.error.count === 1 ? '' : 's'
                  }, last error: ${entry.error.message}`,
                  view.width,
                )}
              </Text>
            )}
            {entry?.notes.map(note => (
              <Text dimColor>{clip(`    ${note}`, view.width)}</Text>
            ))}
          </Box>
        )
      })}
      {view.saveFailed && <Text color="warning">Couldn't save your choice</Text>}
      <Text dimColor>
        {clip('Click a row to toggle it, or press ctrl+x then Tab to use the keyboard', view.width)}
      </Text>
      <Box>
        <Button key="close" plain dimColor onPress={() => view.onClose()}>
          close
        </Button>
        <Text dimColor> · rich-ui {view.version}</Text>
      </Box>
    </Box>
  )
}
