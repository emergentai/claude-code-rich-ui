import { expect, test } from 'claude-code/testing'

import {
  formatElapsed,
  FULL_COLUMNS,
  GAP,
  familyFor,
  labelFor,
  LEAD,
  layoutFor,
  lineCells,
  lineColumns,
  lineText,
  SWEEP_PERIOD_MS,
  sweepLevels,
  trackColor,
} from './line'

// Cells back to text, to read what a packed row says.
function textOf(cells: string): string {
  const bytes = Uint8Array.from(atob(cells), char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  let out = ''

  for (let i = 0; i < bytes.length; i += 12) out += String.fromCodePoint(view.getUint32(i, true))

  return out
}

test('seconds, minutes and hours read short', () => {
  expect(formatElapsed(0)).toBe('0s')
  expect(formatElapsed(42_900)).toBe('42s')
  expect(formatElapsed(64_000)).toBe('1m 04s')
  expect(formatElapsed(3_900_000)).toBe('1h 05m')
  expect(formatElapsed(-5)).toBe('0s')
})

test('every mode has one plain lowercase word', () => {
  expect(labelFor('requesting')).toBe('starting')
  expect(labelFor('thinking')).toBe('thinking')
  expect(labelFor('responding')).toBe('writing')
  expect(labelFor('tool-use')).toBe('working')
  expect(labelFor('tool-input')).toBe('working')
})

test('the row fits the window and drops its label when narrow', () => {
  expect(lineColumns(undefined)).toBe(FULL_COLUMNS)
  expect(lineColumns(200)).toBe(FULL_COLUMNS)
  expect(lineColumns(12)).toBe(10)
  expect(lineColumns(3)).toBe(8)

  expect(lineText('thinking', 42_000, FULL_COLUMNS)).toBe('thinking 42s')
  expect(lineText('thinking', 42_000, 10)).toBe('42s')
  expect(lineText('thinking', 42_000, 8)).toBe('42s'.slice(0, layoutFor(8).room))
})

test('the track shrinks to four cells and then to one as the row narrows', () => {
  expect(layoutFor(FULL_COLUMNS).track).toBe(8)
  expect(layoutFor(24).track).toBe(4)
  expect(layoutFor(10).track).toBe(1)
  expect(layoutFor(FULL_COLUMNS).room).toBe(FULL_COLUMNS - LEAD - 8 - GAP)
})

test('the row is a margin, the track, a gap, the words and padding, at a fixed width', () => {
  const a = lineCells('thinking', 4_000, 0, FULL_COLUMNS)
  const b = lineCells('tool-use', 125_000, 0, FULL_COLUMNS)
  const words = (row: string) => textOf(row).slice(LEAD + 8 + GAP).trimEnd()

  expect(textOf(a).slice(0, LEAD)).toBe(' '.repeat(LEAD))
  expect(textOf(a).slice(LEAD + 8, LEAD + 8 + GAP)).toBe(' '.repeat(GAP))
  expect(words(a)).toBe('thinking 4s')
  expect(words(b)).toBe('working 2m 05s')
  expect(textOf(a).length).toBe(FULL_COLUMNS)
  expect(a.length).toBe(b.length)
})

test('the highlight runs from one end of the track to the other and back', () => {
  const start = sweepLevels(0, 8)
  const middle = sweepLevels(SWEEP_PERIOD_MS / 2, 8)

  expect(start.indexOf(Math.max(...start))).toBe(0)
  expect(middle.indexOf(Math.max(...middle))).toBe(7)
  expect(sweepLevels(SWEEP_PERIOD_MS, 8)).toEqual(start)
  for (const level of sweepLevels(1234, 8)) {
    expect(level).toBeGreaterThanOrEqual(0)
    expect(level).toBeLessThanOrEqual(1)
  }
})

test('a one-cell track pulses and repeats', () => {
  expect(sweepLevels(0, 1)).toEqual([0])
  expect(sweepLevels(SWEEP_PERIOD_MS / 2, 1)).toEqual([1])
})

test('lit cells are a brighter dot than faint ones', () => {
  const lit = textOf(lineCells('thinking', 0, 0, FULL_COLUMNS)).slice(LEAD, LEAD + 8)

  expect(lit[0]).toBe('•')
  expect(lit[7]).toBe('·')
})

test('the theme setting picks the family, and anything unclear is light', () => {
  expect(familyFor('dark')).toBe('dark')
  expect(familyFor('dark-daltonized')).toBe('dark')
  expect(familyFor('light-ansi')).toBe('light')
  expect(familyFor('auto')).toBe('light')
  expect(familyFor(undefined)).toBe('light')
  expect(familyFor(3)).toBe('light')
})

test('the track fades from a dim shade of the spinner colour up to the full colour', () => {
  for (const family of ['dark', 'light'] as const) {
    expect(trackColor(family, 1)).toBe(0xd77757)
    expect(trackColor(family, 0)).not.toBe(0xd77757)
    // The dim end sits nearer the background than the lit end.
    const channel = (colour: number) => colour >> 8 & 255
    expect(Math.abs(channel(trackColor(family, 0)) - (family === 'dark' ? 0x1e : 0xff)))
      .toBeLessThan(Math.abs(channel(trackColor(family, 1)) - (family === 'dark' ? 0x1e : 0xff)))
  }
  expect(trackColor('dark', 0)).not.toBe(trackColor('light', 0))
})
