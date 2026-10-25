import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, PreviewState } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { clipText, describeError, PANE_ID, pathFromHref, previewLinks } from './preview'
import { buildLinkedReply, buildPreview } from './view'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)
const previewAtom = atom(
  { plugin: 'rich-ui', key: 'preview' } as const,
  {} as PreviewState,
  { shape: 'preview-1' },
)

const PROMPT_SECTION_ID = 'rich-ui:markdown-preview'
export const PROMPT_TEXT =
  'The user can click a markdown link to a local .md file in your replies to open it rendered in a preview pane. ' +
  'Whenever you create or substantially change a markdown file, link it in your reply as a markdown link, ' +
  'for example [the plan](docs/plan.md), with the path relative to the working directory or absolute. ' +
  'Do not write that path only in backticks or as plain text: that is not clickable.'

const MERMAID_FENCE = /^(?:`{3,}|~{3,})[ \t]*mermaid/im

export const markdownPreview: Feature = {
  id: 'markdown-preview',
  name: 'Markdown preview',
  description: 'Show linked markdown files rendered in a side pane',
  defaultEnabled: true,
}

// Tells the model the preview is on, so it links the markdown files it writes.
// Composed per request, so the /rich-ui toggle takes effect on the next one.
export const addPromptSection: Hook<'prompt.compose'> = async ($, e, next) => {
  const result = await next(e)
  if (!isOn(await read($, enabledAtom), markdownPreview)) return result
  if (!e.surfaces.includes('terminal')) return result
  if (result.sections.some(section => section.id === PROMPT_SECTION_ID)) return result

  return {
    sections: [...result.sections, { id: PROMPT_SECTION_ID, text: PROMPT_TEXT, scope: 'session' }],
  }
}

// Refreshes the pane's text when Claude writes or edits the markdown file on
// show. The tool call itself is never held up or changed: whatever goes wrong
// here is dropped.
export const refreshOnWrite: Hook<'tool.call'> = async ($, e, next) => {
  const result = await next(e)

  try {
    if (!isOn(await read($, enabledAtom), markdownPreview)) return result
    if (e.tool !== 'Write' && e.tool !== 'Edit') return result
    if ('deny' in result && result.deny) return result
    if ('isError' in result && result.isError) return result

    const path = e.file_path
    if ((await read($, previewAtom)).path !== path) return result

    const { text, isTruncated } = clipText(await $.fs.read(path))
    await update($, previewAtom, () => ({ path, text, isTruncated }))
  } catch {
    // The preview is a convenience; it must not fail a tool call.
  }

  return result
}

// A reply that links to a local markdown file is drawn by the engine's Markdown
// with those links answered here: pressing one opens the file in the pane. A
// reply with a mermaid fence is left to that feature.
export const renderLinkedReply: MatchedHook<
  'ui.render',
  { component: 'AssistantMessage' }
> = async ($, e, next) => {
  if (!isOn(await read($, enabledAtom), markdownPreview)) return next(e)
  if (e.surface !== 'terminal') return next(e)
  if (e.props.isSummary) return next(e)

  const text = e.props.text
  if (MERMAID_FENCE.test(text)) return next(e)
  const links = previewLinks(text)
  if (links.length === 0) return next(e)

  const cwd = await $.session.cwd()

  return buildLinkedReply({
    elements: $.ui.resolve(e),
    text,
    links,
    isFirstOfReply: e.props.isFirstOfReply,
    onLinkPress: href => {
      void (async () => {
        // Asked before anything is awaited: a pane opened while a press is being
        // answered is placed at any width, one opened after is placed only from
        // 144 columns and otherwise waits undrawn.
        const opened = await $.ui.open({
          id: PANE_ID,
          title: 'Markdown preview',
          focus: true,
          closeOnEscape: true,
          columns: 80,
        })
        if (!opened.isPlaced) $.ui.toast(`Markdown preview could not open: ${opened.reason}`)

        const path = pathFromHref(href, cwd)
        try {
          const { text: body, isTruncated } = clipText(await $.fs.read(path))
          await update($, previewAtom, () => ({ path, text: body, isTruncated }))
        } catch (error) {
          await update($, previewAtom, () => ({
            path,
            error: `Could not read ${path}: ${describeError(error)}`,
          }))
        }
      })()
    },
  })
}

export const renderPreview: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: 'rich-ui-preview' }
> = async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)
  if (!isOn(await read($, enabledAtom), markdownPreview)) return next(e)

  return buildPreview({
    elements: $.ui.resolve(e),
    state: await read($, previewAtom),
    width: (e.props.bodyColumns ?? 80) - (e.props.placement === 'dock' ? 2 : 0),
    isDocked: e.props.placement === 'dock',
  })
}
