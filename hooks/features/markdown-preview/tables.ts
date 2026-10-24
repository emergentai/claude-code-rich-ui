// The engine's Markdown sizes a table to the terminal, not to the pane, so in a
// narrow pane the borders wrap and the table breaks. Tables are drawn here as a
// code block sized to the pane instead; the rest of the file is left alone.

const SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/
const FENCE = /^\s*(```|~~~)/

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  // A pipe inside inline code or escaped does not end the cell.
  const cells: string[] = []
  let cell = ''
  let inCode = false
  for (let i = 0; i < row.length; i++) {
    const c = row[i] ?? ''
    if (c === '\\' && row[i + 1] === '|') {
      cell += '\\|'
      i++
    } else if (c === '`') {
      inCode = !inCode
      cell += c
    } else if (c === '|' && !inCode) {
      cells.push(cell)
      cell = ''
    } else cell += c
  }
  cells.push(cell)

  return cells.map(plain)
}

// Terminal cells a character takes: two for CJK and emoji, none for combining marks.
function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0
  if (code >= 0x300 && code <= 0x36f) return 0
  if (code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) return 0
  const isWide =
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x20000 && code <= 0x3fffd)

  return isWide ? 2 : 1
}

function cells(text: string): number {
  let n = 0
  for (const char of text) n += charWidth(char)

  return n
}

// The longest start of `text` that takes at most `width` cells.
function takeCells(text: string, width: number): string {
  let n = 0
  let out = ''
  for (const char of text) {
    const w = charWidth(char)
    if (n + w > width) break
    out += char
    n += w
  }

  return out
}

function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - cells(text)))
}

// A code block shows its text as written, so the markup a cell carries is dropped.
function plain(cell: string): string {
  return cell
    .trim()
    .replace(/\\\|/g, '|')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(?<![\w*])([*_])(.+?)\1(?![\w*])/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
}

function wrap(text: string, width: number): string[] {
  const size = Math.max(1, width)
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word
    while (cells(rest) > size) {
      if (line) {
        lines.push(line)
        line = ''
      }
      // One character wider than the column still goes out, or this never ends.
      const head = takeCells(rest, size) || [...rest][0] || ''
      lines.push(head)
      rest = rest.slice(head.length)
    }
    if (!line) line = rest
    else if (cells(line) + 1 + cells(rest) <= size) line += ` ${rest}`
    else {
      lines.push(line)
      line = rest
    }
  }
  lines.push(line)

  return lines
}

// Column widths that fit `available`: the widest column gives up a cell at a time.
function fitWidths(natural: number[], available: number): number[] {
  const widths = natural.map(w => Math.max(w, 1))
  const floor = 4
  let total = widths.reduce((a, b) => a + b, 0)
  while (total > available) {
    let widest = 0
    for (let i = 1; i < widths.length; i++) if ((widths[i] ?? 0) > (widths[widest] ?? 0)) widest = i
    if ((widths[widest] ?? 0) <= floor) break
    widths[widest] = (widths[widest] ?? 0) - 1
    total -= 1
  }
  return widths
}

export function drawTable(rows: string[][], width: number): string {
  const columns = Math.max(...rows.map(r => r.length))
  const grid = rows.map(r => Array.from({ length: columns }, (_, i) => r[i] ?? ''))
  const natural = Array.from({ length: columns }, (_, i) =>
    Math.max(...grid.map(r => cells(r[i] ?? ''))),
  )
  // Per column: "│ " + cell + " " and one closing "│".
  const available = width - (columns * 3 + 1)
  const widths = fitWidths(natural, available)

  const rule = (left: string, mid: string, right: string) =>
    left + widths.map(w => '─'.repeat(w + 2)).join(mid) + right

  const out = [rule('┌', '┬', '┐')]
  grid.forEach((row, index) => {
    const wrapped = row.map((cell, i) => wrap(cell, widths[i] ?? 1))
    const height = Math.max(...wrapped.map(c => c.length))
    for (let l = 0; l < height; l++) {
      out.push('│' + wrapped.map((c, i) => ` ${pad(c[l] ?? '', widths[i] ?? 0)} `).join('│') + '│')
    }
    if (index === 0 && grid.length > 1) out.push(rule('├', '┼', '┤'))
  })
  out.push(rule('└', '┴', '┘'))
  return out.join('\n')
}

export function fitTables(text: string, width: number): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const next = lines[i + 1] ?? ''
    if (FENCE.test(line)) inFence = !inFence
    const isTable =
      !inFence && line.includes('|') && SEPARATOR.test(next) && next.includes('-') && next.includes('|')
    if (!isTable) {
      out.push(line)
      continue
    }
    const rows = [splitRow(line)]
    let j = i + 2
    for (let row = lines[j]; row !== undefined && row.includes('|') && row.trim() !== ''; row = lines[j]) {
      rows.push(splitRow(row))
      j++
    }
    out.push('```text', drawTable(rows, width), '```')
    i = j - 1
  }
  return out.join('\n')
}
