import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../../types'
import { messageOf, withError } from '../../core/errors'
import type { Feature } from '../../core/feature'
import { guard, isOn } from '../../core/gate'
import { copiedToast, copyableBlocks } from './blocks'
import { buildCopyRow } from './view'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)
const statusAtom = atom(
  { plugin: 'rich-ui', key: 'status' } as const,
  {} as StatusMap,
  { shape: 'status-1' },
)

const ANY_FENCE = /^[ \t]*(?:`{3,}|~{3,})/m

export const copyButton: Feature = {
  id: 'copy-button',
  name: 'Copy code',
  description: 'Add a copy button under code blocks in replies',
  defaultEnabled: true,
}

// Wraps whatever the plugins beneath and the engine draw for the reply (so it must
// be registered before mermaid and the markdown preview, which answer without
// calling `next` when they draw a reply themselves) and adds one row after it.
export const renderCopyRow: MatchedHook<
  'ui.render',
  { component: 'AssistantMessage' }
> = async ($, e, next) => {
  if (!isOn(await read($, enabledAtom), copyButton)) return next(e)
  if (e.surface !== 'terminal') return next(e)
  // A summary stands for text the model wrote; its fences are not the code.
  if (e.props.isSummary) return next(e)
  if (!ANY_FENCE.test(e.props.text)) return next(e)

  const blocks = copyableBlocks(e.props.text)
  if (blocks.length === 0) return next(e)

  const postError = (error: unknown) => {
    void $.clock.after(0, async () => {
      const at = await $.clock.now()
      await update($, statusAtom, map => withError(map, copyButton.id, messageOf(error), at))
    })
  }

  return guard(
    async () =>
      buildCopyRow({
        elements: $.ui.resolve(e),
        inner: await next(e),
        blocks,
        onCopy: (block, surface) => {
          void (async () => {
            const result = await $.ui.copy({ text: block.text, surface })
            $.ui.toast(
              result.isCopied ? copiedToast(block) : `Could not copy: ${result.reason}`,
            )
          })()
        },
      }),
    () => next(e),
    postError,
  )
}
