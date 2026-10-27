import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap, StatusMap, UsageSnapshot } from '../../types'
import { withoutStatus } from '../core/errors'
import { isOn } from '../core/gate'
import { mergePrefs, parseStored, parseWelcome, serialize, STORE_KEY, toggled } from '../core/prefs'
import type { PrefsChange } from '../core/prefs'
import { features } from '../core/registry'
import { bandText, segmentsFor } from '../features/status-band/band'
import { startPeek } from '../features/attachment-peek'
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
// Typed in this session and not yet stored. Only then does a save carry the welcome text;
// otherwise the stored one stands, which may have been changed by another session.
let isWelcomeUnsaved = false

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

// Saves go one at a time, each reading the store just before it writes, so two quick
// saves do not both start from the same old copy.
let saving: Promise<unknown> = Promise.resolve()

// Writes only what `change` names on top of the store as it is now, so a value another
// session saved since this one loaded is not written back over. Returns what was stored,
// or undefined when the write failed (the footer then says it was not saved).
function savePrefs(
  $: Parameters<Hook<'session.start'>>[0],
  change: PrefsChange,
) {
  const run = async () => {
    try {
      let raw: unknown
      try {
        raw = await $.store.get(STORE_KEY)
      } catch {
        // Unreadable: start from what this session holds, as before.
        raw = serialize(await read($, enabledAtom), custom(cleanText(await read($, welcomeAtom))))
      }
      const merged = mergePrefs(raw, change)
      await $.store.set(STORE_KEY, serialize(merged.enabled, merged.welcome))
      if (change.welcome) isWelcomeUnsaved = false
      await update($, saveFailedAtom, () => false)

      return merged
    } catch {
      await update($, saveFailedAtom, () => true)

      return undefined
    }
  }
  const result = saving.then(run)
  saving = result

  return result
}

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
  // Rows can draw before the choices load (a resumed session does), so draw them again.
  $.ui.invalidate('ui.render')

  await $.command.register({
    name: 'rich-ui',
    description: 'Choose which rich-ui features are on',
  })
  // The attachment peek reads the prompt draft on a timer; it checks its own flag each time.
  startPeek($)

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
      isWelcomeUnsaved = true
      saveTimer?.cancel()
      saveTimer = $.clock.after(SAVE_PAUSE_MS, () => {
        void (async () => {
          const welcome = cleanText(await read($, welcomeAtom))
          await savePrefs($, { welcome: { text: custom(welcome) } })
        })()
      })
    },
    onWelcomeDone: async () => {
      saveTimer?.cancel()
      const welcome = cleanText(await read($, welcomeAtom))
      await savePrefs($, { welcome: { text: custom(welcome) } })
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
      // Rows already in the transcript were drawn under the old choice.
      $.ui.invalidate('ui.render')
      // Only this feature's flag is written; the rest comes from the store, and
      // what another session saved is taken up here.
      const welcome = cleanText(await read($, welcomeAtom))
      const merged = await savePrefs($, {
        enabled: { [feature.id]: enabled[feature.id] ?? false },
        ...(isWelcomeUnsaved && { welcome: { text: custom(welcome) } }),
      })
      if (merged) await update($, enabledAtom, map => ({ ...map, ...merged.enabled }))
    },
  })
}
