// The doge banner as pure functions: a pixel-art shiba face and a few bobbing phrases in
// the meme's voice ("wow", "such terminal", ...), sized to the band it is drawn into. A
// frame is a function of (width, rows, time). Cells are upper half blocks, two pixels
// per cell, so a band `rows` tall is `rows * 2` square pixels high.

import { encodeWords } from '../aurora-common/aurora'

export const MIN_ROWS = 7
export const MAX_ROWS = 28
export const PHRASE_STEP_MS = 650
export const PALETTE = [0xff4fd8, 0x39e6ff, 0xffe14d, 0x6dff6d, 0xff8a3d] as const
export const TOTAL_MS = 5200

const UPPER_HALF = 0x2580
const BG_TOP = 0x2a1f4d
const BG_BOTTOM = 0x120c26
const FUR = 0xd9a45b
const FUR_DARK = 0xb87f3a
const CREAM = 0xf7ead0
const MUZZLE = 0xfffaf0
const BLACK = 0x14110f
const BROW = 0x5a3a1c
const TONGUE = 0xff7a90
const EAR_INNER = 0xe8a79a
const HIGHLIGHT = 0xffffff

// Colours of the phrases, the meme's loud palette.
const PHRASE_COLORS = PALETTE

// 3 or 5 wide, 5 tall; '#' is lit. Only the letters the phrases use.
const FONT: Record<string, readonly string[]> = {
  a: ['.#.', '#.#', '###', '#.#', '#.#'],
  c: ['.##', '#..', '#..', '#..', '.##'],
  d: ['##.', '#.#', '#.#', '#.#', '##.'],
  e: ['###', '#..', '##.', '#..', '###'],
  h: ['#.#', '#.#', '###', '#.#', '#.#'],
  i: ['###', '.#.', '.#.', '.#.', '###'],
  l: ['#..', '#..', '#..', '#..', '###'],
  m: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  n: ['##.', '#.#', '#.#', '#.#', '#.#'],
  o: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  r: ['##.', '#.#', '##.', '#.#', '#.#'],
  s: ['.##', '#..', '.#.', '..#', '##.'],
  t: ['###', '.#.', '.#.', '.#.', '.#.'],
  u: ['#.#', '#.#', '#.#', '#.#', '###'],
  v: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  w: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
}
const GLYPH_H = 5

// The phrases, which side of the doge each sits on and how far down (a fraction of the
// band's free height). Left ones start at the left margin, right ones end at the right.
export const PHRASES = [
  { text: 'wow', side: 'left', y: 0.1 },
  { text: 'such terminal', side: 'right', y: 0.06 },
  { text: 'much claude', side: 'left', y: 0.66 },
  { text: 'very welcome', side: 'right', y: 0.44 },
  { text: 'so code', side: 'right', y: 0.82 },
] as const

export function textBitmap(text: string): boolean[][] {
  const bitmap: boolean[][] = Array.from({ length: GLYPH_H }, () => [])
  let isFirst = true

  for (const ch of text) {
    if (ch === ' ') {
      for (const row of bitmap) row.push(false, false, false)
      continue
    }
    const glyph = FONT[ch]
    if (glyph === undefined) continue
    for (let y = 0; y < GLYPH_H; y++) {
      const row = bitmap[y] as boolean[]
      if (!isFirst && row.length > 0 && row[row.length - 1] !== undefined) row.push(false)
      for (const px of glyph[y] as string) row.push(px === '#')
    }
    isFirst = false
  }

  return bitmap
}

type Placed = { x: number; y: number; w: number; h: number; scale: number; bits: boolean[][]; index: number; appearsAt: number }
type Scene = { width: number; height: number; cx: number; cy: number; r: number; phrases: Placed[] }

let cached: Scene | undefined

// Lays the scene out for a band `width` columns by `height` pixels: the doge is sized
// by the height and sits in the middle, each phrase that fits beside it is placed on its
// side, and one that would touch the face is left out.
export function sceneFor(width: number, height: number): Scene {
  if (cached !== undefined && cached.width === width && cached.height === height) return cached
  const scale = Math.max(1, Math.round(height / 26))
  const r = Math.min(height * 0.36, width * 0.2)
  const cx = width / 2
  const margin = Math.max(1, Math.round(width * 0.025))
  const phrases: Placed[] = []

  PHRASES.forEach((phrase, index) => {
    const bits = textBitmap(phrase.text)
    const w = (bits[0]?.length ?? 0) * scale
    const h = GLYPH_H * scale
    const x = phrase.side === 'left' ? margin : width - margin - w
    const y = Math.round(phrase.y * (height - h))
    const fits = phrase.side === 'left' ? x + w <= cx - r * 1.25 : x >= cx + r * 1.25
    if (!fits || x < 0 || x + w > width) return
    phrases.push({
      x,
      y,
      w,
      h,
      scale,
      bits,
      index,
      appearsAt: 350 + index * PHRASE_STEP_MS,
    })
  })

  cached = { width, height, cx, cy: height * 0.54, r, phrases }

  return cached
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry

  return dx * dx + dy * dy <= 1
}

