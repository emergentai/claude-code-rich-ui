import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import type { EnabledMap, StatusMap } from '../../../types'
import { messageOf, withError } from '../../core/errors'
import type { Feature } from '../../core/feature'
import { guard, isOn } from '../../core/gate'
import { familyFor, formatElapsed, lineCells, lineColumns } from './line'
import type { SpinnerMode, ThemeFamily } from './line'
import { buildSpinner, buildTurnLine, ROW_KEY } from './view'

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

export const calmSpinner: Feature = {
  id: 'calm-spinner',
  name: 'Zen spinner',
  description: 'Replace the working row with one quiet line and trim the turn-end line',
  isExperimental: true,
  defaultEnabled: true,
}

// How often the row repaints: the highlight glides, and the seconds move.
const TICK_MS = 125
// A site not seen for this long is a new turn, not the old one going on.
const STALE_MS = 2000

type Site = {
  startedAt: number
  lastSeen: number
  mode: SpinnerMode
  columns: number
  family: ThemeFamily
}

// One module environment holds the live rows; a hot reload starts a fresh one.
const sites = new Map<string, Site>()
let ticker: { cancel(): void } | undefined

// The row is a Raster the engine draws once; the timer then repaints it with
// `$.ui.blit`, which needs no render pass. The seconds, the label and the track's
// colour all live in the cells. Written inline in the hook: the engine's module
// scan rejects a function that is handed `$`.
export const renderSpinner: MatchedHook<'ui.render', { component: 'Spinner' }> = async (
  $,
  e,
  next,
) => {
  if (!isOn(await read($, enabledAtom), calmSpinner) || e.surface !== 'terminal') {
    sites.delete(e.requestId)

    return next(e)
  }

  const postError = (error: unknown) => {
    void $.clock.after(0, async () => {
      const at = await $.clock.now()
      await update($, statusAtom, map => withError(map, calmSpinner.id, messageOf(error), at))
    })
  }

  return guard(
    async () => {
      const now = await $.clock.now()
      // The colours follow the theme setting, read at each draw so a change shows
      // from the next one. Unreadable means the both-readable light set.
      let theme: unknown
      try {
        theme = (await $.config.list()).find(row => row.key === 'theme')?.value
      } catch {
        theme = undefined
      }
      const known = sites.get(e.requestId)
      const isContinuing = known !== undefined && now - known.lastSeen <= STALE_MS
      const site: Site = {
        startedAt: isContinuing ? known.startedAt : now,
        lastSeen: now,
        mode: e.props.mode,
        columns: lineColumns(e.viewport?.columns),
        family: familyFor(theme),
      }
      sites.set(e.requestId, site)

      if (ticker === undefined) {
        ticker = $.clock.every(TICK_MS, async () => {
          const at = await $.clock.now()
          for (const [requestId, live] of sites) {
            const result = await $.ui.blit({
              requestId,
              key: ROW_KEY,
              cells: lineCells(live.mode, at - live.startedAt, at, live.columns, live.family),
              columns: live.columns,
              rows: 1,
            })
            if (result.deny === undefined) live.lastSeen = at
            // Denied: the turn ended or a resize redrew the row. The grace keeps
            // a row the surface has not mounted yet.
            else if (at - live.lastSeen > STALE_MS) sites.delete(requestId)
          }
          if (sites.size === 0) {
            ticker?.cancel()
            ticker = undefined
          }
        })
      }

      return buildSpinner(
        $.ui.resolve(e),
        site.columns,
        lineCells(site.mode, now - site.startedAt, now, site.columns, site.family),
      )
    },
    () => next(e),
    postError,
  )
}

// "Baked for 3s" becomes a dim "3s". A line that waits on background agents, and
// ctrl+o and --verbose, keep the engine's own.
export const renderTurnDuration: MatchedHook<'ui.render', { component: 'TurnDuration' }> = async (
  $,
  e,
  next,
) => {
  if (!isOn(await read($, enabledAtom), calmSpinner) || e.surface !== 'terminal') return next(e)
  if (e.props.isExpanded === true || e.props.waitingFor !== undefined) return next(e)

  return buildTurnLine($.ui.resolve(e), formatElapsed(e.props.durationMs))
}

// The "(ctrl+b to run in background)" pill draws nothing.
export const renderToolProgress: MatchedHook<'ui.render', { component: 'ToolProgress' }> = async (
  $,
  e,
  next,
) => {
  if (!isOn(await read($, enabledAtom), calmSpinner) || e.surface !== 'terminal') return next(e)

  return next({ ...e, props: { ...e.props, hint: '' } })
}
