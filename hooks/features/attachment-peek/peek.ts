import type { PeekItem, PeekTag } from '../../../types'

// Pure helpers for the attachment peek: reading the engine's tags out of a draft, sizing a
// picture to cells, and the words under a card.

// A terminal cell is a little under twice as tall as it is wide (1.75 to 2 in the usual fonts).
export const CELL_ASPECT = 1.8
export const MIN_COLUMNS = 4

// The engine writes "[Image #3]" for a drop or an image paste. The numbers run up through a
// session (a long text paste, "[Pasted text #4 +12 lines]", takes one too, and is left alone).
const TAG = /\[Image #(\d+)\]/g

export const idOf = (thing: { n: number }) => `i${thing.n}`

// The tags a draft holds, each once, in the order they first stand.
export function tagsIn(draft: string): PeekTag[] {
  const seen = new Set<string>()
  const tags: PeekTag[] = []
  for (const match of draft.matchAll(TAG)) {
    const tag: PeekTag = { kind: 'image', n: Number(match[1]) }
    if (seen.has(idOf(tag))) continue
    seen.add(idOf(tag))
    tags.push(tag)
  }

  return tags
}

export const sameTags = (a: readonly PeekTag[], b: readonly PeekTag[]) =>
  a.length === b.length && a.every((tag, i) => idOf(tag) === idOf(b[i]!))

export type Cells = { columns: number; rows: number }

// The cells of a picture box that keeps the picture's shape: `maxRows` tall unless that
// would pass `maxColumns` wide. A picture of unknown size is taken as 16 by 10.
export function fitCells(width: number, height: number, maxRows: number, maxColumns: number): Cells {
  const w = width > 0 && height > 0 ? width : 16
  const h = width > 0 && height > 0 ? height : 10
  let rows = Math.max(1, maxRows)
  let columns = Math.round((rows * CELL_ASPECT * w) / h)
  if (columns > maxColumns) {
    columns = Math.max(MIN_COLUMNS, maxColumns)
    rows = Math.max(1, Math.round((columns * h) / (CELL_ASPECT * w)))
  }

  return { columns: Math.max(MIN_COLUMNS, columns), rows: Math.min(rows, Math.max(1, maxRows)) }
}

// Width and height from a PNG's first bytes (the IHDR chunk), given as base64; undefined for
// anything that is not a PNG.
export function pngSize(base64: string): { width: number; height: number } | undefined {
  let head: Uint8Array
  try {
    // 32 base64 characters decode to exactly the 24 bytes of signature and IHDR's size.
    head = Uint8Array.from(atob(base64.slice(0, 32)), char => char.charCodeAt(0))
  } catch {
    return undefined
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (head.length < 24 || signature.some((byte, i) => head[i] !== byte)) return undefined
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)

  return width > 0 && height > 0 ? { width, height } : undefined
}

// The line under a tile's picture: its tag's number.
export const tileCaptionOf = (item: PeekItem) => `#${item.n}`
