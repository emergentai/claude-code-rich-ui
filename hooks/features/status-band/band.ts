import type { UsageSnapshot } from '../../../types'

// A segment appears only when it has something to say: a healthy session shows
// no band at all.
export const CONTEXT_SHOW = 60
export const CONTEXT_WARN = 85
export const LIMIT_SHOW = 75
export const LIMIT_WARN = 90

const BAR_CELLS = 8
const SEPARATOR = '  ·  '

const LIMIT_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'spend',
}
const LIMIT_ORDER = ['five_hour', 'seven_day', 'spend_limit']

export type Segment = {
  id: string
  text: string
  isWarning: boolean
}

export function bar(percent: number): string {
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((percent / 100) * BAR_CELLS)))

  return '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
}

// "now", "42m", "2h 05m", "3d 4h".
export function countdown(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return undefined

  const minutes = Math.floor((at - now) / 60_000)
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function segmentsFor(snapshot: UsageSnapshot, now: number): Segment[] {
  const out: Segment[] = []

  const context = snapshot.contextPercent
  if (context !== undefined && context >= CONTEXT_SHOW) {
    out.push({
      id: 'context',
      text: `context ${bar(context)} ${Math.round(context)}%`,
      isWarning: context >= CONTEXT_WARN,
    })
  }

  const limits = snapshot.limits
    .filter(limit => limit.percentUsed >= LIMIT_SHOW)
    .sort((a, b) => rank(a.kind) - rank(b.kind))
  for (const limit of limits) {
    const label = LIMIT_LABELS[limit.kind] ?? limit.kind
    const reset = countdown(limit.resetsAt, now)
    // A window already past its reset is stale until a fresh reading arrives.
    if (reset === 'now') continue

    out.push({
      id: limit.kind,
      text: `${label} ${Math.round(limit.percentUsed)}%${reset ? ` · resets in ${reset}` : ''}`,
      isWarning: limit.percentUsed >= LIMIT_WARN,
    })
  }

  return out
}

function rank(kind: string): number {
  const index = LIMIT_ORDER.indexOf(kind)

  return index === -1 ? LIMIT_ORDER.length : index
}

// Drops segments from the end until the line fits; the first is always kept.
export function fitSegments(segments: Segment[], width: number): Segment[] {
  const kept = [...segments]
  while (kept.length > 1 && lineLength(kept) > width) kept.pop()

  return kept
}

export function lineLength(segments: Segment[]): number {
  return segments.reduce((total, segment) => total + segment.text.length, 0) +
    SEPARATOR.length * Math.max(0, segments.length - 1)
}

export { SEPARATOR }