function inTriangle(x: number, y: number, a: [number, number], b: [number, number], c: [number, number]): boolean {
  const side = (p: [number, number], q: [number, number]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1])
  const d1 = side(a, b)
  const d2 = side(b, c)
  const d3 = side(c, a)

  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

function mixColor(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k)

  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

// The face, at (x, y) in pixels; undefined off the doge. `bob` lifts it a pixel or two.
function dogePixel(x: number, y: number, scene: Scene, bob: number, blink: boolean): number | undefined {
  const { cx, r } = scene
  const cy = scene.cy + bob
  const u = (x - cx) / r
  const v = (y - cy) / r

  // Ears: fur with a pink inside.
  for (const side of [-1, 1] as const) {
    const outer = inTriangle(u, v, [side * 0.95, -0.45], [side * 0.62, -1.3], [side * 0.12, -0.85])
    if (outer) {
      const inner = inTriangle(u, v, [side * 0.78, -0.55], [side * 0.62, -1.02], [side * 0.34, -0.8])

      return inner ? EAR_INNER : FUR_DARK
    }
  }
  if (!inEllipse(u, v, 0, 0, 1.18, 0.98)) return undefined

  // Eyes (or a blink), brows, nose, mouth, tongue, then the muzzle and cheeks, then fur.
  for (const side of [-1, 1] as const) {
    if (inEllipse(u, v, side * 0.42, -0.14, 0.1, blink ? 0.025 : 0.1)) {
      return !blink && inEllipse(u, v, side * 0.45, -0.19, 0.035, 0.035) ? HIGHLIGHT : BLACK
    }
    // A slanting brow: the smug look.
    const bx = u - side * 0.42
    const by = v - (-0.36 - side * 0.04 + bx * side * -0.25)
    if (Math.abs(bx) < 0.2 && Math.abs(by) < 0.035) return BROW
  }
  if (inEllipse(u, v, 0, 0.16, 0.13, 0.09)) return BLACK
  if (Math.abs(u) < 0.2 && v > 0.27 && v < 0.31 && Math.abs(u) > 0.0) return BLACK
  if (Math.abs(u) < 0.035 && v > 0.22 && v < 0.34) return BLACK
  if (inEllipse(u, v, 0.06, 0.42, 0.1, 0.1) && v > 0.33) return TONGUE
  if (inEllipse(u, v, 0, 0.3, 0.36, 0.27)) return MUZZLE
  if (inEllipse(u, v, 0, 0.5, 0.92, 0.5)) return CREAM
  if (Math.abs(u) < 0.07 && v < -0.45 && v > -0.9) return CREAM
  // A little shading on the fur toward the edge.
  const edge = Math.min(1, (u * u) / 1.39 + (v * v) / 0.96)

  return mixColor(FUR, FUR_DARK, Math.max(0, edge - 0.6) * 1.5)
}

// One pixel of the banner.
export function pixelAt(x: number, y: number, ms: number, width: number, height: number): number {
  const scene = sceneFor(width, height)
  const bob = Math.round(Math.sin(ms / 380) * Math.max(1, height * 0.04))
  const blink = ms % 2300 > 2180

  const face = dogePixel(x, y, scene, bob, blink)
  if (face !== undefined) return face

  for (const phrase of scene.phrases) {
    if (ms < phrase.appearsAt) continue
    // A phrase bobs a pixel, each on its own beat, and cycles through the palette.
    const wobble = Math.round(Math.sin(ms / 260 + phrase.x) * (phrase.scale > 1 ? 1 : 0.4))
    const px = Math.floor((x - phrase.x) / phrase.scale)
    const py = Math.floor((y - phrase.y - wobble) / phrase.scale)
    if (px >= 0 && py >= 0 && py < GLYPH_H && phrase.bits[py]?.[px] === true && x < phrase.x + phrase.w) {
      if (ms - phrase.appearsAt < 300) return HIGHLIGHT
      // The meme's flashing: each phrase steps through the palette, on its own offset.
      return PHRASE_COLORS[(phrase.index + Math.floor(ms / 260)) % PHRASE_COLORS.length] as number
    }
  }

  return mixColor(BG_TOP, BG_BOTTOM, y / Math.max(1, height - 1))
}

// The banner's cells, `columns` wide and `rows` tall, as 32-bit words.
export function dogeWords(columns: number, rows: number, ms: number): number[] {
  if (columns < 1 || rows < 1) return []
  const words: number[] = []
  const height = rows * 2

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      words.push(UPPER_HALF, pixelAt(c, r * 2, ms, columns, height), pixelAt(c, r * 2 + 1, ms, columns, height))
    }
  }

  return words
}

export function dogeCells(columns: number, rows: number, ms: number): string {
  return encodeWords(dogeWords(columns, rows, ms))
}

// How tall the band may be: the engine's room less one row for the prompt's neighbour,
// within the sizes the scene is drawn for. Undefined when there is no room.
export function rowsFor(maxRows: number | undefined): number | undefined {
  if (maxRows === undefined || !Number.isFinite(maxRows)) return undefined
  const rows = Math.min(MAX_ROWS, Math.floor(maxRows) - 1)

  return rows >= MIN_ROWS ? rows : undefined
}
