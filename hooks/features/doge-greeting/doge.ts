// The doge greeting as pure functions: one shiba face, three-quarter view, in the middle
// of the band with "welcome" under it, over the terminal's own background, that dissolves
// away. The face is drawn from shapes in a unit frame (u across, v down, both 0 to 1), so
// it scales to any band; it is modelled on the well-known photo but is our own drawing.
// Cells are half blocks, two pixels per cell, so a band `rows` tall is `rows * 2` square
// pixels high.

import { encodeWords } from '../aurora-common/aurora'
import type { Tone } from '../aurora-common/aurora'

export const MIN_ROWS = 7
export const MAX_ROWS = 28
export const FADE_IN_MS = 450
export const HOLD_MS = 1800
export const FADE_OUT_MS = 1700
export const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const DEFAULT_COLOR = 0x01000000 // bit 24 alone: the terminal's own colour
export const CAPTION = 'welcome'

// The face's width over its height, as in the photo.
export const FACE_ASPECT = 0.76

const FUR = 0xe6b476
const FUR_WARM = 0xd9994f
const FUR_SHADE = 0xc58a45
const CREAM = 0xf8ecd6
const CREAM_SHADE = 0xe9d5b3
const EAR_INNER = 0xf0cfa0
const EAR_DARK = 0x6b4426
const NOSE = 0x121212
const MOUTH = 0x2c2724
const EYE = 0x1c1a17
const IRIS = 0x4a4a3c
const SCLERA = 0xeee6d6
const HIGHLIGHT = 0xffffff

// 3 or 5 wide, 5 tall; '#' is lit. Only the letters of the caption.
const FONT: Record<string, readonly string[]> = {
  w: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  e: ['###', '#..', '##.', '#..', '###'],
  l: ['#..', '#..', '#..', '#..', '###'],
  c: ['.##', '#..', '#..', '#..', '.##'],
  o: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  m: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
}
const GLYPH_H = 5

export function textBitmap(text: string): boolean[][] {
  const bitmap: boolean[][] = Array.from({ length: GLYPH_H }, () => [])
  let isFirst = true

  for (const ch of text) {
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

function inEllipse(u: number, v: number, cx: number, cy: number, rx: number, ry: number, power = 2): boolean {
  return Math.abs((u - cx) / rx) ** power + Math.abs((v - cy) / ry) ** power <= 1
}

function inTriangle(u: number, v: number, a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]): boolean {
  const side = (p: readonly [number, number], q: readonly [number, number]) => (u - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (v - q[1])
  const d1 = side(a, b)
  const d2 = side(b, c)
  const d3 = side(c, a)

  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

function mix(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k)

  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

// Distance from (u, v) to the segment a-b, in the unit frame.
function nearSegment(u: number, v: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)))

  return Math.hypot(u - (a[0] + t * dx), v - (a[1] + t * dy))
}

const EAR_LEFT = [[0.2, 0.25], [0.335, 0.03], [0.5, 0.2]] as const
const EAR_RIGHT = [[0.66, 0.2], [0.87, 0.07], [0.95, 0.36]] as const

// The face at (u, v), or undefined off it (the terminal's own background shows there).
export function facePixel(u: number, v: number): number | undefined {
  // Eyes first: a ring of white, an iris, a pupil, a highlight, looking away to the left.
  for (const [ex, ey, r] of [[0.262, 0.35, 0.052], [0.535, 0.4, 0.06]] as const) {
    if (inEllipse(u, v, ex, ey, r * 1.35, r * 1.35)) {
      if (inEllipse(u, v, ex - r * 0.28, ey - r * 0.42, r * 0.3, r * 0.3)) return HIGHLIGHT
      if (inEllipse(u, v, ex - r * 0.12, ey + r * 0.06, r * 0.62, r * 0.62)) return EYE
      if (inEllipse(u, v, ex - r * 0.05, ey + r * 0.04, r * 1.02, r * 1.02)) return IRIS

      return SCLERA
    }
  }
  // The nose and the dark mouth line with the lip under it.
  if (inEllipse(u, v, 0.225, 0.51, 0.068, 0.05)) return inEllipse(u, v, 0.205, 0.49, 0.02, 0.012) ? 0x555555 : NOSE
  if (nearSegment(u, v, [0.17, 0.61], [0.46, 0.64]) < 0.012) return MOUTH
  if (inEllipse(u, v, 0.31, 0.65, 0.15, 0.04) && v > 0.62) return MOUTH

  // The silhouette: ears, then a rounded head, wider and lower on the right.
  const inLeftEar = inTriangle(u, v, ...EAR_LEFT)
  const inRightEar = inTriangle(u, v, ...EAR_RIGHT)
  const inHead = inEllipse(u, v, 0.5, 0.57, 0.465, 0.35, 2.5)
  if (!inLeftEar && !inRightEar && !inHead) return undefined

  if (inRightEar && !inHead && inTriangle(u, v, [0.8, 0.15], [0.9, 0.12], [0.91, 0.3])) return EAR_DARK
  if (inRightEar && inTriangle(u, v, [0.78, 0.17], [0.88, 0.14], [0.89, 0.3])) return EAR_DARK
  if (inLeftEar && !inHead && inTriangle(u, v, [0.285, 0.22], [0.335, 0.09], [0.4, 0.21])) return EAR_INNER

  // Cream: the cheek on the right, the muzzle round the nose and chin, a patch beside the left eye.
  const cream =
    inEllipse(u, v, 0.7, 0.64, 0.27, 0.22) ||
    inEllipse(u, v, 0.34, 0.66, 0.26, 0.18) ||
    inEllipse(u, v, 0.15, 0.4, 0.06, 0.1) ||
    (v > 0.7 && inEllipse(u, v, 0.5, 0.74, 0.4, 0.14))
  if (cream) return v > 0.78 ? CREAM_SHADE : CREAM

  // Fur: warmer and darker toward the top and the ears, lighter low.
  const warmth = Math.max(0, Math.min(1, (0.6 - v) / 0.5))
  const base = mix(FUR, FUR_WARM, warmth * 0.9)
  const edge = Math.max(0, ((u - 0.5) / 0.465) ** 2 + ((v - 0.57) / 0.35) ** 2 - 0.62)

  return mix(base, FUR_SHADE, Math.min(1, edge * 1.1))
}

