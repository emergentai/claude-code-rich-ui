import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap, StatusMap, UsageSnapshot } from '../../types'
import { withoutStatus } from '../core/errors'
import { isOn } from '../core/gate'
import { parseStored, parseWelcome, serialize, STORE_KEY, toggled } from '../core/prefs'
import { features } from '../core/registry'
import { bandText, segmentsFor } from '../features/status-band/band'
import { statusBand } from '../features/status-band'
import { CAPTION, MAX_TEXT, cleanText } from '../features/welcome-greeting/welcome'
import { VERSION } from '../core/version'
import { buildPane } from './pane'
import { contentRows, experimentalCount } from './size'

const PANE_ID = 'rich-ui'

// The welcome text field takes this many characters, the most the sign shows.
const MAX_FIELD = MAX_TEXT
const SAVE_PAUSE_MS = 400
// The pending write after the last keystroke, so a burst of typing is one write.
let saveTimer: Timer | undefined

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
// Bumped when the person presses Enter in the welcome field, and only then. The engine
// empties a text field on Enter (a submit), and the text has not changed, so nothing
// else would make the pane draw it again; a new address (see pane.tsx) draws a fresh field
// holding the text. Typing never bumps it, so typing never replaces the field.
const welcomeRevAtom = atom(
  { plugin: 'rich-ui', key: 'welcomeRev' } as const,
  0,
  { shape: 'welcome-rev-1' },
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
    rows: contentRows(features.length, statusLines, saveFailed, experimentalCount(features)),
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
    bodyRows: e.props.scroll.bodyRows,
    welcome: await read($, welcomeAtom),
    welcomeRev: await read($, welcomeRevAtom),
    version: VERSION,
    // The welcome text saves as it is typed: the field keeps exactly what the person types
    // (the pane redraws with the same text, so nothing moves), the sign cleans it when it
    // draws, and the store write waits for a pause in typing. Enter just writes it at once.
    onWelcome: async text => {
      await update($, welcomeAtom, () => text.slice(0, MAX_FIELD))
      saveTimer?.cancel()
      saveTimer = $.clock.after(SAVE_PAUSE_MS, () => {
        void (async () => {
          const welcome = cleanText(await read($, welcomeAtom))
          try {
            await $.store.set(STORE_KEY, serialize(await read($, enabledAtom), custom(welcome)))
            await update($, saveFailedAtom, () => false)
          } catch {
            await update($, saveFailedAtom, () => true)
          }
        })()
      })
    },
    onWelcomeDone: async () => {
      saveTimer?.cancel()
      const welcome = cleanText(await read($, welcomeAtom))
      try {
        await $.store.set(STORE_KEY, serialize(await read($, enabledAtom), custom(welcome)))
        await update($, saveFailedAtom, () => false)
      } catch {
        await update($, saveFailedAtom, () => true)
      }
      // Enter emptied the field: draw it again with the text.
      await update($, welcomeRevAtom, n => n + 1)
    },
    onToggle: async feature => {
      const enabled = await update($, enabledAtom, map => toggled(map, feature))
      await update($, statusAtom, map => withoutStatus(map, feature.id))
      // The status band's line sits in the engine's status row, so toggling its
      // feature clears or restores that line at once.
      if (feature.id === statusBand.id) {
        const segments = segmentsFor(await read($, usageAtom), await $.clock.now())
        $.ui.status(isOn(enabled, statusBand) ? bandText(segments) : undefined)
      }
      try {
        await $.store.set(STORE_KEY, serialize(enabled, custom(cleanText(await read($, welcomeAtom)))))
        await update($, saveFailedAtom, () => false)
      } catch {
        // The choice holds for this session; the footer says it was not saved.
        await update($, saveFailedAtom, () => true)
      }
    },
  })
}
