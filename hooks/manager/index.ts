import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../types'
import { withoutStatus } from '../core/errors'
import { parseStored, serialize, STORE_KEY, toggled } from '../core/prefs'
import { features } from '../core/registry'
import { VERSION } from '../core/version'
import { buildPane } from './pane'

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
const managerOpenAtom = atom(
  { plugin: 'rich-ui', key: 'managerOpen' } as const,
  false,
  { shape: 'manager-open-1' },
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

// The manager is the band above the prompt, not a Pane: the engine docks a Pane
// beside the transcript in a wide fullscreen terminal and a plugin cannot choose
// otherwise, and the band is always above the prompt. A band cannot be handed
// the keyboard by the plugin ($.ui.focus is denied: the site does not hold the
// keys), so the band says how to take it.
export const runCommand: MatchedHook<
  'command.run',
  { command: 'rich-ui' }
> = async $ => {
  await update($, managerOpenAtom, () => true)

  return {}
}

export const renderBand: MatchedHook<
  'ui.render',
  { component: 'AbovePrompt' }
> = async ($, e, next) => {
  if (e.surface !== 'terminal') return next(e)
  if (e.props.hasSurvey) return next(e)
  if (!(await read($, managerOpenAtom))) return next(e)

  return buildPane({
    elements: $.ui.resolve(e),
    features,
    enabled: await read($, enabledAtom),
    status: await read($, statusAtom),
    saveFailed: await read($, saveFailedAtom),
    width: e.props.bodyColumns,
    version: VERSION,
    onClose: () => {
      void update($, managerOpenAtom, () => false)
    },
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
