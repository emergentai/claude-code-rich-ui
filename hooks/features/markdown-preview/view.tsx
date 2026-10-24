import type { Elements } from 'claude-code'

import type { PreviewState } from '../../../types'
import { clip } from '../../manager/size'

export type PreviewView = {
  elements: Elements['terminal']
  state: PreviewState
  width: number
  isDocked: boolean
}

// Builds the pane from plain data: the hook reads the state itself, because the
// engine's module scan rejects a function that is handed `$`.
export function buildPreview(view: PreviewView) {
  const { Box, Text, Markdown } = view.elements
  const { state } = view

  return (
    <Box flexDirection="column" paddingX={view.isDocked ? 1 : 0}>
      <Text bold color="text">
        {clip(state.path ?? 'Markdown preview', view.width)}
      </Text>
      <Text> </Text>
      {state.error && <Text color="warning">{clip(state.error, view.width)}</Text>}
      {!state.error && state.text === undefined && (
        <Text dimColor>
          No markdown file yet. Run /preview &lt;path&gt;, or let Claude write one.
        </Text>
      )}
      {state.text !== undefined && <Markdown text={state.text} />}
      {state.isTruncated && (
        <Text dimColor>The file is longer than the preview shows; the rest is cut.</Text>
      )}
      <Text> </Text>
      <Text dimColor>Esc closes · /preview reloads</Text>
    </Box>
  )
}
