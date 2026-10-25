// The doge greeting as pure functions: one pixel-art shiba face in the middle of the band
// with "welcome" under it, over the terminal's own background, dissolving in and then
// gone. The face is a 20 by 21 pixel sprite from a supplied grid, scaled to the band by
// nearest neighbour. Cells are half blocks, two pixels
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

// The sprite: a 20 by 21 pixel shiba face from a supplied 32 by 32 pixel grid, the
// background cleared and the grid cropped to the face (tools/doge-sprite-from-csv.mjs
// makes this table). One string a row, six hex digits a pixel (RRGGBB), `......` where
// the terminal's own background shows.
const SPRITE_ROWS = [
  '........................e3d3bcbd9873dfc5a5..............................................................................',
  '........................e9d2a9c98d37ca914cddc3a3....................................c9a077a9805bb38f6d..................',
  '..................e7d4bbc19054f4c368cf8a34b3763ddec3a4........................c89f74d9a14ad2943abc7c30b08e6d............',
  '..................e2cbafb27939f1c26ed69037b06922ad6c31e6cdad............c89f75d9a24df1b750b67831ce8b359a6e48............',
  '..................e1cbaeb2752ed49e4dc3812feeb24bedb049d79743ca8a40b67533d28f39f4bf5ad99b42583a20db973cbb7a2fc09e7d......',
  '..................c07a2cebaa46edb557fbcf70f5bf5be09f40e9aa47f3b84ff4b950b87629cf943f6b4a284a301db0712dc17d2db9936e......',
  '............ddbc94d09647f8ca6bfbdc93fbdb92e2a54ae2a040f4bd5df4bc57f0b44df2b84fa16a26563418795127e2a141c5873dd6b997......',
  '............be7a31fbd989cda95dc2a463f3c879de9b3decb75ffadd9cf8d488ebb053efb24cf4bb53a7732cb47328e2a442a6754a............',
  '......d0a373edca8dc8ad6fa197845c5951c69042ebae4af7ce7bbda7766c624ab9944df3b952f3b951f4ba52c78b36b26f24b98553............',
  '......ab6d35fdeab7b8934c9e9d9a23211bc89943f5bd54dda74a88837bb0b0b124221dae863cf6c25efbdf9ef4ba54e7aa48bf792bc9a178......',
  'edd7b8c18f59fdedbefad689977132a98948f8c766f4bb55cf913a776d5d4f4f4f352b1ac2a05efce6aef9df9ff6c66bf3b951da9c3fc29362......',
  'd29d62f4dcaaf4e5bb978a6c9178479b8758e7cf94facf75f4ba53bd94497b6538c4a260fbe3a9fdecbdfdecbdfce8b4f7c970ebac48b16c21d1b494',
  'd7a165f5ddabe8dab3151618191c1f111213c3b895fde6abf8cc74f9d17dfbe09ffce5aefdecbefdecbefdedbefdedbef7cc77ebac48b36d22d2b494',
  'd6a064f4dcaac7b289625c4f0c0c0c474238dccda7ceb78cfbdf9df8d78cfae5b0fdedc0fdedbffdecbeefcc86f8dea0f5bc54ecae49ba7326d6b896',
  '......d39a57f2e3b7706552312c26786c58d1be94fbe9b8ead197ba9b63f0d28ef8e1aafbe8b6f6db9cf7dfa5fce8b3f1c36ddb9539dc9539b16f2c',
  '......d49c5ef8e3b2e1d1a666573f4e43327c6d4d8c7d5a735b33856d43e6c480efd08df4d897fbe6b2fdecbefadc9adf993bde983acf8932c28c54',
  '............c7853cfce9b5eacd8fb8965a9f7d43a3854dc2a76eebc984efd08cefd08cfae6b1fdedbef9e0a5f2b956e6a443dd993cbb8145ead7bd',
  '............ddb585e4bb7cfbe7b1f3d38fedc87eecc981ecc880ebc67defd08cf0d18df2d595fbeab8fbe6b1f1b654f1b34dd5933acba176......',
  '..................e5c194e3b97cfce9b7fae5aff5dda2eecd87eecc85eac378e6b969f6dea5fcecbcf8dfa4f2be61eaab48c68d4d............',
  '........................e3be8ee6bd7cf5d694e7b969e2ae59e2ae59dfa851ebc47cfceab9f8dfa3f4d692f9d88dbf7f39e9d5b9............',
  '..............................e0ba8acc8b3ddfa54bdea44adea44ae8ba69f4d48ff5d897fbe6b0......bb7e3d........................',
] as const

const SPRITE: (number | undefined)[][] = SPRITE_ROWS.map(row => {
  const pixels: (number | undefined)[] = []
  for (let i = 0; i < row.length; i += 6) {
    const hex = row.slice(i, i + 6)
    pixels.push(hex === '......' ? undefined : parseInt(hex, 16))
  }

  return pixels
})
const SPRITE_W = (SPRITE[0] ?? []).length
const SPRITE_H = SPRITE.length

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

// The face at (u, v) in its unit frame (nearest pixel), or undefined off it or where the
// terminal's own background shows.
export function facePixel(u: number, v: number): number | undefined {
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return undefined

  return SPRITE[Math.floor(v * SPRITE_H)]?.[Math.floor(u * SPRITE_W)]
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
  // A visible breath between the chin and the caption, a little more in a taller band.
  const gap = Math.max(3, Math.round(height / 12))
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
