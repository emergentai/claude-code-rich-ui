// The greeting as pure functions: a big "welcome" in Claude's orange across the band above
// the prompt, over the terminal's own background. It sweeps in from the left, holds for a
// second, and is then simply gone. Cells are half blocks, two pixels per cell, so a band
// `rows` tall is `rows * 2` square pixels high.

import { encodeWords } from '../aurora-common/aurora'

export const MIN_ROWS = 7
export const MAX_ROWS = 28
export const FADE_IN_MS = 900
export const HOLD_MS = 500
export const FADE_OUT_MS = 900
// It fades in from the left, stays, and fades out from the left the same way.
export const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const DEFAULT_COLOR = 0x01000000 // bit 24 alone: the terminal's own colour
export const CAPTION = 'welcome'

// 3 (or 5) wide, 5 tall; '#' is lit. Letters are drawn as capitals whatever case is typed.
const FONT: Record<string, readonly string[]> = {
  a: ['.#.', '#.#', '###', '#.#', '#.#'],
  b: ['##.', '#.#', '##.', '#.#', '##.'],
  c: ['.##', '#..', '#..', '#..', '.##'],
  d: ['##.', '#.#', '#.#', '#.#', '##.'],
  e: ['###', '#..', '##.', '#..', '###'],
  f: ['###', '#..', '##.', '#..', '#..'],
  g: ['.##', '#..', '#.#', '#.#', '.##'],
  h: ['#.#', '#.#', '###', '#.#', '#.#'],
  i: ['###', '.#.', '.#.', '.#.', '###'],
  j: ['..#', '..#', '..#', '#.#', '.#.'],
  k: ['#.#', '#.#', '##.', '#.#', '#.#'],
  l: ['#..', '#..', '#..', '#..', '###'],
  m: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  n: ['##.', '#.#', '#.#', '#.#', '#.#'],
  o: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  p: ['##.', '#.#', '##.', '#..', '#..'],
  q: ['.#.', '#.#', '#.#', '##.', '.##'],
  r: ['##.', '#.#', '##.', '#.#', '#.#'],
  s: ['.##', '#..', '.#.', '..#', '##.'],
  t: ['###', '.#.', '.#.', '.#.', '.#.'],
  u: ['#.#', '#.#', '#.#', '#.#', '###'],
  v: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  w: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  x: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'],
  '-': ['...', '...', '###', '...', '...'],
  ' ': ['..', '..', '..', '..', '..'],
}
const GLYPH_H = 5

// What the person typed, as the sign can draw it: the letters, digits and a few marks, one
// space between words, at most MAX_TEXT characters; the default when nothing is left.
export const MAX_TEXT = 20

export function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return CAPTION
  let out = ''
  for (const ch of raw.toLowerCase()) if (FONT[ch] !== undefined) out += ch
  out = out.replace(/ +/g, ' ').trim().slice(0, MAX_TEXT).trim()

  return out === '' ? CAPTION : out
}

export function textBitmap(text: string): boolean[][] {
  const bitmap: boolean[][] = Array.from({ length: GLYPH_H }, () => [])
  let isFirst = true

  for (const ch of text.toLowerCase()) {
    const glyph = FONT[ch]
    if (glyph === undefined) continue
    for (let y = 0; y < GLYPH_H; y++) {
      const row = bitmap[y] as boolean[]
      if (!isFirst) row.push(false)
      for (const px of glyph[y] as string) row.push(px === '#')
    }
    isFirst = false
  }

  return bitmap
}

function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16

  return (h >>> 0) / 4294967296
}

// The share of the soft edge, as a fraction of the width, over which a column goes from
// nothing to fully there (or back).
const EDGE = 0.35

// How far a sweep of `ms` into its `duration` has got, in widths plus the soft edge.
function front(ms: number, duration: number): number {
  return Math.max(0, Math.min(1, ms / duration)) * (1 + EDGE)
}

// How much of column `x` of `width` shows at `ms` (0 to 1): a front moves left to right
// fading each column up behind it; after the hold a second front fades them out the same
// way, left first.
export function columnVisibility(x: number, width: number, ms: number): number {
  if (ms >= TOTAL_MS) return 0
  const at = x / width
  const up = Math.max(0, Math.min(1, (front(ms, FADE_IN_MS) - at) / EDGE))
  const down = Math.max(0, Math.min(1, (front(ms - FADE_IN_MS - HOLD_MS, FADE_OUT_MS) - at) / EDGE))

  return up * (1 - down)
}

