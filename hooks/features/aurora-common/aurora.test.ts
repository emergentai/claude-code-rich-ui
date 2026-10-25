import { expect, test } from 'claude-code/testing'

import {
  BAND_ROWS,
  MAX_COLUMNS,
  auroraCells,
  auroraWords,
  bandSize,
  colorAt,
  encodeBase64,
  toneOf,
} from './aurora'

const luminance = (rgb: number) =>
  0.2126 * ((rgb >> 16) & 255) + 0.7152 * ((rgb >> 8) & 255) + 0.0722 * (rgb & 255)

function meanLuminance(tone: 'dark' | 'light' | 'neutral') {
  const words = auroraWords(60, 3, 12.5, tone)
  let sum = 0
  let n = 0
  for (let i = 0; i < words.length; i += 3) {
    sum += luminance(words[i + 1] as number) + luminance(words[i + 2] as number)
    n += 2
  }

  return sum / n
}

test('base64 matches the standard vectors', () => {
  const bytes = (s: string) => [...s].map(c => c.charCodeAt(0))
  expect(encodeBase64([])).toBe('')
  expect(encodeBase64(bytes('f'))).toBe('Zg==')
  expect(encodeBase64(bytes('fo'))).toBe('Zm8=')
  expect(encodeBase64(bytes('foo'))).toBe('Zm9v')
  expect(encodeBase64(bytes('foobar'))).toBe('Zm9vYmFy')
})

test('the cells hold exactly columns x rows x 12 bytes, in padded base64', () => {
  const cells = auroraCells(40, 3, 1, 'dark')
  const bytes = (cells.length / 4) * 3 - (cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0)

  expect(bytes).toBe(40 * 3 * 12)
  expect(cells).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
})

test('every cell is an upper half block with two real colours', () => {
  const words = auroraWords(30, 3, 7.3, 'neutral')

  expect(words).toHaveLength(30 * 3 * 3)
  for (let i = 0; i < words.length; i += 3) {
    expect(words[i]).toBe(0x2580)
    // 0x00RRGGBB: bit 24 is the terminal-default marker and must stay clear.
    expect(words[i + 1]).toBeGreaterThanOrEqual(0)
    expect(words[i + 1]).toBeLessThanOrEqual(0xffffff)
    expect(words[i + 2]).toBeGreaterThanOrEqual(0)
    expect(words[i + 2]).toBeLessThanOrEqual(0xffffff)
  }
})

test('a frame is a pure function of its inputs', () => {
  expect(auroraCells(50, 3, 4.25, 'light')).toBe(auroraCells(50, 3, 4.25, 'light'))
})

test('the field drifts: a frame step is a small change, a long gap a large one', () => {
  const a = auroraWords(60, 3, 10, 'dark')
  const step = auroraWords(60, 3, 10.08, 'dark')
  const far = auroraWords(60, 3, 25, 'dark')
  // Mean absolute change per colour channel over every colour word.
  const distance = (x: number[], y: number[]) => {
    let sum = 0
    let n = 0
    for (let i = 0; i < x.length; i += 3) {
      for (const k of [1, 2]) {
        const p = x[i + k] as number
        const q = y[i + k] as number
        sum += Math.abs(((p >> 16) & 255) - ((q >> 16) & 255))
        sum += Math.abs(((p >> 8) & 255) - ((q >> 8) & 255))
        sum += Math.abs((p & 255) - (q & 255))
        n += 3
      }
    }

    return sum / n
  }

  expect(distance(a, step)).toBeGreaterThan(0)
  // "Slowly shifting": one frame moves a colour channel by well under 5 of 255.
  expect(distance(a, step)).toBeLessThan(5)
  expect(distance(a, far)).toBeGreaterThan(distance(a, step) * 4)
})

test('neighbouring cells stay close in colour (a gradient, not noise)', () => {
  const words = auroraWords(80, 1, 3, 'dark')
  let jump = 0
  for (let c = 1; c < 80; c++) {
    const prev = words[(c - 1) * 3 + 1] as number
    const cur = words[c * 3 + 1] as number
    jump = Math.max(
      jump,
      Math.abs(((prev >> 16) & 255) - ((cur >> 16) & 255)),
      Math.abs(((prev >> 8) & 255) - ((cur >> 8) & 255)),
      Math.abs((prev & 255) - (cur & 255)),
    )
  }

  expect(jump).toBeLessThan(60)
})

