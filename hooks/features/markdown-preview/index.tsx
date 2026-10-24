import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, PreviewState } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { clipText, describeError, isMarkdownPath, PANE_ID, pathFromArgs } from './preview'
import { buildPreview } from './view'

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

export const markdownPreview: Feature = {
  id: 'markdown-preview',
  name: 'Markdown preview',
  description: 'Show markdown files Claude writes, rendered, in a pane (/preview)',
  defaultEnabled: true,
}

// Remembers the last markdown file Claude wrote or edited, and refreshes the
// pane's text when it is the file on show. The tool call itself is never held up
// or changed: whatever goes wrong here is dropped.
export const trackWrites: Hook<'tool.call'> = async ($, e, next) => {
  const result = await next(e)

  try {
    if (!isOn(await read($, enabledAtom), markdownPreview)) return result
    if (e.tool !== 'Write' && e.tool !== 'Edit') return result
    if ('deny' in result && result.deny) return result
    if ('isError' in result && result.isError) return result

    const path = e.file_path
    if (!isMarkdownPath(path)) return result

    const shown = await read($, previewAtom)
    if (shown.path === path) {
      const { text, isTruncated } = clipText(await $.fs.read(path))
      await update($, previewAtom, () => ({ path, text, isTruncated, lastWritten: path }))
    } else {
      await update($, previewAtom, state => ({ ...state, lastWritten: path }))
    }
  } catch {
    // The preview is a convenience; it must not fail a tool call.
  }

  return result
}

export const runPreview: MatchedHook<
  'command.run',
  { command: 'preview' }
> = async ($, e) => {
  if (!isOn(await read($, enabledAtom), markdownPreview)) {
    return { text: 'Markdown preview is off. Turn it on in /rich-ui.' }
  }

  const before = await read($, previewAtom)
  const path = pathFromArgs(e.args) ?? before.path ?? before.lastWritten
  if (path === undefined) {
    await update($, previewAtom, () => ({}))
  } else {
    try {
      const { text, isTruncated } = clipText(await $.fs.read(path))
      await update($, previewAtom, state => ({
        lastWritten: state.lastWritten,
        path,
        text,
        isTruncated,
      }))
    } catch (error) {
      await update($, previewAtom, state => ({
        lastWritten: state.lastWritten,
        path,
        error: `Could not read ${path}: ${describeError(error)}`,
      }))
    }
  }

  await $.ui.open({
    id: PANE_ID,
    title: 'Markdown preview',
    focus: true,
    closeOnEscape: true,
    columns: 80,
  })

  return {}
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
