export type DiagramKind = 'flowchart' | 'sequence' | 'state' | 'class' | 'er'

const HEADERS: Array<[RegExp, DiagramKind]> = [
  [/^(?:graph|flowchart)\b/, 'flowchart'],
  [/^sequenceDiagram\b/, 'sequence'],
  [/^stateDiagram(?:-v2)?\b/, 'state'],
  [/^classDiagram\b/, 'class'],
  [/^erDiagram\b/, 'er'],
]

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
      if (pattern.test(line)) return kind
    }

    return null
  }

  return null
}
