export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mermaid'; source: string; raw: string }

type OpenFence = {
  char: string
  length: number
  at: number
  isMermaid: boolean
}

const OPEN = /^(`{3,}|~{3,})(.*)$/

function pushText(out: Segment[], lines: string[], from: number, to: number) {
  const text = lines.slice(from, to).join('\n')
  if (text.trim() !== '') out.push({ kind: 'text', text })
}

export function splitReply(text: string): Segment[] {
  const lines = text.split('\n')
  const out: Segment[] = []
  let textStart = 0
  let open: OpenFence | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (open === null) {
      const match = OPEN.exec(line)
      if (match) {
        const fence = match[1] ?? ''
        open = {
          char: fence.charAt(0),
          length: fence.length,
          at: i,
          isMermaid: (match[2] ?? '').trim().toLowerCase() === 'mermaid',
        }
      }
      continue
    }

    const closing = new RegExp(`^${open.char}{${open.length},}[ \\t]*$`)
    if (!closing.test(line)) continue

    if (open.isMermaid) {
      pushText(out, lines, textStart, open.at)
      out.push({
        kind: 'mermaid',
        source: lines.slice(open.at + 1, i).join('\n'),
        raw: lines.slice(open.at, i + 1).join('\n'),
      })
      textStart = i + 1
    }
    open = null
  }
  pushText(out, lines, textStart, lines.length)

  return out
}
