import { expect, test } from 'claude-code/testing'

import {
  CAPTION,
  MAX_TEXT,
  cleanText,
  FADE_IN_MS,
  FADE_OUT_MS,
  HOLD_MS,
  MAX_ROWS,
  MIN_ROWS,
  TOTAL_MS,
  columnVisibility,
  dogeCells,
  dogeWords,
  layoutFor,
  letterColor,
  rowsFor,
  sourcePixel,
  textBitmap,
} from './doge'

const DEFAULT = 0x01000000

test('the caption is the lowercase word "welcome" in a bitmap font', () => {
  const bitmap = textBitmap(CAPTION)

  expect(CAPTION).toBe('welcome')
  expect(bitmap).toHaveLength(5)
  expect(new Set(bitmap.map(row => row.length)).size).toBe(1)
  expect(bitmap[0]?.length).toBe(5 + 3 + 3 + 3 + 3 + 5 + 3 + 6)
  expect(bitmap.flat().some(Boolean)).toBe(true)
  expect(textBitmap('')[0]).toEqual([])
})

test('the word is centred and as big as the band allows', () => {
  const layout = layoutFor(80, 16)

  expect(layout.scale).toBeGreaterThanOrEqual(2)
  expect(layout.textX).toBeGreaterThan(0)
  expect(layout.textX + (layout.bits[0]?.length ?? 0) * layout.scale).toBeLessThanOrEqual(80)
  expect(layout.textY + layout.textH).toBeLessThanOrEqual(16)
  expect(layoutFor(200, 40).scale).toBeGreaterThan(layout.scale)
})

test('the letters are Claude orange, lighter at the top than the bottom', () => {
  const top = letterColor(0, 0, 10)
  const bottom = letterColor(9, 0, 10)

  expect((top >> 16) & 255).toBeGreaterThan(0xb0)
  expect(top & 255).toBeGreaterThan(bottom & 255)
  expect(letterColor(0, 0, 1)).toBe(top)
})

test('it sweeps in from the left, holds, then sweeps out from the left', () => {
  expect(FADE_IN_MS).toBe(900)
  expect(HOLD_MS).toBe(500)
  expect(TOTAL_MS).toBe(FADE_IN_MS + HOLD_MS + FADE_OUT_MS)
  // Part way in, the left is in before the right.
  expect(columnVisibility(0, 80, FADE_IN_MS / 2)).toBeGreaterThan(columnVisibility(79, 80, FADE_IN_MS / 2))
  expect(columnVisibility(79, 80, 0)).toBe(0)
  // Fully in across the hold.
  for (const ms of [FADE_IN_MS, FADE_IN_MS + HOLD_MS / 2, FADE_IN_MS + HOLD_MS]) {
    expect(columnVisibility(0, 80, ms)).toBe(1)
    expect(columnVisibility(79, 80, ms)).toBe(1)
  }
  // Part way out, the left has gone before the right.
  const out = FADE_IN_MS + HOLD_MS + FADE_OUT_MS / 2
  expect(columnVisibility(0, 80, out)).toBeLessThan(columnVisibility(79, 80, out))
  expect(columnVisibility(0, 80, TOTAL_MS - 1)).toBe(0)
  expect(columnVisibility(0, 80, TOTAL_MS)).toBe(0)
})

test('only the word is drawn: blank cells keep the terminal\'s own colours', () => {
  const words = dogeWords(80, 8, FADE_IN_MS)
  const layout = layoutFor(80, 16)

  expect(words).toHaveLength(80 * 8 * 3)
  expect(words.slice(0, 3)).toEqual([0x20, DEFAULT, DEFAULT])
  expect(sourcePixel(0, 0, layout)).toBeUndefined()
  let drawn = 0
  for (let i = 0; i < words.length; i += 3) if (words[i] !== 0x20) drawn++
  expect(drawn).toBeGreaterThan(20)
})

