// The aurora field as pure functions: no `$`, no clock, no engine. A frame is a
// function of (size, time, tone), so it can be tested and cached by value.

export const FRAME_MS = 80 // about 12.5 frames a second
export const BAND_ROWS = 3
export const MAX_MISSES = 25 // blits denied in a row before a timer gives up (about 2 s)
export const MIN_COLUMNS = 50
export const MIN_ROWS = 24
export const MAX_COLUMNS = 120
// Radians a second of the slowest term: one full drift takes about half a minute.
const SPEED = 0.35

export type Tone = 'dark' | 'light' | 'neutral'

export type Size = { columns: number; rows: number }

const UPPER_HALF = 0x2580

// What the person's `theme` setting says about the background. `auto` follows the
// terminal, which a plugin cannot see, so it (and anything unknown) is neutral.
export function toneOf(theme: unknown): Tone {
  if (typeof theme !== 'string') return 'neutral'
  if (theme.startsWith('light')) return 'light'
  if (theme.startsWith('dark')) return 'dark'

  return 'neutral'
}

// The band's size for a window, or undefined when the stock spinner should stay:
// no measured window, too narrow, or too short to spare three rows.
export function bandSize(viewport: Partial<Size> | undefined): Size | undefined {
  const columns = viewport?.columns
  const rows = viewport?.rows
  if (columns === undefined || rows === undefined) return undefined
  if (!Number.isFinite(columns) || !Number.isFinite(rows)) return undefined
  if (columns < MIN_COLUMNS || rows < MIN_ROWS) return undefined

  return { columns: Math.min(Math.floor(columns) - 2, MAX_COLUMNS), rows: BAND_ROWS }
}

// Aurora greens, teals, blues and violets, cyclic so the field never runs off an end.
const STOPS: readonly (readonly [number, number, number])[] = [
  [30, 200, 130],
  [30, 185, 205],
  [70, 120, 225],
  [140, 90, 220],
  [200, 90, 190],
  [90, 150, 215],
]

function channel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function mix(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

// v in [0, 1) walks the cyclic stops; b in [0, 1] is the curtain brightness.
// Dark and neutral backgrounds dim a colour toward black, a light one washes it
// toward white, so the field is a soft glow on either rather than a glare.
export function colorAt(v: number, b: number, tone: Tone): number {
  const pos = (((v % 1) + 1) % 1) * STOPS.length
  const i = Math.floor(pos)
  const k = pos - i
  const from = STOPS[i % STOPS.length] as readonly [number, number, number]
  const to = STOPS[(i + 1) % STOPS.length] as readonly [number, number, number]
  const rgb = [0, 1, 2].map(c => mix(from[c] as number, to[c] as number, k))
  const shade = tone === 'light' ? 255 : 0
  const strength = tone === 'light' ? 0.65 : tone === 'dark' ? 0.6 : 0.45
  const amount = (1 - b) * strength + (tone === 'light' ? 0.25 : 0)
  const [r, g, bl] = rgb.map(c => channel(mix(c as number, shade, amount)))

  return ((r as number) << 16) | ((g as number) << 8) | (bl as number)
}

// One pixel of the field. x and y are in pixels, which are square (a half-block
// cell is one column wide and two pixels tall); t is in seconds.
export function pixelAt(x: number, y: number, t: number, width: number): number[] {
  const w = t * SPEED
  const hue =
    Math.sin(x / 11 + w) +
    Math.sin(y / 3.2 - w * 1.7) +
    Math.sin((x + y * 2) / 15 + w * 2.3) +
    Math.sin(Math.hypot(x - width / 2, y * 2) / 9 - w * 1.3)
  const curtain = Math.sin(x / 17 - y / 4 + w * 1.9)

  return [(hue + 4) / 8, (curtain + 1) / 2]
}

// The cells as 32-bit words `[glyph, foreground, background]` per cell, row-major.
// Each cell is an upper half block: the foreground is the pixel above, the
// background the pixel below.
export function auroraWords(columns: number, rows: number, t: number, tone: Tone): number[] {
  if (columns < 1 || rows < 1) return []
  const words: number[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const [vTop, bTop] = pixelAt(c, r * 2, t, columns) as [number, number]
      const [vBottom, bBottom] = pixelAt(c, r * 2 + 1, t, columns) as [number, number]
      words.push(UPPER_HALF, colorAt(vTop, bTop, tone), colorAt(vBottom, bBottom, tone))
    }
  }

  return words
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Standard padded base64 of little-endian u32 words; the module has no Buffer.
export function encodeWords(words: readonly number[]): string {
  const bytes: number[] = []
  for (const word of words) bytes.push(word & 255, (word >>> 8) & 255, (word >>> 16) & 255, (word >>> 24) & 255)

  return encodeBase64(bytes)
}

export function encodeBase64(bytes: readonly number[]): string {
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += ALPHABET[(n >> 18) & 63]
    out += ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '='
  }

  return out
}

// A Raster's `cells` for the field at time `t` (seconds).
export function auroraCells(columns: number, rows: number, t: number, tone: Tone): string {
  return encodeWords(auroraWords(columns, rows, t, tone))
}

const DEFAULT_COLOR = 0x01000000 // bit 24 alone: the terminal's own colour
const BLANK = [0x20, DEFAULT_COLOR, DEFAULT_COLOR]

