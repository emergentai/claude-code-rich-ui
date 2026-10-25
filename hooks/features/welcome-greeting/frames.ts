// Frame bookkeeping for a Raster the plugin repaints with `$.ui.blit`: the frame rate, the
// window it needs, base64 for the cells, and the pacer. All pure: no `$`, no clock.

export const FRAME_MS = 80 // about 12.5 frames a second
export const MIN_COLUMNS = 50
export const MIN_ROWS = 24
export const MAX_MISSES = 25 // blits denied in a row before a timer gives up (about 2 s)

export type Size = { columns: number; rows: number }

// Whether a window can take the band: measured, at least `MIN_COLUMNS` wide and `MIN_ROWS`
// tall. Undefined when the stock UI should stay (no measurement, too narrow or too short).
export function bandSize(viewport: Partial<Size> | undefined): Size | undefined {
  const columns = viewport?.columns
  const rows = viewport?.rows
  if (columns === undefined || rows === undefined) return undefined
  if (!Number.isFinite(columns) || !Number.isFinite(rows)) return undefined
  if (columns < MIN_COLUMNS || rows < MIN_ROWS) return undefined

  return { columns: Math.floor(columns), rows: Math.floor(rows) }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Standard padded base64; the module has no Buffer.
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

// A Raster's `cells`: little-endian u32 words as base64.
export function encodeWords(words: readonly number[]): string {
  const bytes: number[] = []
  for (const word of words) bytes.push(word & 255, (word >>> 8) & 255, (word >>> 16) & 255, (word >>> 24) & 255)

  return encodeBase64(bytes)
}

// One frame in flight at a time (a host slower than a frame drops frames, nothing queues),
// and a run of denied blits (the Raster is gone) ends the timer.
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
