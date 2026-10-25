import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap, StatusMap, UsageSnapshot } from '../../types'
import { withoutStatus } from '../core/errors'
import { isOn } from '../core/gate'
import { cleanText, CAPTION } from '../features/doge-greeting/doge'
import { parseStored, parseWelcome, serialize, STORE_KEY, toggled } from '../core/prefs'
import { features } from '../core/registry'
import { bandText, segmentsFor } from '../features/status-band/band'
import { auroraHeader, HEADER_ROWS } from '../features/aurora-header'
import { auroraMeter } from '../features/aurora-meter'
import { statusBand } from '../features/status-band'
import { VERSION } from '../core/version'
import { buildPane } from './pane'
import { contentRows, WELCOME_ROWS } from './size'

const PANE_ID = 'rich-ui'

// Only a text the person changed is stored; the default stays unsaved.
const custom = (welcome: string) => (welcome === CAPTION ? undefined : welcome)

// Declared here, not imported: the engine's module scan reads a state source
// only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)
const welcomeAtom = atom(
  { plugin: 'rich-ui', key: 'welcome' } as const,
  CAPTION,
  { shape: 'welcome-1' },
)
const statusAtom = atom(
  { plugin: 'rich-ui', key: 'status' } as const,
  {} as StatusMap,
  { shape: 'status-1' },
)
const usageAtom = atom(
  { plugin: 'rich-ui', key: 'usage' } as const,
  { limits: [] } as UsageSnapshot,
  { shape: 'usage-1' },
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
  let welcome = CAPTION
  try {
    const raw = await $.store.get(STORE_KEY)
    stored = parseStored(raw)
    welcome = cleanText(parseWelcome(raw))
  } catch {
    // An unreadable store means every feature uses its default (an empty map).
  }
  await update($, enabledAtom, () => stored)
  await update($, welcomeAtom, () => welcome)

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
    rows:
      contentRows(features.length, statusLines, saveFailed) +
      WELCOME_ROWS +
      (isOn(await read($, enabledAtom), auroraHeader) ? HEADER_ROWS : 0),
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
    welcome: await read($, welcomeAtom),
    width: (e.props.bodyColumns ?? 80) - (e.props.placement === 'dock' ? 2 : 0),
    isDocked: e.props.placement === 'dock',
    version: VERSION,
    onWelcome: async text => {
      const welcome = cleanText(text)
      await update($, welcomeAtom, () => welcome)
      try {
        await $.store.set(STORE_KEY, serialize(await read($, enabledAtom), custom(welcome)))
        await update($, saveFailedAtom, () => false)
      } catch {
        await update($, saveFailedAtom, () => true)
      }
    },
    onToggle: async feature => {
      const enabled = await update($, enabledAtom, map => toggled(map, feature))
      await update($, statusAtom, map => withoutStatus(map, feature.id))
      // The status band's line sits in the engine's status row, so toggling its
      // feature (or the aurora meter, which takes the figures over) clears or restores
      // that line at once.
      if (feature.id === statusBand.id || feature.id === auroraMeter.id) {
        const segments = segmentsFor(await read($, usageAtom), await $.clock.now())
        $.ui.status(
          isOn(enabled, statusBand) && !isOn(enabled, auroraMeter) ? bandText(segments) : undefined,
        )
      }
      try {
        await $.store.set(STORE_KEY, serialize(enabled, custom(await read($, welcomeAtom))))
        await update($, saveFailedAtom, () => false)
      } catch {
        // The choice holds for this session; the footer says it was not saved.
        await update($, saveFailedAtom, () => true)
      }
    },
  })
}
