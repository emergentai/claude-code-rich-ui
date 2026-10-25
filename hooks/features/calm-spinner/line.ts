// The calm working row as data: its words and the cells of its Raster. Pure: no
// `$`, no engine. The row is one line, a margin, a short track with a soft
// highlight gliding along it, then "thinking 42s", padded to a fixed width because
// a blit must repeat the mounted size exactly.
import { DEFAULT_COLOR, packCells } from '../../core/raster'
import type { Cell } from '../../core/raster'

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

const DOT = 0x2022
const FAINT_DOT = 0x00b7
const SPACE = 0x20

// The stock spinner's colour is Claude's orange in both theme families (from the
// app's built-in theme tables, as the Firstmate calm mod reads them). The track
// fades from a dim shade of it, mixed toward the family's background, up to the
// full colour; the words are a quiet grey that reads on that background.
export type ThemeFamily = 'dark' | 'light'
const ACCENT = 0xd77757
const PALETTES: Record<ThemeFamily, { dim: number; text: number }> = {
  dark: { dim: mix(ACCENT, 0x1e1e1e, 0.72), text: 0x9a9a9a },
  light: { dim: mix(ACCENT, 0xffffff, 0.68), text: 0x6b6b6b },
}

// Values starting `dark` or `light` pick that family; `auto`, a custom theme and
// anything unreadable use light, which reads on a dark background too.
export function familyFor(theme: unknown): ThemeFamily {
  return typeof theme === 'string' && theme.startsWith('dark') ? 'dark' : 'light'
}

// `from` shifted toward `to` by `amount` (0 to 1), channel by channel.
function mix(from: number, to: number, amount: number): number {
  let out = 0
  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 255
    const b = (to >> shift) & 255
    out |= Math.round(a + (b - a) * amount) << shift
  }

  return out
}
// One pass of the highlight along the track and back.
export const SWEEP_PERIOD_MS = 3200
// How far the highlight's glow reaches, in cells.
const GLOW = 1.8

// Left margin, track, and the gap before the words.
export const LEAD = 2
export const GAP = 2
const TRACK_FULL = 8
const TRACK_SHORT = 4

// Room for "  " + 8 cells + "  " + "requesting 99m 59s".
export const FULL_COLUMNS = LEAD + TRACK_FULL + GAP + 20
const MIN_COLUMNS = 8
const MARGIN = 2
// The words need this much room to carry the label; under it only the time stays.
const LABEL_ROOM = 14

export function labelFor(mode: SpinnerMode): string {
  switch (mode) {
    case 'requesting':
      return 'starting'
    case 'thinking':
      return 'thinking'
    case 'responding':
      return 'writing'
    default:
      return 'working'
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`

  return `${seconds}s`
}

// The width of the row: the transcript's margin off the viewport, capped.
export function lineColumns(viewportColumns: number | undefined): number {
  if (viewportColumns === undefined) return FULL_COLUMNS

  return Math.min(FULL_COLUMNS, Math.max(MIN_COLUMNS, viewportColumns - MARGIN))
}

// How the width divides: the track shrinks, then goes to one cell, as the row narrows.
export function layoutFor(columns: number): { track: number; room: number } {
  const track = columns >= FULL_COLUMNS - 2 ? TRACK_FULL : columns >= 22 ? TRACK_SHORT : 1

  return { track, room: Math.max(0, columns - LEAD - track - GAP) }
}

// What follows the track.
export function lineText(mode: SpinnerMode, elapsedMs: number, columns: number): string {
  const time = formatElapsed(elapsedMs)
  const { room } = layoutFor(columns)
  const text = room >= LABEL_ROOM ? `${labelFor(mode)} ${time}` : time

  return text.slice(0, room)
}

// How lit each track cell is, 0 to 1: a highlight eases from one end to the other
// and back, with a soft glow either side. A one-cell track just pulses.
export function sweepLevels(nowMs: number, length: number): number[] {
  const phase = (nowMs % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS
  if (length <= 1) return [(1 - Math.cos(phase * 2 * Math.PI)) / 2]

  const there = phase < 0.5 ? phase * 2 : 2 - phase * 2
  const eased = there * there * (3 - 2 * there)
  const position = eased * (length - 1)

  return Array.from({ length }, (_, cell) => Math.max(0, 1 - Math.abs(cell - position) / GLOW))
}

// The colour of a track cell lit to `level` (0 to 1) in a family.
export function trackColor(family: ThemeFamily, level: number): number {
  return mix(PALETTES[family].dim, ACCENT, level)
}

export function lineCells(
  mode: SpinnerMode,
  elapsedMs: number,
  nowMs: number,
  columns: number,
  family: ThemeFamily = 'light',
): string {
  const { track } = layoutFor(columns)
  const levels = sweepLevels(nowMs, track)
  const text = lineText(mode, elapsedMs, columns)
  const cells: Cell[] = []

  for (let column = 0; column < columns; column++) {
    const inTrack = column - LEAD
    const inText = column - LEAD - track - GAP
    const level = levels[inTrack]
    const letter = text[inText]

    if (level !== undefined && inTrack >= 0) {
      cells.push({ code: level > 0.6 ? DOT : FAINT_DOT, fg: trackColor(family, level) })
    } else if (letter !== undefined && inText >= 0) {
      cells.push({ code: letter.codePointAt(0)!, fg: PALETTES[family].text })
    } else {
      cells.push({ code: SPACE, fg: DEFAULT_COLOR })
    }
  }

  return packCells(cells)
}
