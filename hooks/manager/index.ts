import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../types'
import { withoutStatus } from '../core/errors'
import { parseStored, serialize, STORE_KEY, toggled } from '../core/prefs'
import { features } from '../core/registry'
import { VERSION } from '../core/version'
import { buildPane, footerFor } from './pane'
import { contentColumns, contentRows } from './size'

const PANE_ID = 'rich-ui'
const footerText = footerFor(VERSION)

// Declared here, not imported: the engine's module scan reads a state source
// only where it is written (docs/dev/architecture.md 4.0).
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
const saveFailedAtom = atom(
  { plugin: 'rich-ui', key: 'saveFailed' } as const,
  false,
  { shape: 'save-failed-1' },
)

// One session.start hook does both jobs, because the engine allows only one
// unmatched hook per event: it loads the saved choices and registers /rich-ui.
export const startSession: Hook<'session.start'> = async ($, e, next) => {
  let stored: EnabledMap = {}
  try {
    stored = parseStored(await $.store.get(STORE_KEY))
  } catch {
    // An unreadable store means every feature uses its default (an empty map).
  }
  await update($, enabledAtom, () => stored)

  await $.command.register({
    name: 'rich-ui',
    description: 'Choose which rich-ui features are on',
  })

  return next(e)
}

export const runCommand: MatchedHook<
  'command.run',
  { command: 'rich-ui' }
> = async $ => {
  const status = await read($, statusAtom)
  const saveFailed = await read($, saveFailedAtom)
  const statusLines = Object.values(status).reduce(
    (total, entry) => total + (entry.error ? 1 : 0) + entry.notes.length,
    0,
  )

  await $.ui.open({
    id: PANE_ID,
    title: 'rich-ui',
    focus: true,
    closeOnEscape: true,
    rows: contentRows(features.length, statusLines, saveFailed),
    columns: contentColumns(
      features.map(feature => feature.description),
      footerText,
    ),
  })

  return {}
}

export const renderPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: 'rich-ui' }
> = async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)

  return buildPane({
    elements: $.ui.resolve(e),
    features,
    enabled: await read($, enabledAtom),
    status: await read($, statusAtom),
    saveFailed: await read($, saveFailedAtom),
    width: (e.props.bodyColumns ?? 80) - (e.props.placement === 'dock' ? 2 : 0),
    isDocked: e.props.placement === 'dock',
    version: VERSION,
    onToggle: async feature => {
      const enabled = await update($, enabledAtom, map => toggled(map, feature))
      await update($, statusAtom, map => withoutStatus(map, feature.id))
      try {
        await $.store.set(STORE_KEY, serialize(enabled))
        await update($, saveFailedAtom, () => false)
      } catch {
        // The choice holds for this session; the footer says it was not saved.
        await update($, saveFailedAtom, () => true)
      }
    },
  })
}
