import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import { messageOf, withError, withNote } from '../../core/errors'
import type { Feature } from '../../core/feature'
import { guard, isOn } from '../../core/gate'
import type { EnabledMap, ShownMap, StatusMap } from '../../../types'
import { splitReply } from './detect'
import { buildReply } from './view'

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
const shownAtom = atom(
  { plugin: 'rich-ui', key: 'shown' } as const,
  {} as ShownMap,
  { shape: 'shown-1' },
)

const QUICK_CHECK = /^(?:`{3,}|~{3,})[ \t]*mermaid/im

export const mermaid: Feature = {
  id: 'mermaid',
  name: 'Mermaid diagrams',
  description: 'Draw mermaid diagrams as text diagrams',
  defaultEnabled: true,
}

// Written inline, not through shared helpers that take `$`: the engine's module
// scan rejects those. The status writes are deferred because the engine refuses
// state writes while a ui.render hook draws.
export const renderAssistantMessage: MatchedHook<
  'ui.render',
  { component: 'AssistantMessage' }
> = async ($, e, next) => {
  if (!isOn(await read($, enabledAtom), mermaid)) return next(e)
  if (e.surface !== 'terminal') return next(e)
  // The terminal marks a summary row itself (a faint " · summary"); leave it.
  if (e.props.isSummary) return next(e)
  const text = e.props.text
  if (!QUICK_CHECK.test(text)) return next(e)

  const segments = splitReply(text)
  if (!segments.some(segment => segment.kind === 'mermaid')) return next(e)

  const postNote = (note: string) => {
    void $.clock.after(0, () =>
      update($, statusAtom, map => withNote(map, mermaid.id, note)),
    )
  }
  const postError = (error: unknown) => {
    void $.clock.after(0, async () => {
      const at = await $.clock.now()
      await update($, statusAtom, map =>
        withError(map, mermaid.id, messageOf(error), at),
      )
    })
  }

  return guard(
    async () => {
      const viewport = e.viewport
      if (!viewport) {
        postNote('Diagrams left as code: terminal size unknown')

        return next(e)
      }

      return buildReply({
        elements: $.ui.resolve(e),
        segments,
        viewport,
        requestId: e.requestId,
        isFirstOfReply: e.props.isFirstOfReply,
        shown: await read($, shownAtom),
        onToggle: id => {
          void update($, shownAtom, map => ({ ...map, [id]: !map[id] }))
        },
      })
    },
    () => next(e),
    postError,
  )
}
