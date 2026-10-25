// Raster cells for the features that draw one. Pure: no `$`, no engine.

// `0x01000000` (bit 24 alone) asks for the terminal's own colour.
export const DEFAULT_COLOR = 0x01000000

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Standard padded base64; the module has no Buffer.
export function toBase64(bytes: Uint8Array): string {
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c

    out += ALPHABET[(n >> 18) & 63]
    out += ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '='
  }

  return out
}

export type Cell = { code: number; fg: number; bg?: number }

// A Raster's `cells` prop: little-endian u32 triplets [code point, foreground,
// background], row by row.
export function packCells(cells: readonly Cell[]): string {
  const bytes = new Uint8Array(cells.length * 12)
  let o = 0

  const put = (word: number) => {
    bytes[o++] = word & 255
    bytes[o++] = (word >>> 8) & 255
    bytes[o++] = (word >>> 16) & 255
    bytes[o++] = (word >>> 24) & 255
  }

  for (const cell of cells) {
    put(cell.code)
    put(cell.fg)
    put(cell.bg ?? DEFAULT_COLOR)
  }

  return toBase64(bytes)
}
