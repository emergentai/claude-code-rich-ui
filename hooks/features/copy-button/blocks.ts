export type CodeBlock = {
  // The first word of the fence's info string, lower-cased; '' when there is none.
  language: string
  // The block's source as the reader would paste it: no fence lines, the fence's
  // indent taken off every line, blank lines at either end dropped, no final newline.
  text: string
  lines: number
}

// A one-line block this long is awkward to select with the mouse (it wraps), so it
// still gets a button; a shorter one is a triple-click.
export const LONG_LINE = 60
// A reply can hold many blocks; the row stops here so it stays one tidy row or two.
export const MAX_BLOCKS = 12

const OPEN = /^([ \t]*)(`{3,}|~{3,})(.*)$/

// Fenced blocks of a reply that deserve a copy button, in order. A fence that is
// never closed (a reply still streaming) gives nothing. Mermaid fences are the
// mermaid feature's: it draws them and has its own `show source` toggle.
export function copyableBlocks(text: string): CodeBlock[] {
  const lines = text.split('\n').map(line => line.replace(/\r$/, ''))
  const out: CodeBlock[] = []
  let at = -1
  let indent = ''
  let char = ''
  let length = 0
  let info = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (at < 0) {
      const match = OPEN.exec(line)
      if (!match) continue
      const rest = match[3] ?? ''
      // An info string with a backtick makes it inline code, not a fence.
      if ((match[2] ?? '').startsWith('`') && rest.includes('`')) continue
      at = i
      indent = match[1] ?? ''
      char = (match[2] ?? '').charAt(0)
      length = (match[2] ?? '').length
      info = rest.trim()
      continue
    }

    const closing = new RegExp(`^[ \\t]*${char}{${length},}[ \\t]*$`)
    if (!closing.test(line)) continue

    const language = (info.split(/\s+/)[0] ?? '').toLowerCase()
    const body = lines.slice(at + 1, i).map(l => (l.startsWith(indent) ? l.slice(indent.length) : l.trimStart()))
    while (body.length > 0 && (body[0] ?? '').trim() === '') body.shift()
    while (body.length > 0 && (body[body.length - 1] ?? '').trim() === '') body.pop()
    at = -1

    if (language === 'mermaid' || body.length === 0) continue
    if (body.length < 2 && (body[0] ?? '').length <= LONG_LINE) continue
    out.push({ language, text: body.join('\n'), lines: body.length })
  }

  return out.slice(0, MAX_BLOCKS)
}

export function labelFor(block: CodeBlock, index: number, count: number): string {
  if (count === 1) return 'copy code'

  return block.language === '' ? `copy ${index + 1}` : `copy ${index + 1} (${block.language})`
}

export function copiedToast(block: CodeBlock): string {
  return block.lines === 1 ? 'Copied 1 line' : `Copied ${block.lines} lines`
}
