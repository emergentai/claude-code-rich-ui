import { expect, test } from 'claude-code/testing'

import {
  BANNER_ROWS,
  CAT_H,
  CAT_W,
  FLIGHT_MS,
  PIXEL_ROWS,
  TOTAL_MS,
  catSprite,
  catX,
  nyanCells,
  nyanWords,
  pixelAt,
} from './nyan'

const RAINBOW = [0xff0000, 0xff9900, 0xffff00, 0x33ff00, 0x0099ff, 0x6633ff]
const SKY_COLORS = [0x003366, 0xffffff, 0x4d79a6]

test('the sprite is CAT_W by CAT_H and has real pixels in a few colours', () => {
  const sprite = catSprite(0)

  expect(sprite).toHaveLength(CAT_H)
  expect(sprite.every(row => row.length === CAT_W)).toBe(true)
  const colors = new Set(sprite.flat().filter(c => c !== undefined))
  expect(colors.has(0x000000)).toBe(true) // outline
  expect(colors.has(0xff99ff)).toBe(true) // filling
  expect(colors.has(0x999999)).toBe(true) // face
  expect(colors.size).toBeGreaterThanOrEqual(6)
  for (const c of colors) expect(c as number).toBeLessThanOrEqual(0xffffff)
})

test('the two walking frames differ and repeat', () => {
  expect(catSprite(0)).not.toEqual(catSprite(1))
  expect(catSprite(0)).toEqual(catSprite(2))
  expect(catSprite(1)).toEqual(catSprite(7))
})

test('the cat starts off the left edge, ends off the right, and never goes backwards', () => {
  expect(catX(0, 100)).toBe(-CAT_W)
  expect(catX(FLIGHT_MS, 100)).toBe(100)
  expect(catX(-500, 100)).toBe(-CAT_W)
  expect(catX(FLIGHT_MS * 9, 100)).toBe(100)
  let last = -Infinity
  for (let ms = 0; ms <= FLIGHT_MS; ms += 100) {
    const x = catX(ms, 100)
    expect(x).toBeGreaterThanOrEqual(last)
    last = x
  }
})

test('the flight takes the same time in any window, faster per column in a wide one', () => {
  expect(catX(FLIGHT_MS / 2, 80)).toBe(Math.round(-CAT_W + (80 + CAT_W) / 2))
  expect(catX(FLIGHT_MS / 2, 400)).toBeGreaterThan(catX(FLIGHT_MS / 2, 80))
})

test('before the cat enters there is only sky and stars', () => {
  for (let y = 0; y < PIXEL_ROWS; y++) {
    for (let x = 0; x < 120; x++) expect(SKY_COLORS).toContain(pixelAt(x, y, 0, 120))
  }
})

test('the rainbow streams from the left edge to the cat and not past it', () => {
  const width = 120
  const ms = FLIGHT_MS / 2
  const left = catX(ms, width)
  const rowColors = (x: number) => Array.from({ length: PIXEL_ROWS }, (_, y) => pixelAt(x, y, ms, width))

  // Left of the cat, every column carries all six stripes.
  for (const x of [0, 3, 10, left - 12]) {
    const colors = rowColors(x)
    for (const stripe of RAINBOW) expect(colors).toContain(stripe)
  }
  // Right of the cat there is no rainbow.
  for (let x = left + CAT_W; x < width; x++) {
    for (const c of rowColors(x)) expect(RAINBOW).not.toContain(c)
  }
})

test('the stripes keep their order top to bottom', () => {
  const width = 100
  const ms = 3000
  const column = Array.from({ length: PIXEL_ROWS }, (_, y) => pixelAt(5, y, ms, width))
  const order = column.filter(c => RAINBOW.includes(c)).filter((c, i, all) => all.indexOf(c) === i)

  expect(order).toEqual(RAINBOW)
})

test('the cat is drawn over the rainbow, and its pixels move with the clock', () => {
  const width = 100
  const left = catX(2000, width)
  const pixels = Array.from({ length: CAT_W }, (_, dx) =>
    Array.from({ length: CAT_H }, (_, y) => pixelAt(left + dx, y, 2000, width)),
  ).flat()

  expect(pixels).toContain(0xff99ff)
  expect(pixels).toContain(0x000000)
  expect(pixelAt(left + 10, 5, 2000, width)).not.toBe(pixelAt(left + 10, 5, 2000 + 600, width))
})

test('once the cat has left, the rainbow fills the whole width', () => {
  const width = 90
  for (let x = 0; x < width; x++) {
    const colors = Array.from({ length: PIXEL_ROWS }, (_, y) => pixelAt(x, y, FLIGHT_MS, width))
    expect(colors.filter(c => RAINBOW.includes(c)).length).toBeGreaterThanOrEqual(10)
  }
})

test('stars are sparse and twinkle', () => {
  const width = 200
  const count = (ms: number) => {
    let n = 0
    for (let y = 0; y < PIXEL_ROWS; y++) for (let x = 0; x < width; x++) if (pixelAt(x, y, ms, width) === 0xffffff) n += 1
    return n
  }

  expect(count(0)).toBeGreaterThan(0)
  expect(count(0)).toBeLessThan(width * PIXEL_ROWS * 0.06)
  expect(nyanWords(width, 0)).not.toEqual(nyanWords(width, 120))
})

test('the banner is columns x rows x 3 words of upper half blocks with real colours', () => {
  const words = nyanWords(60, 1500)

  expect(words).toHaveLength(60 * BANNER_ROWS * 3)
  for (let i = 0; i < words.length; i += 3) {
    expect(words[i]).toBe(0x2580)
    expect(words[i + 1]).toBeLessThanOrEqual(0xffffff)
    expect(words[i + 2]).toBeLessThanOrEqual(0xffffff)
  }
})

test('cells are padded base64 of the right size, and a frame is pure', () => {
  const cells = nyanCells(50, 900)
  const bytes = (cells.length / 4) * 3 - (cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0)

  expect(bytes).toBe(50 * BANNER_ROWS * 12)
  expect(nyanCells(50, 900)).toBe(cells)
})

test('tiny and huge windows do not throw', () => {
  expect(nyanWords(0, 100)).toEqual([])
  expect(nyanWords(1, 100)).toHaveLength(BANNER_ROWS * 3)
  expect(nyanWords(400, TOTAL_MS)).toHaveLength(400 * BANNER_ROWS * 3)
  expect(nyanWords(40, -50)).toHaveLength(40 * BANNER_ROWS * 3)
})