test('the picture grows from the left, is empty at the start and the end, and holds still', () => {
  const count = (ms: number, from: number, to: number) => {
    const words = dogeWords(80, 8, ms)
    let n = 0
    for (let r = 0; r < 8; r++) for (let c = from; c < to; c++) if (words[(r * 80 + c) * 3] !== 0x20) n++
    return n
  }

  expect(count(0, 0, 80)).toBe(0)
  expect(count(FADE_IN_MS * 0.4, 0, 40)).toBeGreaterThan(count(FADE_IN_MS * 0.4, 40, 80))
  expect(count(TOTAL_MS, 0, 80)).toBe(0)
  expect(count(FADE_IN_MS + HOLD_MS + FADE_OUT_MS * 0.4, 0, 40)).toBeLessThan(count(FADE_IN_MS + HOLD_MS + FADE_OUT_MS * 0.4, 40, 80))
  expect(dogeCells(80, 8, FADE_IN_MS)).toBe(dogeCells(80, 8, FADE_IN_MS + 300))
})

test('the cells are columns x rows x 12 bytes in padded base64', () => {
  expect(atob(dogeCells(10, 7, 0)).length).toBe(10 * 7 * 12)
  expect(dogeWords(0, 5, 0)).toEqual([])
})

test('rows follow the room the engine gives, within the picture limits', () => {
  expect(rowsFor(undefined)).toBeUndefined()
  expect(rowsFor(MIN_ROWS)).toBe(MIN_ROWS - 1 >= MIN_ROWS ? MIN_ROWS - 1 : undefined)
  expect(rowsFor(MIN_ROWS + 1)).toBe(MIN_ROWS)
  expect(rowsFor(500)).toBe(MAX_ROWS)
})

test('tiny and huge sizes do not throw', () => {
  expect(() => dogeCells(1, 1, FADE_IN_MS)).not.toThrow()
  expect(() => dogeCells(400, 28, FADE_IN_MS)).not.toThrow()
})

test('typed text is cleaned to what the font can draw, with the default when nothing is left', () => {
  expect(cleanText('Hello   World')).toBe('hello world')
  expect(cleanText('  hi!  ')).toBe('hi!')
  expect(cleanText('héllo ☃ 42')).toBe('hllo 42')
  expect(cleanText('x'.repeat(50))).toHaveLength(MAX_TEXT)
  for (const empty of ['', '   ', '☃☃', undefined, 7]) expect(cleanText(empty)).toBe(CAPTION)
})

test('the font draws every letter and digit', () => {
  for (const ch of 'abcdefghijklmnopqrstuvwxyz0123456789') {
    expect(textBitmap(ch).flat().some(Boolean)).toBe(true)
  }
  expect(textBitmap('Hi')).toEqual(textBitmap('hi'))
})

test('the sign draws whatever text it is given, centred and sized to fit', () => {
  const short = layoutFor(80, 16, 'hi')
  const long = layoutFor(80, 16, 'hello world')

  expect(short.scale).toBeGreaterThan(long.scale)
  expect(short.textX).toBeGreaterThan(0)
  expect(dogeCells(80, 8, FADE_IN_MS, 'hi')).not.toBe(dogeCells(80, 8, FADE_IN_MS))
  expect(layoutFor(80, 16)).not.toBe(short)
})

test('the sign takes up to 20 characters', () => {
  expect(MAX_TEXT).toBe(20)
  expect(cleanText('abcdefghij klmnopqrst')).toBe('abcdefghij klmnopqrs')
  expect(cleanText('twenty characters long')).toHaveLength(20)
})

test('a long word still fits its band: it is shown to the end of the letters that fit, never cut at both edges', () => {
  const text = 'abcdefghij klmnopqrs'
  for (const [width, rows] of [[50, 10], [60, 12], [120, 20], [400, 28]] as const) {
    const layout = layoutFor(width, rows * 2, text)

    expect(layout.textX).toBeGreaterThanOrEqual(0)
    expect(layout.textX + (layout.bits[0]?.length ?? 0) * layout.scale).toBeLessThanOrEqual(width)
  }
  // Wide bands show every letter.
  expect(layoutFor(400, 56, text).bits[0]?.length).toBe(textBitmap(text)[0]?.length)
  // A band narrower than the word shows its start.
  expect((layoutFor(50, 20, text).bits[0]?.length ?? 0)).toBeLessThan(textBitmap(text)[0]?.length ?? 0)
  expect(dogeWords(50, 10, 1200, text).length).toBe(50 * 10 * 3)
})
