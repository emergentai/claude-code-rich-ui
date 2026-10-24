import { renderMermaidAscii } from '../../vendor/zombie-mermaid.js'
import { diagramKind } from './sanity'

// With a row of padding the start marker of a state diagram is drawn over and
// lost; two rows keep it.
const STATE_PADDING_Y = 2

export type DiagramResult = {
  kind: 'text'
  lines: string[]
  width: number
  height: number
}

// Image output would be a second variant of DiagramResult; the rest of the
// feature only reads lines, width and height from the text variant.
export function renderDiagram(source: string): DiagramResult | null {
  try {
    const raw = renderMermaidAscii(source, {
      useAscii: false,
      colorMode: 'none',
      paddingY: diagramKind(source) === 'state' ? STATE_PADDING_Y : 1,
    })
    const lines = raw.split('\n').map(line => line.replace(/\s+$/, ''))
    while (lines.length > 0 && lines[0] === '') lines.shift()
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    if (!lines.some(line => line.trim() !== '')) return null

    return {
      kind: 'text',
      lines,
      width: Math.max(...lines.map(line => line.length)),
      height: lines.length,
    }
  } catch {
    return null
  }
}
