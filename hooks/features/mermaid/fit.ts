import { renderDiagram } from './render'
import type { DiagramResult } from './render'
import { diagramKind } from './sanity'

export const ROW_MARGIN = 6
export const COLUMN_MARGIN = 4

export type Viewport = { columns: number; rows: number }

function fitsViewport(diagram: DiagramResult, viewport: Viewport): boolean {
  return (
    diagram.width <= viewport.columns - COLUMN_MARGIN &&
    diagram.height <= viewport.rows - ROW_MARGIN
  )
}

const FLOW_HEADER =
  /^(\s*(?:graph|flowchart))(?:[ \t]+(TD|TB|BT|LR|RL))?(?=[ \t]*(?:;|$))/m

export function flipDirection(source: string): string | null {
  const match = FLOW_HEADER.exec(source)
  if (!match) return null
  const direction = match[2]
  const next = direction === 'LR' || direction === 'RL' ? 'TD' : 'LR'

  return source.replace(FLOW_HEADER, `${match[1]} ${next}`)
}

export function fitDiagram(
  source: string,
  viewport: Viewport,
  render: (source: string) => DiagramResult | null = renderDiagram,
): string[] | null {
  const kind = diagramKind(source)
  if (kind === null) return null

  const first = render(source)
  if (first && fitsViewport(first, viewport)) return first.lines
  if (kind !== 'flowchart') return null

  const flipped = flipDirection(source)
  const second = flipped ? render(flipped) : null

  return second && fitsViewport(second, viewport) ? second.lines : null
}
