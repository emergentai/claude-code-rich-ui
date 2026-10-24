import type { Elements } from 'claude-code'

import type { PreviewState } from '../../../types'
import { clipText, textImages } from './preview'
import { fitTables } from './tables'

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
  // Tables grow when drawn, so the limit is applied to what is drawn.
  const drawn =
    state.text === undefined
      ? undefined
      : clipText(fitTables(textImages(state.text), view.width - (view.isDocked ? 2 : 0)))
  const isCut = Boolean(state.isTruncated) || Boolean(drawn?.isTruncated)

  return (
    <Box flexDirection="column" paddingX={view.isDocked ? 1 : 0}>
      <Text dimColor wrap="wrap">
        {state.path ?? 'Markdown preview'}
      </Text>
      <Text> </Text>
      {state.error && (
        <Text color="warning" wrap="wrap">
          {state.error}
        </Text>
      )}
      {drawn && <Markdown text={drawn.text} />}
      {isCut && (
        <Text dimColor>The file is longer than the preview shows; the rest is cut.</Text>
      )}
      <Text> </Text>
      <Text dimColor>Esc closes · a ⧉ link in a reply reloads it</Text>
    </Box>
  )
}

export type LinkedReplyView = {
  elements: Elements['terminal']
  text: string
  links: string[]
  isFirstOfReply: boolean
  onLinkPress: (href: string) => void
}

// An assistant reply drawn by the engine's Markdown, with the links to local
// markdown files answered by the plugin. The frame is the engine's: a blank
// line above and the bullet in a two-cell column on the first block of a reply.
export function buildLinkedReply(view: LinkedReplyView) {
  const { Box, Text, Markdown } = view.elements

  return (
    <Box flexDirection="row" marginTop={1}>
      <Box width={2} flexShrink={0}>
        {view.isFirstOfReply ? <Text color="text">⏺</Text> : <Text> </Text>}
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Markdown
          key="reply"
          text={view.text}
          pressableLinks={view.links}
          onLinkPress={link => view.onLinkPress(link.href)}
        />
      </Box>
    </Box>
  )
}
