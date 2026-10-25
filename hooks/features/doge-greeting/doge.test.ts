import { expect, test } from 'claude-code/testing'

import { MAX_ROWS, MIN_ROWS, PALETTE, PHRASES, TOTAL_MS, dogeCells, dogeWords, pixelAt, rowsFor, sceneFor, textBitmap } from './doge'

const FACE_COLORS = [0xd9a45b, 0xb87f3a, 0xf7ead0, 0xfffaf0, 0x14110f, 0x5a3a1c, 0xff7a90, 0xe8a79a, 0xffffff]
const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255)

test('text bitmaps are 5 tall, rectangular and skip unknown letters', () => {
  const wow = textBitmap('wow')

  expect(wow).toHaveLength(5)
  expect(new Set(wow.map(row => row.length)).size).toBe(1)
  expect(wow.flat().some(Boolean)).toBe(true)
  expect(textBitmap('w?w')).toEqual(textBitmap('ww'))
  expect(textBitmap('')[0]).toEqual([])
  // Every letter the phrases use has a glyph, so none is silently dropped.
  for (const { text } of PHRASES) {
    const letters = text.replace(/ /g, '')
    expect((textBitmap(letters)[0] ?? []).length).toBeGreaterThan(letters.length * 2)
  }
})

test('rows follow the room the engine gives, within the scene limits', () => {
  expect(rowsFor(20)).toBe(19)
  expect(rowsFor(MIN_ROWS + 1)).toBe(MIN_ROWS)
  expect(rowsFor(MIN_ROWS)).toBeUndefined()
  expect(rowsFor(100)).toBe(MAX_ROWS)
  expect(rowsFor(undefined)).toBeUndefined()
  expect(rowsFor(Number.NaN)).toBeUndefined()
  expect(rowsFor(-3)).toBeUndefined()
})

test('the banner is columns x rows x 3 words with real colours', () => {
  const words = dogeWords(120, 14, 2500)

  expect(words).toHaveLength(120 * 14 * 3)
  for (let i = 0; i < words.length; i += 3) {
    expect(words[i]).toBe(0x2580)
    expect(words[i + 1]).toBeLessThanOrEqual(0xffffff)
    expect(words[i + 2]).toBeLessThanOrEqual(0xffffff)
  }
})

test('cells are padded base64 of the right size and a frame is pure', () => {
  const cells = dogeCells(80, 10, 1000)
  const bytes = (cells.length / 4) * 3 - (cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0)

  expect(bytes).toBe(80 * 10 * 12)
  expect(dogeCells(80, 10, 1000)).toBe(cells)
})

test('the doge is in the middle: fur and the cream muzzle are there, the corners are background', () => {
  const width = 150
  const height = 36
  const scene = sceneFor(width, height)
  const at = (x: number, y: number) => pixelAt(Math.round(x), Math.round(y), 3500, width, height)

  expect(at(scene.cx + scene.r * 0.22, scene.cy + scene.r * 0.3)).toBe(0xfffaf0) // muzzle
  expect(FACE_COLORS).toContain(at(scene.cx - scene.r * 0.7, scene.cy - scene.r * 0.1))
  // The far corners are the dark backdrop.
  expect(lum(at(1, height - 1))).toBeLessThan(120)
  expect(lum(at(width - 2, height - 1))).toBeLessThan(120)
})

test('the face blinks now and then, and the picture keeps moving', () => {
  const width = 150
  const height = 36
  const scene = sceneFor(width, height)
  const eyeX = Math.round(scene.cx - scene.r * 0.42)
  // Black pixels in the left eye's box: an open eye has more of them than a blink.
  const dark = (ms: number) => {
    let n = 0
    for (let y = Math.round(scene.cy - scene.r * 0.4); y < Math.round(scene.cy + scene.r * 0.1); y++) {
      for (let x = eyeX - 3; x <= eyeX + 3; x++) if (pixelAt(x, y, ms, width, height) === 0x14110f) n += 1
    }
    return n
  }

  expect(dark(0)).toBeGreaterThan(dark(2250))
  const frames = new Set([0, 700, 1400, 2100, 2800].map(ms => dogeWords(150, 18, ms).join(',')))
  expect(frames.size).toBe(5)
})

test('phrases pop in one after another, and wow comes first', () => {
  const width = 150
  const height = 36
  const scene = sceneFor(width, height)
  const first = scene.phrases[0]!
  const last = scene.phrases[scene.phrases.length - 1]!
  const lit = (p: typeof first, ms: number) => {
    for (let y = p.y - 2; y < p.y + p.h + 2; y++) for (let x = p.x; x < p.x + p.w; x++) if ((PALETTE as readonly number[]).includes(pixelAt(x, y, ms, width, height))) return true
    return false
  }

  expect(first.appearsAt).toBeLessThan(last.appearsAt)
  expect(lit(first, 0)).toBe(false)
  expect(lit(first, first.appearsAt + 700)).toBe(true)
  expect(lit(last, last.appearsAt - 100)).toBe(false)
  expect(lit(last, last.appearsAt + 700)).toBe(true)
  expect(last.appearsAt).toBeLessThan(TOTAL_MS)
})

test('no phrase touches the face or leaves the band', () => {
  for (const [width, rows] of [[150, 18], [100, 12], [220, 28], [60, 8]] as const) {
    const height = rows * 2
    const scene = sceneFor(width, height)
    for (const p of scene.phrases) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w).toBeLessThanOrEqual(width)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y + p.h).toBeLessThanOrEqual(height)
      const clearOfFace = p.x + p.w <= scene.cx - scene.r * 1.25 || p.x >= scene.cx + scene.r * 1.25
      expect(clearOfFace).toBe(true)
    }
  }
})

test('a wide band keeps every phrase; a narrow one drops what does not fit, never all', () => {
  expect(sceneFor(220, 36).phrases).toHaveLength(PHRASES.length)
  const narrow = sceneFor(60, 16).phrases
  expect(narrow.length).toBeLessThan(PHRASES.length)
})

test('tiny and huge sizes do not throw', () => {
  expect(dogeWords(0, 10, 100)).toEqual([])
  expect(dogeWords(10, 0, 100)).toEqual([])
  expect(dogeWords(1, 1, 100)).toHaveLength(3)
  expect(dogeWords(400, MAX_ROWS, TOTAL_MS)).toHaveLength(400 * MAX_ROWS * 3)
  expect(dogeWords(40, 8, -50)).toHaveLength(40 * 8 * 3)
  expect(dogeWords(50, 8, 1e12).every(Number.isFinite)).toBe(true)
})
