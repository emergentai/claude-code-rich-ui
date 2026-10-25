import { expect, test } from 'claude-code/testing'

import {
  CAPTION,
  FACE_ASPECT,
  FADE_IN_MS,
  FADE_OUT_MS,
  HOLD_MS,
  MAX_ROWS,
  MIN_ROWS,
  TOTAL_MS,
  captionColorFor,
  dogeCells,
  dogeWords,
  facePixel,
  layoutFor,
  rowsFor,
  sourcePixel,
  textBitmap,
  visibleAt,
} from './doge'

const DEFAULT = 0x01000000
// The harness has no toBeCloseTo.
const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b) <= tol).toBe(true)

test('the caption is the lowercase word "welcome" in a bitmap font', () => {
  const bitmap = textBitmap(CAPTION)

  expect(CAPTION).toBe('welcome')
  expect(bitmap).toHaveLength(5)
  expect(new Set(bitmap.map(row => row.length)).size).toBe(1)
  // w e l c o m e: three 3-wide, two 5-wide, one 3-wide... plus six one-pixel gaps.
  expect(bitmap[0]?.length).toBe(5 + 3 + 3 + 3 + 3 + 5 + 3 + 6)
  expect(bitmap.flat().some(Boolean)).toBe(true)
  expect(textBitmap('')[0]).toEqual([])
  expect(textBitmap('w?w')).toEqual(textBitmap('ww'))
})

test('the face is a shiba: fur, cream cheeks, a black nose, dark eyes, off it nothing', () => {
  const colors = new Set<number>()
  for (let v = 0; v <= 1; v += 0.01) for (let u = 0; u <= 1; u += 0.01) {
    const c = facePixel(u, v)
    if (c !== undefined) colors.add(c)
  }

  expect(colors.has(0x121212)).toBe(true) // nose
  expect(colors.has(0x1c1a17)).toBe(true) // pupils
  expect(colors.has(0xf8ecd6)).toBe(true) // cream
  expect(colors.size).toBeGreaterThan(12) // fur shading, ears, mouth, eyes
  for (const c of colors) expect(c).toBeLessThanOrEqual(0xffffff)
  // The corners of the frame are background.
  for (const [u, v] of [[0.01, 0.01], [0.99, 0.01], [0.01, 0.99], [0.99, 0.99]] as const) expect(facePixel(u, v)).toBeUndefined()
  // The middle of the head is not.
  expect(facePixel(0.55, 0.62)).toBeDefined()
})

test('the nose is on the left and the eyes above it, as in the three-quarter view', () => {
  expect(facePixel(0.225, 0.51)).toBe(0x121212)
  expect(facePixel(0.255, 0.35)).toBe(0x1c1a17)
  expect(facePixel(0.535, 0.4)).toBe(0x1c1a17)
})

test('the face is laid out centred, with the caption centred under it', () => {
  for (const [width, rows] of [[100, 20], [150, 28], [60, 10]] as const) {
    const layout = layoutFor(width, rows * 2)

    near(layout.faceW / layout.faceH, FACE_ASPECT, 0.06)
    near(layout.faceX + layout.faceW / 2, width / 2, 0.5)
    expect(layout.faceY + layout.faceH).toBeLessThanOrEqual(layout.textY)
    const textW = (layout.bits[0]?.length ?? 0) * layout.scale
    near(layout.textX + textW / 2, width / 2, 0.5)
    expect(layout.textY + 5 * layout.scale).toBeLessThanOrEqual(rows * 2)
    expect(layout.faceX).toBeGreaterThanOrEqual(0)
    expect(layout.faceX + layout.faceW).toBeLessThanOrEqual(width)
  }
})

test('the picture has face pixels in the middle, caption pixels below, nothing in the corners', () => {
  const layout = layoutFor(100, 40)
  const caption = captionColorFor('dark')

  expect(sourcePixel(0, 0, layout, caption)).toBeUndefined()
  expect(sourcePixel(99, 0, layout, caption)).toBeUndefined()
  expect(sourcePixel(50, Math.round(layout.faceH * 0.62), layout, caption)).toBeDefined()
  let captionPixels = 0
  for (let y = layout.textY; y < layout.textY + 5 * layout.scale; y++) {
    for (let x = layout.textX; x < layout.textX + 60; x++) if (sourcePixel(x, y, layout, caption) === caption) captionPixels += 1
  }
  expect(captionPixels).toBeGreaterThan(20)
})

test('the caption reads on the person\'s background: light on dark, dark on light, mid on auto', () => {
  const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255)

  expect(lum(captionColorFor('dark'))).toBeGreaterThan(600)
  expect(lum(captionColorFor('light'))).toBeLessThan(150)
  expect(lum(captionColorFor('neutral'))).toBeGreaterThan(300)
  expect(lum(captionColorFor('neutral'))).toBeLessThan(450)
})

