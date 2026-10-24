// EXPERIMENT (scrollback spike). Pure helpers: what a long Bash result looks
// like to a plugin and how a pane could draw it. Not shipped.

// Rows the pane draws at most; the rest is cut with a note. One drawing takes
// 100000 characters (docs/features/markdown-preview.md), and a tree of rows
// costs more to build than one string.
export const MAX_ROWS = 2000
// The button is offered from this many lines. The stock collapse point is not
// verified (docs/dev/scrollback-spike.md), so this is a guess to be tuned.
export const OFFER_FROM_LINES = 12

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '')
}

// The record of a Bash call: stdout is cut at 30000 characters by the engine and
// the whole output sits in the file persistedOutputPath names.
export type BashRecord = {
  stdout?: unknown
  stderr?: unknown
  persistedOutputPath?: unknown
  persistedOutputSize?: unknown
}

export type OutputSource = {
  // What is already in hand.
  text: string
  // Where the rest is, when the engine kept the output on disk.
  path?: string
  // The size of the whole output in bytes, when the engine says.
  size?: number
}

// Text of a Bash result, or undefined when the output is not a Bash record.
export function bashSource(output: unknown): OutputSource | undefined {
  if (typeof output !== 'object' || output === null) return undefined
  const record = output as BashRecord
  const stdout = typeof record.stdout === 'string' ? record.stdout : ''
  const stderr = typeof record.stderr === 'string' ? record.stderr : ''
  if (stdout === '' && stderr === '') return undefined

  const text = stdout !== '' && stderr !== '' ? `${stdout.replace(/\n$/, '')}\n${stderr}` : stdout + stderr

  return {
    text,
    path: typeof record.persistedOutputPath === 'string' ? record.persistedOutputPath : undefined,
    size: typeof record.persistedOutputSize === 'number' ? record.persistedOutputSize : undefined,
  }
}

export function splitLines(text: string): string[] {
  const lines = stripAnsi(text).replace(/\r\n?/g, '\n').split('\n')
  if (lines.length > 1 && lines.at(-1) === '') lines.pop()

  return lines
}

export function lineCount(text: string): number {
  return text === '' ? 0 : splitLines(text).length
}

export type OfferInput = {
  lines: number
  isErrored: boolean
  isExpanded: boolean
}

// A long result that the stock view shows folded, not an error (its text is the
// error's), and not under ctrl+o, which shows everything already.
export function shouldOffer(input: OfferInput): boolean {
  return !input.isErrored && !input.isExpanded && input.lines >= OFFER_FROM_LINES
}

export type Clipped = { rows: string[]; total: number; isCut: boolean }

export function clipRows(text: string, max = MAX_ROWS): Clipped {
  const lines = splitLines(text)
  if (lines.length <= max) return { rows: lines, total: lines.length, isCut: false }

  return { rows: lines.slice(0, max), total: lines.length, isCut: true }
}

export function buttonLabel(lines: number): string {
  return `view all ${lines.toLocaleString('en-US')} lines`
}

export function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`

  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

// Line numbers, right-aligned to the widest.
export function gutter(index: number, total: number): string {
  return String(index + 1).padStart(String(total).length, ' ')
}
