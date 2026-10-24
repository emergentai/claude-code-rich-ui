// EXPERIMENT (scrollback spike). Pure helpers: what a long Bash result looks
// like to a plugin and how a pane could draw it. Not shipped.

// Rows the pane draws at most; the rest is cut with a note. One drawing takes
// 100000 characters (docs/features/markdown-preview.md), and a tree of rows
// costs more to build than one string.
export const MAX_ROWS = 2000

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

// The part of a ToolGroup call this needs (the engine's ToolGroupCall).
export type CallLike = {
  tool: string
  tool_use_id?: string
  input?: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
  output?: unknown
}

export type Offer = {
  id: string
  source: OutputSource
  // What the button says: the command, shortened, and the size.
  label: string
}

export function commandOf(input: unknown): string {
  if (typeof input !== 'object' || input === null) return ''
  const command = (input as { command?: unknown }).command

  return typeof command === 'string' ? command.replace(/\s+/g, ' ').trim() : ''
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

// A Bash call that finished, did not fail, and whose output the engine cut (it
// kept the whole output in a file). Nothing else is offered: stock folds every
// call into a group line and one click shows what it holds, so only the part past
// the cut is out of reach. Checked on 2.1.310 in tmux (docs/dev/scrollback-spike.md).
export function offerFor(call: CallLike): Offer | undefined {
  if (call.tool !== 'Bash') return undefined
  if (call.isRunning || call.isErrored || call.isInterrupted) return undefined
  if (call.tool_use_id === undefined) return undefined
  const source = bashSource(call.output)
  if (source?.path === undefined) return undefined
  const command = commandOf(call.input)
  const size = source.size === undefined ? '' : ` (${describeSize(source.size)})`

  return {
    id: call.tool_use_id,
    source,
    label: `full output${command === '' ? '' : `: ${shorten(command, 40)}`}${size}`,
  }
}

export type Clipped = { rows: string[]; total: number; isCut: boolean }

export function clipRows(text: string, max = MAX_ROWS): Clipped {
  const lines = splitLines(text)
  if (lines.length <= max) return { rows: lines, total: lines.length, isCut: false }

  return { rows: lines.slice(0, max), total: lines.length, isCut: true }
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