function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16

  return (h >>> 0) / 4294967296
}

// How much of the picture shows at `ms` (0 to 1): in, held, out.
export function visibleAt(ms: number): number {
  if (ms <= 0) return 0
  if (ms < FADE_IN_MS) return ms / FADE_IN_MS
  if (ms < FADE_IN_MS + HOLD_MS) return 1
  if (ms < TOTAL_MS) return 1 - (ms - FADE_IN_MS - HOLD_MS) / FADE_OUT_MS

  return 0
}

export type Layout = {
  width: number
  height: number
  faceX: number
  faceY: number
  faceW: number
  faceH: number
  textX: number
  textY: number
  scale: number
  bits: boolean[][]
}

let cached: Layout | undefined

// The face sized by the band's height (less the caption's row), centred; the caption
// centred under it. Pixels are square, so the face is `FACE_ASPECT` as wide as it is tall.
export function layoutFor(width: number, height: number): Layout {
  if (cached !== undefined && cached.width === width && cached.height === height) return cached
  const scale = Math.max(1, Math.round(height / 48))
  const bits = textBitmap(CAPTION)
  const textW = (bits[0]?.length ?? 0) * scale
  const textH = GLYPH_H * scale
  const gap = Math.max(1, scale)
  const faceH = Math.max(4, Math.min(height - textH - gap, Math.round(width / FACE_ASPECT)))
  const faceW = Math.round(faceH * FACE_ASPECT)
  const faceX = Math.round((width - faceW) / 2)
  cached = {
    width,
    height,
    faceX,
    faceY: 0,
    faceW,
    faceH,
    textX: Math.round((width - textW) / 2),
    textY: faceH + gap,
    scale,
    bits,
  }

  return cached
}

// The colour of the picture at a pixel, or undefined where the terminal shows through.
// `captionColor` suits the person's background.
export function sourcePixel(x: number, y: number, layout: Layout, captionColor: number): number | undefined {
  const u = (x - layout.faceX + 0.5) / layout.faceW
  const v = (y - layout.faceY + 0.5) / layout.faceH
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    const face = facePixel(u, v)
    if (face !== undefined) return face
  }
  const tx = Math.floor((x - layout.textX) / layout.scale)
  const ty = Math.floor((y - layout.textY) / layout.scale)
  if (tx >= 0 && ty >= 0 && layout.bits[ty]?.[tx] === true) return captionColor

  return undefined
}

// The caption's colour for a theme: light on dark, dark on light, a mid grey where the
// background is unknown (`auto`), which reads on either.
export function captionColorFor(tone: Tone): number {
  return tone === 'dark' ? 0xeeeeee : tone === 'light' ? 0x1e1e1e : 0x8c8c8c
}

// The banner's cells at `ms`, `columns` wide and `rows` tall, as 32-bit words. Pixels
// that are not part of the picture, or have dissolved, leave the terminal's own colours.
export function dogeWords(columns: number, rows: number, ms: number, tone: Tone = 'neutral'): number[] {
  if (columns < 1 || rows < 1) return []
  const layout = layoutFor(columns, rows * 2)
  const captionColor = captionColorFor(tone)
  const shown = visibleAt(ms)
  const words: number[] = []
  const pixel = (x: number, y: number) => (hash01(x, y) < shown ? sourcePixel(x, y, layout, captionColor) : undefined)

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

export function dogeCells(columns: number, rows: number, ms: number, tone: Tone = 'neutral'): string {
  return encodeWords(dogeWords(columns, rows, ms, tone))
}

// How tall the band may be: the engine's room less one row, within the sizes the picture
// is drawn for. Undefined when there is no room.
export function rowsFor(maxRows: number | undefined): number | undefined {
  if (maxRows === undefined || !Number.isFinite(maxRows)) return undefined
  const rows = Math.min(MAX_ROWS, Math.floor(maxRows) - 1)

  return rows >= MIN_ROWS ? rows : undefined
}