test('a light theme is brighter than a dark one, a neutral one sits between', () => {
  const dark = meanLuminance('dark')
  const neutral = meanLuminance('neutral')
  const light = meanLuminance('light')

  expect(light).toBeGreaterThan(neutral)
  expect(neutral).toBeGreaterThan(dark - 1)
  expect(light).toBeGreaterThan(dark + 40)
  // Dark stays a glow, not a glare; light stays coloured, not white.
  expect(dark).toBeLessThan(150)
  expect(light).toBeLessThan(250)
})

test('colours stay in range for any input, including negative and huge ones', () => {
  for (const v of [-3.7, -0.0001, 0, 0.5, 0.9999, 1, 42.42, 1e9]) {
    for (const b of [0, 0.5, 1]) {
      for (const tone of ['dark', 'light', 'neutral'] as const) {
        const c = colorAt(v, b, tone)
        expect(Number.isInteger(c)).toBe(true)
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(0xffffff)
      }
    }
  }
})

test('degenerate sizes give no cells instead of throwing', () => {
  expect(auroraCells(0, 3, 1, 'dark')).toBe('')
  expect(auroraCells(10, 0, 1, 'dark')).toBe('')
  expect(auroraCells(-5, 3, 1, 'dark')).toBe('')
  expect(auroraWords(1, 1, 0, 'dark')).toHaveLength(3)
})

test('a very large time stays finite and in range', () => {
  const words = auroraWords(20, 3, 1.8e9, 'dark')

  expect(words.every(Number.isFinite)).toBe(true)
  expect(words.every(w => w >= 0)).toBe(true)
})

test('the theme setting maps to a tone; anything unknown is neutral', () => {
  expect(toneOf('dark')).toBe('dark')
  expect(toneOf('dark-daltonized')).toBe('dark')
  expect(toneOf('dark-ansi')).toBe('dark')
  expect(toneOf('light')).toBe('light')
  expect(toneOf('light-ansi')).toBe('light')
  expect(toneOf('auto')).toBe('neutral')
  expect(toneOf('custom:mine')).toBe('neutral')
  expect(toneOf(undefined)).toBe('neutral')
  expect(toneOf(3)).toBe('neutral')
})

test('the band fits wide windows and is capped', () => {
  expect(bandSize({ columns: 100, rows: 40 })).toEqual({ columns: 98, rows: BAND_ROWS })
  expect(bandSize({ columns: 400, rows: 60 })?.columns).toBe(MAX_COLUMNS)
})

test('a narrow or short window, or no measurement, keeps the stock spinner', () => {
  expect(bandSize({ columns: 49, rows: 40 })).toBeUndefined()
  expect(bandSize({ columns: 120, rows: 23 })).toBeUndefined()
  expect(bandSize({ columns: 50, rows: 24 })).toEqual({ columns: 48, rows: BAND_ROWS })
  expect(bandSize(undefined)).toBeUndefined()
  expect(bandSize({})).toBeUndefined()
  expect(bandSize({ columns: Number.NaN, rows: 40 })).toBeUndefined()
  expect(bandSize({ columns: 120, rows: Number.POSITIVE_INFINITY })).toBeUndefined()
})

// ---- sweep, meter, wordmark, pacer

import {
  MAX_MISSES,
  WORDMARK_ROWS,
  createPacer,
  meterWords,
  sweepWords,
  wordmarkBitmap,
  wordmarkWidth,
  wordmarkWords,
} from './aurora'

const BLANK_WORDS = [0x20, 0x01000000, 0x01000000]

test('a sweep shows only the columns between from and to, the rest in default colours', () => {
  const words = sweepWords(10, 2, 3, 'dark', 0.2, 0.6)

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = words.slice((r * 10 + c) * 3, (r * 10 + c) * 3 + 3)
      if (c >= 2 && c < 6) expect(cell[0]).toBe(0x2580)
      else expect(cell).toEqual(BLANK_WORDS)
    }
  }
})

