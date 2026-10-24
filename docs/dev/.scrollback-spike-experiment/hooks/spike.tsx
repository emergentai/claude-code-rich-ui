// EXPERIMENT (scrollback spike), not shipped and not wired into rich-ui.
//
// A long Bash result keeps the engine's own row and gains one button under it.
// The button opens a pane with the whole output (read from the file the engine
// keeps when it cut the result), its own scrolling, line numbers and a copy
// button. Everything else, short results, errors, ctrl+o, is the engine's.
import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import type { Shown } from '../types'
import {
  bashSource,
  clipRows,
  describeSize,
  gutter,
  lineCount,
  shouldOffer,
  stripAnsi,
} from './output'

export const PANE_ID = 'spike-output'

const shownAtom = atom({ plugin: 'scrollback-spike', key: 'shown' } as const, null as Shown | null, {
  shape: 'shown-1',
})

export const renderResult: MatchedHook<'ui.render', { component: 'ToolResult' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  const p = e.props
  if (p.tool !== 'Bash') return next(e)
  const source = bashSource(p.output)
  if (!source) return next(e)
  const lines = lineCount(source.text)
  if (!shouldOffer({ lines, isErrored: p.isErrored, isExpanded: p.isExpanded === true })) {
    return next(e)
  }

  const { Box, Button } = $.ui.resolve(e)
  const engine = await next(e)
  const id = e.requestId
  const label =
    source.path === undefined
      ? `view all ${lines.toLocaleString('en-US')} lines`
      : `view full output${source.size === undefined ? '' : ` (${describeSize(source.size)})`}`

  return (
    <Box flexDirection="column">
      {engine}
      <Button
        key={`full-${id}`}
        plain
        dimColor
        onPress={() => {
          void (async () => {
            // Asked inside the press: a pane opened after an await is placed only
            // from 144 columns.
            const opened = await $.ui.open({
              id: PANE_ID,
              title: 'Output',
              focus: true,
              closeOnEscape: true,
              columns: 100,
            })
            if (!opened.isPlaced) $.ui.toast(`Output could not open: ${opened.reason}`)

            let text = source.text
            let note: string | undefined
            if (source.path !== undefined) {
              try {
                text = await $.fs.read(source.path)
              } catch (error) {
                note = `The rest of the output could not be read (${String(error)}); this is the first part.`
              }
            }
            await update($, shownAtom, () => ({
              id,
              tool: p.tool,
              text,
              total: lineCount(text),
              note,
            }))
          })()
        }}
      >
        {`[ ${label} ]`}
      </Button>
    </Box>
  )
}

export const renderPane: MatchedHook<'ui.render', { component: 'Pane'; requestId: 'spike-output' }> =
  async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const shown = await read($, shownAtom)
    if (shown === null) return <Text dimColor>Nothing to show.</Text>

    const clipped = clipRows(shown.text)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor wrap="truncate-end">
          {`${shown.tool} · ${shown.total.toLocaleString('en-US')} lines`}
        </Text>
        <Box flexDirection="row" gap={2}>
          <Button
            key="copy"
            plain
            onPress={press => {
              void (async () => {
                const done = await $.ui.copy({ text: stripAnsi(shown.text), surface: press.surface })
                await update($, shownAtom, one =>
                  one === null ? one : { ...one, copy: done.isCopied ? 'copied' : done.reason },
                )
              })()
            }}
          >
            {shown.copy === 'copied' ? '[ copied ]' : '[ copy all ]'}
          </Button>
          <Button key="top" plain onPress={() => void $.ui.scroll({ in: PANE_ID, to: 'start' }).catch(() => undefined)}>
            [ top ]
          </Button>
          <Button key="end" plain onPress={() => void $.ui.scroll({ in: PANE_ID, to: 'end' }).catch(() => undefined)}>
            [ bottom ]
          </Button>
        </Box>
        {shown.copy !== undefined && shown.copy !== 'copied' && (
          <Text color="warning">{`Copy failed: ${shown.copy}`}</Text>
        )}
        {shown.note !== undefined && <Text color="warning">{shown.note}</Text>}
        {clipped.rows.map((row, i) => (
          <Text wrap="truncate-end">
            <Text dimColor>{gutter(i, clipped.total)} </Text>
            {row}
          </Text>
        ))}
        {clipped.isCut && (
          <Text dimColor>{`Showing the first ${clipped.rows.length.toLocaleString('en-US')} of ${clipped.total.toLocaleString('en-US')} lines; copy takes all of them.`}</Text>
        )}
      </Box>
    )
  }
