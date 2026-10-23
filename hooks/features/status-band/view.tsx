import type { Elements } from 'claude-code'

import { clip } from '../../manager/size'
import { SEPARATOR } from './band'
import type { Segment } from './band'

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
  let room = view.width - 2

  return (
    <Box paddingX={1}>
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
