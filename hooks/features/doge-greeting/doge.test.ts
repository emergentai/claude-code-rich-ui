import { expect, test } from 'claude-code/testing'

import {
  CAPTION,
  FACE_ASPECT,
  FADE_IN_MS,
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

const px = (col: number, row: number) => facePixel((col + 0.5) / 28, (row + 0.5) / 27)

test('the face is a shiba sprite: fur, cream cheeks, a black nose, dark eyes, brown ear, clear corners', () => {
  const colors = new Set<number>()
  for (let row = 0; row < 27; row++) for (let col = 0; col < 28; col++) {
    const c = px(col, row)
    if (c !== undefined) colors.add(c)
  }

  expect(colors.has(0x0e0e0e)).toBe(true) // nose, eyes, mouth
  expect(colors.has(0xd8cfa0)).toBe(true) // cream cheek
  expect(colors.has(0x8a5a2c)).toBe(true) // the dark ear patch
  expect(colors.size).toBeGreaterThanOrEqual(8)
  for (const c of colors) expect(c).toBeLessThanOrEqual(0xffffff)
  for (const [col, row] of [[0, 0], [27, 0], [0, 26], [27, 26]] as const) expect(px(col, row)).toBeUndefined()
  expect(px(14, 14)).toBeDefined()
  // Off the frame is clear.
  expect(facePixel(-0.1, 0.5)).toBeUndefined()
  expect(facePixel(0.5, 1)).toBeUndefined()
})

test('the nose is on the left, the eyes above it, the mouth runs right from it', () => {
  expect(px(7, 13)).toBe(0x0e0e0e) // nose
  expect(px(7, 15)).toBe(0x0e0e0e) // the stem
  expect(px(11, 17)).toBe(0x0e0e0e) // the mouth line
  expect(px(7, 9)).toBe(0x0e0e0e) // left eye
  expect(px(15, 10)).toBe(0x0e0e0e) // right eye, further right and lower
  expect(px(8, 10)).toBe(0xffffff) // its highlight
})

test('the face is laid out centred, with the caption centred under it', () => {
  for (const [width, rows] of [[100, 20], [150, 28], [60, 10]] as const) {
    const layout = layoutFor(width, rows * 2)

    near(layout.faceW / layout.faceH, FACE_ASPECT, 0.06)
    near(layout.faceX + layout.faceW / 2, width / 2, 0.5)
    expect(layout.faceY + layout.faceH).toBeLessThanOrEqual(layout.textY)
    // Room between the face and the caption: at least three pixel rows (a row and a half of cells).
    expect(layout.textY - (layout.faceY + layout.faceH)).toBeGreaterThanOrEqual(3)
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

test('it fades in, holds, then is simply gone: no fade out', () => {
  expect(visibleAt(-10)).toBe(0)
  expect(visibleAt(0)).toBe(0)
  near(visibleAt(FADE_IN_MS / 2), 0.5, 0.01)
  expect(visibleAt(FADE_IN_MS)).toBe(1)
  expect(visibleAt(FADE_IN_MS + HOLD_MS / 2)).toBe(1)
  expect(visibleAt(TOTAL_MS - 1)).toBe(1) // fully there until the last instant
  expect(visibleAt(TOTAL_MS)).toBe(0)
  expect(visibleAt(TOTAL_MS * 10)).toBe(0)
  expect(TOTAL_MS).toBe(FADE_IN_MS + HOLD_MS)
  expect(TOTAL_MS).toBeLessThan(5000) // "a few seconds"
})

const blankCells = (words: number[]) => words.filter((_, i) => i % 3 === 0 && words[i] === 0x20).length
const drawnCells = (words: number[]) => words.length / 3 - blankCells(words)

test('the picture dissolves in, then stays whole until it vanishes at once', () => {
  const at = (ms: number) => drawnCells(dogeWords(100, 20, ms, 'dark'))
  const held = at(FADE_IN_MS + 200)

  expect(at(0)).toBe(0)
  expect(at(FADE_IN_MS / 3)).toBeLessThan(at((FADE_IN_MS * 2) / 3))
  expect(at((FADE_IN_MS * 2) / 3)).toBeLessThan(held)
  expect(held).toBeGreaterThan(100)
  expect(at(TOTAL_MS - 1)).toBe(held)
  expect(at(TOTAL_MS)).toBe(0)
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
