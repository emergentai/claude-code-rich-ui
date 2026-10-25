// The doge greeting as pure functions: one pixel-art shiba face in the middle of the band
// with "welcome" under it, over the terminal's own background, dissolving in and then
// gone. The face is a hand-drawn 28 by 27 sprite (our own drawing, after a pixel-art
// reference), scaled to the band by nearest neighbour. Cells are half blocks, two pixels
// per cell, so a band `rows` tall is `rows * 2` square pixels high.

import { encodeWords } from '../aurora-common/aurora'
import type { Tone } from '../aurora-common/aurora'

export const MIN_ROWS = 7
export const MAX_ROWS = 28
export const FADE_IN_MS = 450
export const HOLD_MS = 2500
// It dissolves in, stays, and is then simply gone: no fade out.
export const TOTAL_MS = FADE_IN_MS + HOLD_MS

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const DEFAULT_COLOR = 0x01000000 // bit 24 alone: the terminal's own colour
export const CAPTION = 'welcome'

// The sprite, one character a pixel: . clear, T tan, L light tan, D dark tan, E ear tan,
// B brown, C cream, W bright cream, K black, H white, S shade.
const SPRITE = [
  '..........E..........E......',
  '.........EEE........EEE.....',
  '.........ETEE......EETEE....',
  '.........ETTTE....EETTTE....',
  '........LLTTTTTTTTTTTTTTE...',
  '.......LLLLLTTTTTTTTTTTTTEE.',
  '......LLLLLLLTTTTTTTTTBBBTT.',
  '.....LLTTTTTTTTTTTTTTTBBBTTT',
  '....LTTTTTTTLTTTTTTTTTTTTTTD',
  '...WWTTKKTTTTTTTTTTTTTTTTTDD',
  '..WWWWTKHKTTTHKKTTTTTTTTTTTD',
  '..WWWWWTTTTTTTKKKTTTTTTTTTDD',
  '..WWWTTKKKKTTTTCCCCCCCTTTTDD',
  '..TTWTKKKKCCCTCCCCCCCCCCCTDD',
  '..TTTTTKKCCCCCCCCCCCCCCCCCDD',
  '..TTTTTKKCCCCCCCCCCCCCCCCCDD',
  '..TTTTTKKCCCCCCCCCCCCCCCCTDD',
  '..TTTTTKKKKKKKKTCCCCCCCCTTDD',
  '..TTTTTTTTTTTTTCCCCCCCCCTTDD',
  '...TTTTTTTTTTTTTCCCCCCCCTTTD',
  '...STTTTTTTTTTTTTCCCCCCTTTD.',
  '....SSSSSSSSTTTSSSSTTTTTTDD.',
  '.....TTTTTTTTTTTSSSSTTTTDD..',
  '.....TTTTTTTTTTTTTTTTTTD....',
  '......TTTTTTTTTTTTTTTTD.....',
  '.......SSSSSSSSSSSSSSS......',
  '.........SSSSSSSSSSS........',
] as const
const SPRITE_W = 28
const SPRITE_H = SPRITE.length

const COLORS: Record<string, number> = {
  T: 0xd8b06a,
  L: 0xe8c887,
  D: 0xb88f4c,
  E: 0xc89a52,
  B: 0x8a5a2c,
  C: 0xd8cfa0,
  W: 0xf6f0d2,
  K: 0x0e0e0e,
  H: 0xffffff,
  S: 0xc9a768,
}

// The face's width over its height.
export const FACE_ASPECT = SPRITE_W / SPRITE_H

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

// The face at (u, v) in its unit frame, or undefined off it (the terminal's own
// background shows there).
export function facePixel(u: number, v: number): number | undefined {
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return undefined
  const row = SPRITE[Math.floor(v * SPRITE_H)] as string
  const color = COLORS[row[Math.floor(u * SPRITE_W)] as string]

  return color
}

function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16

  return (h >>> 0) / 4294967296
}

// How much of the picture shows at `ms` (0 to 1): dissolving in, then everything, then
// nothing at all once the show is over.
export function visibleAt(ms: number): number {
  if (ms <= 0) return 0
  if (ms < FADE_IN_MS) return ms / FADE_IN_MS
  if (ms < TOTAL_MS) return 1

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