test('a full sweep is the whole field and an empty one is blank', () => {
  expect(sweepWords(12, 3, 5, 'light', 0, 1)).toEqual(auroraWords(12, 3, 5, 'light'))
  expect(sweepWords(12, 3, 5, 'light', 0, 0).every((w, i) => w === BLANK_WORDS[i % 3])).toBe(true)
  // Out-of-range and reversed bounds draw nothing or clamp, never throw.
  expect(sweepWords(6, 1, 0, 'dark', -4, 9)).toEqual(auroraWords(6, 1, 0, 'dark'))
  expect(sweepWords(6, 1, 0, 'dark', 0.8, 0.2).every((w, i) => w === BLANK_WORDS[i % 3])).toBe(true)
})

test('a meter fills the asked fraction, the rest is a dim shade', () => {
  const words = meterWords(10, 0.3, 4, 'dark')
  const filled = words.filter((_, i) => i % 3 === 0 && words[i] === 0x2588).length

  expect(words).toHaveLength(30)
  expect(filled).toBe(3)
  expect(words.filter((_, i) => i % 3 === 0 && words[i] === 0x2591)).toHaveLength(7)
})

test('a meter clamps odd fractions and handles no width', () => {
  expect(meterWords(8, 2, 0, 'dark').filter((w, i) => i % 3 === 0 && w === 0x2588)).toHaveLength(8)
  expect(meterWords(8, -1, 0, 'dark').filter((w, i) => i % 3 === 0 && w === 0x2588)).toHaveLength(0)
  expect(meterWords(8, Number.NaN, 0, 'dark').filter((w, i) => i % 3 === 0 && w === 0x2588)).toHaveLength(0)
  expect(meterWords(0, 0.5, 0, 'dark')).toEqual([])
})

test('the wordmark is 5 pixels tall and as wide as its letters plus one-pixel gaps', () => {
  const bitmap = wordmarkBitmap('rich-ui')

  expect(bitmap).toHaveLength(5)
  expect(wordmarkWidth('rich-ui')).toBe(4 + 3 + 4 + 4 + 3 + 4 + 3 + 6)
  expect(new Set(bitmap.map(row => row.length)).size).toBe(1)
  expect(bitmap.flat().some(Boolean)).toBe(true)
  // Unknown characters are skipped, not drawn as holes.
  expect(wordmarkWidth('r?i')).toBe(wordmarkWidth('ri'))
  expect(wordmarkWidth('')).toBe(0)
})

test('the wordmark cells match its size, light only where a pixel is lit', () => {
  const width = wordmarkWidth('rich-ui')
  const words = wordmarkWords('rich-ui', 2, 'dark')

  expect(words).toHaveLength(width * WORDMARK_ROWS * 3)
  const glyphs = words.filter((_, i) => i % 3 === 0)
  expect(new Set(glyphs).size).toBeGreaterThan(1)
  for (const glyph of glyphs) expect([0x20, 0x2580, 0x2584, 0x2588]).toContain(glyph)
  // Blank cells use the terminal's colours, lit ones a real colour.
  for (let i = 0; i < words.length; i += 3) {
    if (words[i] === 0x20) expect(words.slice(i, i + 3)).toEqual(BLANK_WORDS)
    else expect(words[i + 1]).toBeLessThanOrEqual(0xffffff)
  }
})

test('the pacer drops a frame while one is in flight', () => {
  const pacer = createPacer()

  expect(pacer.begin()).toBe(true)
  expect(pacer.begin()).toBe(false)
  expect(pacer.end(false)).toBe(false)
  expect(pacer.begin()).toBe(true)
})

test('the pacer stops after a run of denials and forgives a success', () => {
  const pacer = createPacer(3)
  const run = (denied: boolean) => {
    pacer.begin()

    return pacer.end(denied)
  }

  expect(run(true)).toBe(false)
  expect(run(true)).toBe(false)
  expect(run(false)).toBe(false) // a success resets the run
  expect(run(true)).toBe(false)
  expect(run(true)).toBe(false)
  expect(run(true)).toBe(true)
  expect(MAX_MISSES).toBeGreaterThan(10)
})
