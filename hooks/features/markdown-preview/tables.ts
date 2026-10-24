// The engine's Markdown sizes a table to the terminal, not to the pane, so in a
// narrow pane the borders wrap and the table breaks. Tables are drawn here as a
// code block sized to the pane instead; the rest of the file is left alone.

const SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/
const FENCE = /^\s*(```|~~~)/

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  return row.split(/(?<!\\)\|/).map(plain)
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
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word
    while (rest.length > width) {
      if (line) {
        lines.push(line)
        line = ''
      }
      lines.push(rest.slice(0, width))
      rest = rest.slice(width)
    }
    if (!line) line = rest
    else if (line.length + 1 + rest.length <= width) line += ` ${rest}`
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
    Math.max(...grid.map(r => (r[i] ?? '').length)),
  )
  // Per column: "│ " + cell + " " and one closing "│".
  const available = width - (columns * 3 + 1)
  const widths = fitWidths(natural, available)

  const rule = (left: string, mid: string, right: string) =>
    left + widths.map(w => '─'.repeat(w + 2)).join(mid) + right

  const out = [rule('┌', '┬', '┐')]
  grid.forEach((row, index) => {
    const cells = row.map((cell, i) => wrap(cell, widths[i] ?? 1))
    const height = Math.max(...cells.map(c => c.length))
    for (let l = 0; l < height; l++) {
      out.push('│' + cells.map((c, i) => ` ${(c[l] ?? '').padEnd(widths[i] ?? 0)} `).join('│') + '│')
    }
    if (index === 0 && grid.length > 1) out.push(rule('├', '┼', '┤'))
  })
  out.push(rule('└', '┴', '┘'))
  return out.join('\n')
}

export function fitTables(text: string, width: number): string {
  const lines = text.split('\n')
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
