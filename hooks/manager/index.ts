import { atom, read, update } from 'claude-code'
import type { Hook, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap, StatusMap, UsageSnapshot } from '../../types'
import { withoutStatus } from '../core/errors'
import { isOn } from '../core/gate'
import { enabledKey, readPrefs, STORE_KEY, toggled, WELCOME_KEY, welcomeValue } from '../core/prefs'
import type { PrefsChange } from '../core/prefs'
import { features } from '../core/registry'
import { bandText, segmentsFor } from '../features/status-band/band'
import { startPeek } from '../features/attachment-peek'
import { statusBand } from '../features/status-band'
import { CAPTION, MAX_TEXT, cleanText } from '../features/welcome-greeting/welcome'
import { VERSION } from '../core/version'
import { buildPane } from './pane'
import { contentRows, experimentalCount, stepFocus } from './size'

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

// Saves go one at a time, so two quick saves of one choice land in the order they were made.
let saving: Promise<unknown> = Promise.resolve()

type StoreHandle = Parameters<Hook<'session.start'>>[0]

// The saved choices: the record older versions wrote, with each choice's own entry over it. An
// entry that cannot be read is as if it were never set.
async function loadPrefs($: StoreHandle) {
  const get = (key: string) => $.store.get(key).catch(() => undefined)
  const entries: Record<string, unknown> = {}
  await Promise.all(
    features.map(async feature => {
      entries[feature.id] = await get(enabledKey(feature.id))
    }),
  )

  return readPrefs(await get(STORE_KEY), entries, await get(WELCOME_KEY))
}

// Writes only the entries `change` names, each its own, so a choice another session saved since this
// one loaded is never written back over. Returns the choices as stored now, or undefined when
// the write failed (the footer then says it was not saved).
function savePrefs($: StoreHandle, change: PrefsChange) {
  const run = async () => {
    try {
      for (const [id, value] of Object.entries(change.enabled ?? {})) {
        await $.store.set(enabledKey(id), value)
      }
      if (change.welcome) {
        await $.store.set(WELCOME_KEY, welcomeValue(change.welcome.text))
        isWelcomeUnsaved = false
      }
      await update($, saveFailedAtom, () => false)

      return await loadPrefs($)
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
  // An unreadable store means every feature uses its default (an empty map).
  const loaded = await loadPrefs($)
  const stored: EnabledMap = loaded.enabled
  const welcome = cleanText(loaded.welcome)
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

// The feature button the pane's focus ring is on, by key (a feature's id); anything else (the welcome
// text field, nothing) is ''. Kept from the ring's moves so the arrows know where to go from.
let focusedKey = ''

export const trackFocus: MatchedHook<'ui.focus', { component: 'Pane'; requestId: 'rich-ui' }> = async (
  _,
  e,
  next,
) => {
  focusedKey = e.element ?? ''

  return next(e)
}

// A pane that does not fit (an inline one in a short window) scrolls on the arrows instead of moving
// the ring from button to button, which a pane that fits does. Up and down move it here too, and the
// ring brings the row into view (as Tab does). The wheel, the page keys, Home and End still scroll.
export const arrowsMoveFocus: MatchedHook<'ui.scroll', { component: 'Pane'; requestId: 'rich-ui' }> = async (
  $,
  e,
  next,
) => {
  const to = stepFocus(features.map(feature => feature.id), focusedKey, e.by)
  if (e.origin.kind !== 'person' || e.pointer !== undefined || Math.abs(e.by) !== 1 || to === undefined) return next(e)
  if (to !== focusedKey) await $.ui.focus({ requestId: PANE_ID, key: to })

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