// The field with only the columns from `from` to `to` (fractions of the width, 0 to 1)
// drawn, the rest blank in the terminal's own colours: a sweep in is (0, p), a sweep out
// is (p, 1), and (0, 1) is the whole field.
export function sweepWords(
  columns: number,
  rows: number,
  t: number,
  tone: Tone,
  from: number,
  to: number,
): number[] {
  const words = auroraWords(columns, rows, t, tone)
  const first = Math.round(Math.max(0, Math.min(1, from)) * columns)
  const last = Math.round(Math.max(0, Math.min(1, to)) * columns)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (c >= first && c < last) continue
      words.splice((r * columns + c) * 3, 3, ...BLANK)
    }
  }

  return words
}

export function sweepCells(
  columns: number,
  rows: number,
  t: number,
  tone: Tone,
  from: number,
  to: number,
): string {
  return encodeWords(sweepWords(columns, rows, t, tone, from, to))
}

// ---- a gradient bar: `fraction` of the width filled with the drifting field, the rest dim.

const UNFILLED = 0x2591 // light shade
const FULL = 0x2588

export function meterWords(columns: number, fraction: number, t: number, tone: Tone): number[] {
  if (columns < 1) return []
  const filled = Math.round(Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * columns)
  const dim = tone === 'light' ? 0xb4b4b4 : 0x6a6a6a
  const words: number[] = []

  for (let c = 0; c < columns; c++) {
    if (c < filled) {
      const [v, b] = pixelAt(c, 0, t, columns) as [number, number]
      words.push(FULL, colorAt(v, Math.max(b, 0.55), tone), DEFAULT_COLOR)
    } else {
      words.push(UNFILLED, dim, DEFAULT_COLOR)
    }
  }

  return words
}

export function meterCells(columns: number, fraction: number, t: number, tone: Tone): string {
  return encodeWords(meterWords(columns, fraction, t, tone))
}

// ---- a wordmark in half-block pixel type, filled with the field.

// 5 pixels tall; '#' is a lit pixel.
const FONT: Record<string, readonly string[]> = {
  r: ['###.', '#..#', '###.', '#.#.', '#..#'],
  i: ['###', '.#.', '.#.', '.#.', '###'],
  c: ['.###', '#...', '#...', '#...', '.###'],
  h: ['#..#', '#..#', '####', '#..#', '#..#'],
  '-': ['...', '...', '###', '...', '...'],
  u: ['#..#', '#..#', '#..#', '#..#', '.##.'],
}
const GLYPH_ROWS = 5
export const WORDMARK_ROWS = 3

// The wordmark as a bitmap (rows of booleans), letters one pixel apart; unknown
// characters are skipped.
export function wordmarkBitmap(text: string): boolean[][] {
  const bitmap: boolean[][] = Array.from({ length: GLYPH_ROWS }, () => [])
  let isFirst = true

  for (const ch of text) {
    const glyph = FONT[ch]
    if (glyph === undefined) continue
    for (let y = 0; y < GLYPH_ROWS; y++) {
      const row = bitmap[y] as boolean[]
      if (!isFirst) row.push(false)
      for (const px of glyph[y] as string) row.push(px === '#')
    }
    isFirst = false
  }

  return bitmap
}

export function wordmarkWidth(text: string): number {
  return (wordmarkBitmap(text)[0] ?? []).length
}

// Cells of the wordmark, `WORDMARK_ROWS` tall, `wordmarkWidth(text)` wide: lit pixels
// take the field's colour, the rest is the terminal's own background.
export function wordmarkWords(text: string, t: number, tone: Tone): number[] {
  const bitmap = wordmarkBitmap(text)
  const width = (bitmap[0] ?? []).length
  const words: number[] = []
  const lit = (x: number, y: number) => bitmap[y]?.[x] === true

  for (let r = 0; r < WORDMARK_ROWS; r++) {
    for (let c = 0; c < width; c++) {
      const top = lit(c, r * 2)
      const bottom = lit(c, r * 2 + 1)
      const [v, b] = pixelAt(c, r * 2, t, width) as [number, number]
      const color = colorAt(v, Math.max(b, 0.6), tone)
      if (top && bottom) words.push(FULL, color, DEFAULT_COLOR)
      else if (top) words.push(UPPER_HALF, color, DEFAULT_COLOR)
      else if (bottom) words.push(0x2584, color, DEFAULT_COLOR)
      else words.push(...BLANK)
    }
  }

  return words
}

export function wordmarkCells(text: string, t: number, tone: Tone): string {
  return encodeWords(wordmarkWords(text, t, tone))
}

// ---- the frame loop's bookkeeping, pure so every feature's timer shares it.

// One frame in flight at a time (a host slower than a frame drops frames, nothing
// queues), and a run of denied blits (the Raster is gone) ends the timer.
export function createPacer(maxMisses: number = MAX_MISSES) {
  let isBusy = false
  let misses = 0

  return {
    // False when the previous frame has not come back.
    begin(): boolean {
      if (isBusy) return false
      isBusy = true

      return true
    },
    // True when the timer should stop.
    end(isDenied: boolean): boolean {
      isBusy = false
      misses = isDenied ? misses + 1 : 0

      return misses >= maxMisses
    },
  }
}
