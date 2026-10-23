import type { Elements } from 'claude-code'

import { clip } from '../../manager/size'
import { SEPARATOR } from './band'
import type { Segment } from './band'

// Two cells in, like the prompt's own text, so the band lines up with it.
export const INDENT = 2

export type BandView = {
  elements: Elements['terminal']
  segments: Segment[]
  width: number
}

// One dim row. Only a segment near its limit leaves dim, in the theme's
// `warning` color: no fixed colors, so it reads in the light and dark themes.
export function buildBand(view: BandView) {
  const { Box, Text } = view.elements
  const last = view.segments.length - 1
  let room = view.width - INDENT

  return (
    <Box paddingLeft={INDENT}>
      {view.segments.map((segment, index) => {
        const text = clip(segment.text, room)
        room -= text.length + SEPARATOR.length

        return (
          <Text key={segment.id} dimColor={!segment.isWarning} color={segment.isWarning ? 'warning' : undefined}>
            {text}
            {index < last ? SEPARATOR : ''}
          </Text>
        )
      })}
    </Box>
  )
}
