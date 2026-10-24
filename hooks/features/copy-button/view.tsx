import type { Elements, RenderElement } from 'claude-code'

import { labelFor } from './blocks'
import type { CodeBlock } from './blocks'

export type CopyRowView = {
  elements: Elements['terminal']
  // What the plugins beneath and the engine drew for the reply, kept as it is.
  inner: RenderElement
  blocks: CodeBlock[]
  onCopy: (block: CodeBlock, surface: 'terminal') => void
}

// The engine's reply with one dim row after it, indented past the bullet column.
// Built from plain data and a callback: the engine's module scan rejects a
// function that is handed `$`.
export function buildCopyRow(view: CopyRowView) {
  const { Box, Button } = view.elements

  return (
    <Box flexDirection="column">
      {view.inner}
      <Box key="copy-row" marginLeft={2} columnGap={2} flexWrap="wrap">
        {view.blocks.map((block, i) => (
          <Button
            key={`copy${i + 1}`}
            plain
            dimColor
            onPress={() => view.onCopy(block, 'terminal')}
          >
            {labelFor(block, i, view.blocks.length)}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
