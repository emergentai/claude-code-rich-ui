// The pane's header banner: "rich-ui" in half-block pixel type with a soft
// gradient, as the cells of a Raster (terminal only). Pure: no `$`, no engine.

import { DEFAULT_COLOR, toBase64 } from '../core/raster'

export { toBase64 }

// Each glyph is six pixel rows (three terminal rows of half blocks); '#' is lit.
const GLYPHS: Record<string, string[]> = {
  r: ['...', '...', '###', '#..', '#..', '#..'],
  i: ['#', '.', '#', '#', '#', '#'],
  c: ['...', '...', '###', '#..', '#..', '###'],
  h: ['#..', '#..', '##.', '#.#', '#.#', '#.#'],
  '-': ['...', '...', '...', '###', '...', '...'],
  u: ['...', '...', '#.#', '#.#', '#.#', '###'],
}

const WORD = 'rich-ui'
const PIXEL_ROWS = 6

// Raw colours: a Raster is the one place the pane may leave the theme keys. The
// ends are mid-tone so the word reads on a light and a dark background.
const FROM = [0xe0, 0x7a, 0x4f]
const TO = [0x8a, 0x7a, 0xe8]

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const FULL = 0x2588
const SPACE = 0x20

// Lit pixels of the word, one string per pixel row, letters one column apart.
const PIXELS: string[] = Array.from({ length: PIXEL_ROWS }, (_, row) =>
  [...WORD].map(letter => GLYPHS[letter]![row]).join('.'),
)

export const BANNER_COLUMNS = PIXELS[0]!.length
export const BANNER_ROWS = PIXEL_ROWS / 2

// The gradient colour of one column, left to right.
export function gradientAt(column: number): number {
  const t = BANNER_COLUMNS > 1 ? column / (BANNER_COLUMNS - 1) : 0
  const [r, g, b] = FROM.map((from, i) => Math.round(from + (TO[i]! - from) * t))

  return (r! << 16) | (g! << 8) | b!
}

// A cell is a lower half, an upper half, a full block or empty, so no cell
// needs a background colour and the terminal's own shows through.
export function bannerCells(): string {
  const bytes = new Uint8Array(BANNER_COLUMNS * BANNER_ROWS * 12)
  let o = 0

  const put = (word: number) => {
    bytes[o++] = word & 255
    bytes[o++] = (word >>> 8) & 255
    bytes[o++] = (word >>> 16) & 255
    bytes[o++] = (word >>> 24) & 255
  }

  for (let row = 0; row < BANNER_ROWS; row++) {
    for (let column = 0; column < BANNER_COLUMNS; column++) {
      const top = PIXELS[row * 2]![column] === '#'
      const bottom = PIXELS[row * 2 + 1]![column] === '#'

      put(top && bottom ? FULL : top ? UPPER_HALF : bottom ? LOWER_HALF : SPACE)
      put(top || bottom ? gradientAt(column) : DEFAULT_COLOR)
      put(DEFAULT_COLOR)
    }
  }

  return toBase64(bytes)
}
