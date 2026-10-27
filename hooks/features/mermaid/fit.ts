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

// Drawing is synchronous and can take seconds for a big diagram, and the engine
// asks again on every redraw, so a result (including "does not fit") is kept
// per source and window size.
const CACHE_LIMIT = 64
const cache = new Map<string, FitOutcome>()

// 'too-small' means the diagram drew fine but not within the window; null means
// it cannot be drawn at all.
export type FitOutcome = string[] | 'too-small' | null

export function fitOutcome(
  source: string,
  viewport: Viewport,
  render: (source: string) => DiagramResult | null = renderDiagram,
): FitOutcome {
  if (render !== renderDiagram) return computeFit(source, viewport, render)

  const key = `${viewport.columns}x${viewport.rows}\n${source}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const outcome = computeFit(source, viewport, render)
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
  cache.set(key, outcome)

  return outcome
}

export function fitDiagram(
  source: string,
  viewport: Viewport,
  render: (source: string) => DiagramResult | null = renderDiagram,
): string[] | null {
  const outcome = fitOutcome(source, viewport, render)

  return outcome === 'too-small' ? null : outcome
}

function computeFit(
  source: string,
  viewport: Viewport,
  render: (source: string) => DiagramResult | null,
): FitOutcome {
  const kind = diagramKind(source)
  if (kind === null) return null

  const first = render(source)
  if (first === null) return null
  if (fitsViewport(first, viewport)) return first.lines
  if (kind !== 'flowchart') return 'too-small'
  // Turning a diagram sideways trades height for width. When it is already too
  // wide and too tall that cannot rescue it, and the second drawing of a large
  // flowchart is the slow one (seconds), so do not pay for it.
  if (overflowsBoth(first, viewport)) return 'too-small'

  const flipped = flipDirection(source)
  const second = flipped ? render(flipped) : null

  return second && fitsViewport(second, viewport) ? second.lines : 'too-small'
}

function overflowsBoth(diagram: DiagramResult, viewport: Viewport): boolean {
  return (
    diagram.width > viewport.columns - COLUMN_MARGIN &&
    diagram.height > viewport.rows - ROW_MARGIN
  )
}
