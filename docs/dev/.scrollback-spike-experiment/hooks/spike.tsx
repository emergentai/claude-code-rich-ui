// EXPERIMENT (scrollback spike), not shipped and not wired into rich-ui.
//
// A Bash call whose output the engine cut keeps the engine's own group line and
// gains one button under it. The button opens a pane with the whole output (read from the file the engine
// keeps when it cut the result), its own scrolling, line numbers and a copy
// button. Everything else, whole outputs, errors, running calls, is the engine's.
import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import type { Shown } from '../types'
import { clipRows, gutter, lineCount, offerFor, stripAnsi } from './output'

export const PANE_ID = 'spike-output'

const shownAtom = atom({ plugin: 'scrollback-spike', key: 'shown' } as const, null as Shown | null, {
  shape: 'shown-1',
})

// Where stock draws a Bash call in fullscreen: a ToolGroup folds every call into one line
// ("Ran 1 shell command"), expanded or not, so a standalone ToolResult is not
// reached for it. The group is wrapped: the engine's line, then one button per
// call whose output was cut.
export const renderGroup: MatchedHook<'ui.render', { component: 'ToolGroup' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal') return next(e)
  // The classic renderer captures no mouse, so a button there could not be pressed
  // (checked in tmux on 2.1.310). It also draws Bash as a standalone ToolResult,
  // which is left alone.
  if (e.viewport?.isFullscreen !== true) return next(e)
  const offers = e.props.calls.flatMap(call => {
    const offer = offerFor(call)

    return offer === undefined ? [] : [offer]
  })
  if (offers.length === 0) return next(e)

  const { Box, Button } = $.ui.resolve(e)
  const engine = await next(e)

  return (
    <Box flexDirection="column">
      {engine}
      {offers.map(offer => (
        <Box key={`row-${offer.id}`} paddingLeft={2}>
        <Button
          key={`full-${offer.id}`}
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

              let text = offer.source.text
              let note: string | undefined
              if (offer.source.path !== undefined) {
                try {
                  text = await $.fs.read(offer.source.path)
                } catch (error) {
                  note = `The rest of the output could not be read (${String(error)}); this is the first part.`
                }
              }
              await update($, shownAtom, () => ({
                id: offer.id,
                tool: 'Bash',
                text,
                total: lineCount(text),
                note,
              }))
            })()
          }}
        >
          {`[ ${offer.label} ]`}
        </Button>
        </Box>
      ))}
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
    // Drawn above the lines and again below them: the buttons are rows of the
    // tree, so they scroll away with it. Their keys work while the pane has focus.
    const controls = (suffix: string) => (
      <Box flexDirection="row" gap={2}>
        <Button
          key={`copy${suffix}`}
          plain
          hotkey="c"
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
        <Button
          key={`top${suffix}`}
          plain
          hotkey="t"
          onPress={() => void $.ui.scroll({ in: PANE_ID, to: 'start' }).catch(() => undefined)}
        >
          [ top ]
        </Button>
        <Button
          key={`end${suffix}`}
          plain
          hotkey="b"
          onPress={() => void $.ui.scroll({ in: PANE_ID, to: 'end' }).catch(() => undefined)}
        >
          [ bottom ]
        </Button>
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor wrap="truncate-end">
          {`${shown.tool} · ${shown.total.toLocaleString('en-US')} lines`}
        </Text>
        {controls('')}
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
        {controls('-end')}
      </Box>
    )
  }
