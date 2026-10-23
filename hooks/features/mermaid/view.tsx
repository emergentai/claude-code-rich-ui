import type { Elements } from 'claude-code'

import type { ShownMap } from '../../../types'
import type { Segment } from './detect'
import { fitDiagram } from './fit'
import type { Viewport } from './fit'

export type ReplyView = {
  elements: Elements['terminal']
  segments: Segment[]
  viewport: Viewport
  requestId: string
  isFirstOfReply: boolean
  shown: ShownMap
  onToggle: (id: string) => void
}

// Builds the reply tree from plain data and callbacks: the engine's module scan
// rejects a function that is handed `$`, so the hook resolves the elements,
// reads `shown` and supplies `onToggle` itself.
export function buildReply(view: ReplyView) {
  const { Box, Text, Markdown, Button } = view.elements

  const nodes = view.segments.map((segment, i) => {
    if (segment.kind === 'text') {
      return <Markdown key={`t${i}`} text={segment.text} />
    }

    const lines = fitDiagram(segment.source, view.viewport)
    if (lines === null) {
      return <Markdown key={`r${i}`} text={segment.raw} />
    }

    const id = `${view.requestId}:${i}`
    const isSource = view.shown[id] === true

    return (
      <Box key={`d${i}`} flexDirection="column">
        <Button key={`toggle${i}`} plain dimColor onPress={() => view.onToggle(id)}>
          {isSource ? 'show diagram' : 'show source'}
        </Button>
        {isSource ? (
          <Markdown text={segment.raw} />
        ) : (
          lines.map(line => <Text>{line}</Text>)
        )}
      </Box>
    )
  })

  // The frame the engine draws around an assistant block: a blank line above,
  // the bullet in a two-cell column on the first block of a reply, the content
  // indented past it, and one blank line between the block's parts.
  return (
    <Box flexDirection="row" marginTop={1}>
      <Box width={2} flexShrink={0}>
        {view.isFirstOfReply ? <Text color="text">⏺</Text> : <Text> </Text>}
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1} gap={1}>
        {nodes}
      </Box>
    </Box>
  )
}
