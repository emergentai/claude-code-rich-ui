// The nyan banner as pure functions: a pixel-art cat flying left to right across a
// starry sky, a rainbow streaming behind it. A frame is a function of (width, time), so
// it is testable without the engine. Cells are upper half blocks, two pixels per cell.

import { encodeWords } from '../aurora-common/aurora'

export const BANNER_ROWS = 7
export const PIXEL_ROWS = BANNER_ROWS * 2
export const CAT_W = 24
export const CAT_H = 14
// The cat takes this long to cross the window, whatever its width, and the banner
// stays on a moment after it has gone.
export const FLIGHT_MS = 4000
export const HOLD_MS = 300
export const TOTAL_MS = FLIGHT_MS + HOLD_MS

const UPPER_HALF = 0x2580
const SKY = 0x003366
const STAR = 0xffffff
const STAR_DIM = 0x4d79a6
const RAINBOW = [0xff0000, 0xff9900, 0xffff00, 0x33ff00, 0x0099ff, 0x6633ff] as const
const STRIPE_H = 2

const BLACK = 0x000000
const TAN = 0xffcc99
const PINK = 0xff99ff
const SPRINKLE = 0xff3399
const GRAY = 0x999999
const CHEEK = 0xff9999

type Canvas = (number | undefined)[][]

function blank(): Canvas {
  return Array.from({ length: CAT_H }, () => Array.from({ length: CAT_W }, () => undefined))
}

function rect(canvas: Canvas, x0: number, y0: number, x1: number, y1: number, color: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) (canvas[y] as Canvas[number])[x] = color
}

function dot(canvas: Canvas, x: number, y: number, color: number | undefined) {
  ;(canvas[y] as Canvas[number])[x] = color
}

// The cat, `CAT_W` by `CAT_H`, in one of two walking frames (feet and tail move).
export function catSprite(frame: number): Canvas {
  const c = blank()
  const step = ((frame % 2) + 2) % 2 // 0 or 1, for a negative frame too
  // The pop-tart: black outline, tan crust, pink filling, dark pink sprinkles.
  rect(c, 2, 1, 15, 12, BLACK)
  rect(c, 3, 2, 14, 11, TAN)
  rect(c, 4, 3, 13, 10, PINK)
  for (const [x, y] of [[6, 4], [10, 4], [8, 6], [12, 7], [5, 8], [9, 9]] as const) dot(c, x, y, SPRINKLE)
  for (const [x, y] of [[2, 1], [15, 1], [2, 12], [15, 12]] as const) dot(c, x, y, undefined)
  // The head: outline, grey face, two ears, eyes, cheeks, mouth.
  rect(c, 13, 4, 23, 11, BLACK)
  rect(c, 14, 5, 22, 10, GRAY)
  rect(c, 14, 2, 15, 4, BLACK)
  rect(c, 21, 2, 22, 4, BLACK)
  rect(c, 14, 3, 15, 4, GRAY)
  rect(c, 21, 3, 22, 4, GRAY)
  dot(c, 16, 7, BLACK)
  dot(c, 20, 7, BLACK)
  dot(c, 15, 9, CHEEK)
  dot(c, 21, 9, CHEEK)
  rect(c, 17, 9, 19, 9, BLACK)
  // The tail, wagging.
  rect(c, 0, 6 + step, 2, 8 + step, GRAY)
  // Four feet, the pairs taking turns.
  for (const [x, lift] of [[4, step], [9, 1 - step], [16, step], [20, 1 - step]] as const) {
    rect(c, x, 12, x + 2, 13 - lift, BLACK)
    rect(c, x + 1, 12, x + 1, 12, GRAY)
  }

  return c
}

// Built once: a pixel lookup must not redraw the cat.
const SPRITES = [catSprite(0), catSprite(1)] as const

// Where the cat's left edge is at `ms` into the flight, for a banner `width` pixels wide:
// it starts fully off the left edge and ends fully off the right.
export function catX(ms: number, width: number): number {
  const p = Math.max(0, Math.min(1, ms / FLIGHT_MS))

  return Math.round(-CAT_W + (width + CAT_W) * p)
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16

  return h >>> 0
}

// One pixel of the banner (the cat, the rainbow under it, a star or the sky).
export function pixelAt(x: number, y: number, ms: number, width: number): number {
  const frame = Math.floor(ms / 120)
  const left = catX(ms, width)
  const sprite = SPRITES[((frame % 2) + 2) % 2] as Canvas

  const inCat = x >= left && x < left + CAT_W
  const own = inCat ? sprite[y]?.[x - left] : undefined
  if (own !== undefined) return own

  // The rainbow runs from the left edge to inside the cat's body, bending a pixel every
  // three columns, the bend anchored to the cat so it streams with it.
  if (x < left + 8) {
    const bend = Math.abs(Math.floor((left - x) / 3)) % 2
    const stripe = Math.floor((y - 1 - bend) / STRIPE_H)
    if (stripe >= 0 && stripe < RAINBOW.length) return RAINBOW[stripe] as number
  }

  const h = hash(x, y)
  if (h % 41 === 0) return (h >>> 8) % 4 === frame % 4 ? STAR_DIM : STAR

  return SKY
}

// The banner's cells, `columns` wide and `BANNER_ROWS` tall, as 32-bit words.
export function nyanWords(columns: number, ms: number): number[] {
  if (columns < 1) return []
  const words: number[] = []

  for (let r = 0; r < BANNER_ROWS; r++) {
    for (let c = 0; c < columns; c++) {
      words.push(UPPER_HALF, pixelAt(c, r * 2, ms, columns), pixelAt(c, r * 2 + 1, ms, columns))
    }
  }

  return words
}

export function nyanCells(columns: number, ms: number): string {
  return encodeWords(nyanWords(columns, ms))
}