// Claude's orange, a touch lighter at the top of the letters and deeper at the bottom.
const TOP = [0xf0, 0x9a, 0x76] as const
const BOTTOM = [0xc1, 0x5f, 0x3c] as const

export function letterColor(y: number, textTop: number, textH: number): number {
  const t = textH <= 1 ? 0 : Math.max(0, Math.min(1, (y - textTop) / (textH - 1)))
  const ch = (i: 0 | 1 | 2) => Math.round(TOP[i] + (BOTTOM[i] - TOP[i]) * t)

  return (ch(0) << 16) | (ch(1) << 8) | ch(2)
}

export type Layout = {
  width: number
  height: number
  textX: number
  textY: number
  textH: number
  scale: number
  bits: boolean[][]
}

let cached: (Layout & { text: string }) | undefined

// The word as big as the band allows (a whole number of pixels a dot), centred.
export function layoutFor(width: number, height: number, text: string = CAPTION): Layout {
  if (cached?.width === width && cached.height === height && cached.text === text) return cached
  // A band too narrow for the whole word, even in the smallest type, shows as much of the
  // start of it as fits rather than a word cut off at both edges.
  let shown = text
  let bits = textBitmap(shown)
  while ((bits[0]?.length ?? 0) > width - 2 && shown.length > 1) {
    shown = shown.slice(0, -1)
    bits = textBitmap(shown)
  }
  const bitsW = bits[0]?.length ?? 1
  const scale = Math.max(
    1,
    Math.min(Math.floor((width * 0.9) / bitsW), Math.floor((height * 0.8) / GLYPH_H)),
  )
  const textW = bitsW * scale
  const textH = GLYPH_H * scale
  cached = {
    text,
    width,
    height,
    textX: Math.round((width - textW) / 2),
    textY: Math.round((height - textH) / 2),
    textH,
    scale,
    bits,
  }

  return cached
}

// The colour of the picture at a pixel, or undefined where the terminal shows through.
export function sourcePixel(x: number, y: number, layout: Layout): number | undefined {
  const tx = Math.floor((x - layout.textX) / layout.scale)
  const ty = Math.floor((y - layout.textY) / layout.scale)
  if (tx < 0 || ty < 0 || layout.bits[ty]?.[tx] !== true) return undefined

  return letterColor(y, layout.textY, layout.textH)
}

// The banner's cells at `ms`, `columns` wide and `rows` tall, as 32-bit words. Pixels that
// are not part of the word, or are not faded in (or have faded out), leave the terminal's own colours.
export function dogeWords(columns: number, rows: number, ms: number, text: string = CAPTION): number[] {
  if (columns < 1 || rows < 1) return []
  const layout = layoutFor(columns, rows * 2, text)
  const words: number[] = []
  const pixel = (x: number, y: number) =>
    hash01(x, y) < columnVisibility(x, columns, ms) ? sourcePixel(x, y, layout) : undefined

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const top = pixel(c, r * 2)
      const bottom = pixel(c, r * 2 + 1)
      if (top === undefined && bottom === undefined) words.push(0x20, DEFAULT_COLOR, DEFAULT_COLOR)
      else if (bottom === undefined) words.push(UPPER_HALF, top as number, DEFAULT_COLOR)
      else if (top === undefined) words.push(LOWER_HALF, bottom, DEFAULT_COLOR)
      else words.push(UPPER_HALF, top, bottom)
    }
  }

  return words
}

export function dogeCells(columns: number, rows: number, ms: number, text: string = CAPTION): string {
  return encodeWords(dogeWords(columns, rows, ms, text))
}

// How tall the band may be: the engine's room less one row, within the sizes the picture
// is drawn for. Undefined when there is no room.
export function rowsFor(maxRows: number | undefined): number | undefined {
  if (maxRows === undefined || !Number.isFinite(maxRows)) return undefined
  const rows = Math.min(MAX_ROWS, Math.floor(maxRows) - 1)

  return rows >= MIN_ROWS ? rows : undefined
}
