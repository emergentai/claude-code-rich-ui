export type DiagramKind =
  | 'flowchart'
  | 'sequence'
  | 'state'
  | 'class'
  | 'er'
  | 'xychart'
  | 'pie'
  | 'c4'
  | 'architecture'

const HEADERS: Array<[RegExp, DiagramKind]> = [
  [/^(?:graph|flowchart)\b/, 'flowchart'],
  [/^sequenceDiagram\b/, 'sequence'],
  [/^stateDiagram(?:-v2)?\b/, 'state'],
  [/^classDiagram\b/, 'class'],
  [/^erDiagram\b/, 'er'],
  [/^xychart(?:-beta)?\b/, 'xychart'],
  [/^pie\b/, 'pie'],
  [/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/, 'c4'],
  [/^architecture(?:-beta)?\b/, 'architecture'],
]

// These renderers draw something (a title, an empty bar) for a header with no
// content, so the body must hold at least one statement of the kind's own.
const CONTENT: Partial<Record<DiagramKind, RegExp>> = {
  pie: /^"[^"]*"\s*:/,
  c4: /^[A-Za-z_]\w*\s*\(/,
  architecture: /^(?:service|group|junction)\b/,
}

export function diagramKind(source: string): DiagramKind | null {
  const lines = source.split('\n')
  let i = 0

  while (i < lines.length && (lines[i] ?? '').trim() === '') i++
  if ((lines[i] ?? '').trim() === '---') {
    i++
    while (i < lines.length && (lines[i] ?? '').trim() !== '---') i++
    i++
  }

  for (; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (line === '' || line.startsWith('%%')) continue
    for (const [pattern, kind] of HEADERS) {
      if (pattern.test(line)) return hasContent(lines.slice(i + 1), kind) ? kind : null
    }

    return null
  }

  return null
}

function hasContent(body: string[], kind: DiagramKind): boolean {
  const content = CONTENT[kind]
  if (!content) return true

  return body.some(line => content.test(line.trim()))
}