test('it fades in, holds, fades out and is gone', () => {
  expect(visibleAt(-10)).toBe(0)
  expect(visibleAt(0)).toBe(0)
  near(visibleAt(FADE_IN_MS / 2), 0.5, 0.01)
  expect(visibleAt(FADE_IN_MS + HOLD_MS / 2)).toBe(1)
  near(visibleAt(FADE_IN_MS + HOLD_MS + FADE_OUT_MS / 2), 0.5, 0.01)
  expect(visibleAt(TOTAL_MS)).toBe(0)
  expect(visibleAt(TOTAL_MS * 10)).toBe(0)
  // Never goes up after the hold.
  let last = 1
  for (let ms = FADE_IN_MS + HOLD_MS; ms <= TOTAL_MS; ms += 50) {
    const v = visibleAt(ms)
    expect(v).toBeLessThanOrEqual(last + 1e-9)
    last = v
  }
  expect(TOTAL_MS).toBeLessThan(5000) // "a few seconds"
})

const blankCells = (words: number[]) => words.filter((_, i) => i % 3 === 0 && words[i] === 0x20).length
const drawnCells = (words: number[]) => words.length / 3 - blankCells(words)

test('the picture dissolves: more of it each step in, fewer each step out', () => {
  const at = (ms: number) => drawnCells(dogeWords(100, 20, ms, 'dark'))
  const held = at(FADE_IN_MS + 200)

  expect(at(0)).toBe(0)
  expect(at(FADE_IN_MS / 3)).toBeLessThan(at((FADE_IN_MS * 2) / 3))
  expect(at((FADE_IN_MS * 2) / 3)).toBeLessThan(held)
  const out = (k: number) => at(FADE_IN_MS + HOLD_MS + FADE_OUT_MS * k)
  expect(out(0.25)).toBeGreaterThan(out(0.5))
  expect(out(0.5)).toBeGreaterThan(out(0.75))
  expect(out(0.75)).toBeGreaterThan(0)
  expect(at(TOTAL_MS)).toBe(0)
  expect(held).toBeGreaterThan(100)
})

test('the background is the terminal\'s own: blank cells carry default colours, no fills', () => {
  const words = dogeWords(100, 20, FADE_IN_MS + 200, 'dark')

  for (let i = 0; i < words.length; i += 3) {
    const glyph = words[i]
    expect([0x20, 0x2580, 0x2584]).toContain(glyph)
    if (glyph === 0x20) expect(words.slice(i + 1, i + 3)).toEqual([DEFAULT, DEFAULT])
    // A half block with one side clear keeps the other side the terminal's.
    if (glyph === 0x2580 || glyph === 0x2584) expect(words[i + 1]).toBeLessThanOrEqual(0xffffff)
  }
  // Most of the band is background: the picture is a cut-out, not a block.
  expect(blankCells(words)).toBeGreaterThan(words.length / 3 / 2)
})

test('the cells are columns x rows x 12 bytes in padded base64, and a frame is pure', () => {
  const cells = dogeCells(80, 14, 1000, 'dark')
  const bytes = (cells.length / 4) * 3 - (cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0)

  expect(bytes).toBe(80 * 14 * 12)
  expect(dogeCells(80, 14, 1000, 'dark')).toBe(cells)
  expect(dogeCells(80, 14, 1000, 'light')).not.toBe(cells)
})

test('rows follow the room the engine gives, within the picture limits', () => {
  expect(rowsFor(20)).toBe(19)
  expect(rowsFor(MIN_ROWS + 1)).toBe(MIN_ROWS)
  expect(rowsFor(MIN_ROWS)).toBeUndefined()
  expect(rowsFor(100)).toBe(MAX_ROWS)
  expect(rowsFor(undefined)).toBeUndefined()
  expect(rowsFor(Number.NaN)).toBeUndefined()
  expect(rowsFor(-3)).toBeUndefined()
})

test('tiny and huge sizes do not throw', () => {
  expect(dogeWords(0, 10, 100)).toEqual([])
  expect(dogeWords(10, 0, 100)).toEqual([])
  expect(dogeWords(1, 1, 1000)).toHaveLength(3)
  expect(dogeWords(5, 3, 1000)).toHaveLength(5 * 3 * 3)
  expect(dogeWords(400, MAX_ROWS, 1000)).toHaveLength(400 * MAX_ROWS * 3)
  expect(dogeWords(40, 8, -50)).toHaveLength(40 * 8 * 3)
  expect(dogeWords(50, 8, 1e12).every(Number.isFinite)).toBe(true)
})
