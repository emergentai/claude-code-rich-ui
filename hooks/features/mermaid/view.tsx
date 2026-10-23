import type { Elements } from 'claude-code'

import type { ShownMap } from '../../../types'
import type { Segment } from './detect'
import { fitDiagram } from './fit'
import type { Viewport } from './fit'

const LINE_CHARS = /[─-╿■-◿←-⇿]/

type Run = { text: string; isLine: boolean }

function runsOf(line: string): Run[] {
  const runs: Run[] = []
  for (const ch of line) {
    const isLine = LINE_CHARS.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.isLine === isLine) last.text += ch
    else runs.push({ text: ch, isLine })
  }

  return runs
}

export type ReplyView = {
  elements: Elements['terminal']
  segments: Segment[]
  viewport: Viewport
  requestId: string
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
        {isSource ? (
          <Markdown text={segment.raw} />
        ) : (
          lines.map(line => (
            <Text>
              {runsOf(line).map(run => (
                <Text color={run.isLine ? 'subtle' : undefined}>{run.text}</Text>
              ))}
            </Text>
          ))
        )}
        <Button key={`toggle${i}`} plain onPress={() => view.onToggle(id)}>
          {isSource ? 'show diagram' : 'show source'}
        </Button>
      </Box>
    )
  })

  return <Box flexDirection="column">{nodes}</Box>
}
