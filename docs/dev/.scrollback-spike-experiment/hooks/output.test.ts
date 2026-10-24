// EXPERIMENT (scrollback spike): the pure helpers.
import { expect, test } from 'claude-code/testing'

import {
  bashSource,
  clipRows,
  describeSize,
  gutter,
  lineCount,
  MAX_ROWS,
  commandOf,
  offerFor,
  splitLines,
  stripAnsi,
} from './output'

test('stdout and stderr are joined, each on its own line', () => {
  expect(bashSource({ stdout: 'a\n', stderr: 'b\n' })?.text).toBe('a\nb\n')
  expect(bashSource({ stdout: 'a', stderr: 'b' })?.text).toBe('a\nb')
  expect(bashSource({ stdout: 'only', stderr: '' })?.text).toBe('only')
  expect(bashSource({ stdout: '', stderr: 'only err' })?.text).toBe('only err')
})

test('a result with no output, or not a Bash record, has no source', () => {
  expect(bashSource({ stdout: '', stderr: '' })).toBeUndefined()
  expect(bashSource(undefined)).toBeUndefined()
  expect(bashSource(null)).toBeUndefined()
  expect(bashSource('text')).toBeUndefined()
  expect(bashSource({ stdout: 5 })).toBeUndefined()
})

test('the path and size of an output the engine kept on disk are carried', () => {
  const source = bashSource({ stdout: 'x', stderr: '', persistedOutputPath: '/p/o.txt', persistedOutputSize: 348894 })
  expect(source?.path).toBe('/p/o.txt')
  expect(source?.size).toBe(348894)
  expect(bashSource({ stdout: 'x', persistedOutputPath: 3 })?.path).toBeUndefined()
})

test('lines are counted without the final newline, and CRLF is one break', () => {
  expect(lineCount('')).toBe(0)
  expect(lineCount('a')).toBe(1)
  expect(lineCount('a\n')).toBe(1)
  expect(lineCount('a\n\n')).toBe(2)
  expect(lineCount('a\r\nb\r\n')).toBe(2)
  expect(splitLines('a\rb')).toEqual(['a', 'b'])
})

test('colour codes and links are stripped, other text is kept', () => {
  expect(stripAnsi('\u001b[31mred\u001b[0m plain')).toBe('red plain')
  expect(stripAnsi('\u001b]8;;http://x\u0007link\u001b]8;;\u0007')).toBe('link')
  expect(splitLines('\u001b[1mbold\u001b[0m\nnext')).toEqual(['bold', 'next'])
  expect(stripAnsi('tab\there 日本語 🙂')).toBe('tab\there 日本語 🙂')
})

const CALL = {
  tool: 'Bash',
  tool_use_id: 't1',
  input: { command: 'seq 1 60000' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: { stdout: 'x', stderr: '', persistedOutputPath: '/p/o.txt', persistedOutputSize: 348894 },
}

test('only a finished, successful Bash call whose output was cut is offered', () => {
  expect(offerFor(CALL)?.id).toBe('t1')
  expect(offerFor(CALL)?.source.path).toBe('/p/o.txt')
  expect(offerFor({ ...CALL, output: { stdout: 'x', stderr: '' } })).toBeUndefined()
  expect(offerFor({ ...CALL, isErrored: true })).toBeUndefined()
  expect(offerFor({ ...CALL, isRunning: true })).toBeUndefined()
  expect(offerFor({ ...CALL, isInterrupted: true })).toBeUndefined()
  expect(offerFor({ ...CALL, tool: 'Read' })).toBeUndefined()
  expect(offerFor({ ...CALL, tool_use_id: undefined })).toBeUndefined()
  expect(offerFor({ ...CALL, output: undefined })).toBeUndefined()
})

test('the label names the command, shortened, and the size', () => {
  expect(offerFor(CALL)?.label).toBe('full output: seq 1 60000 (340.7 KiB)')
  const long = offerFor({ ...CALL, input: { command: `echo ${'a'.repeat(100)}` } })
  expect(long?.label.length).toBeLessThan(70)
  expect(long?.label).toContain('…')
  expect(offerFor({ ...CALL, input: undefined })?.label).toBe('full output (340.7 KiB)')
  expect(offerFor({ ...CALL, output: { ...CALL.output, persistedOutputSize: undefined } })?.label).toBe(
    'full output: seq 1 60000',
  )
})

test('a command is read from the input, its whitespace folded', () => {
  expect(commandOf({ command: 'a\n  b\tc' })).toBe('a b c')
  expect(commandOf({ command: 5 })).toBe('')
  expect(commandOf(null)).toBe('')
  expect(commandOf('x')).toBe('')
})

test('rows are cut at the cap and the true total is kept', () => {
  const text = Array.from({ length: MAX_ROWS + 5 }, (_, i) => `l${i}`).join('\n')
  const clipped = clipRows(text)
  expect(clipped.rows).toHaveLength(MAX_ROWS)
  expect(clipped.total).toBe(MAX_ROWS + 5)
  expect(clipped.isCut).toBe(true)
  expect(clipRows('a\nb').isCut).toBe(false)
  expect(clipRows('a\nb\nc', 2)).toEqual({ rows: ['a', 'b'], total: 3, isCut: true })
  expect(clipRows('', 2)).toEqual({ rows: [''], total: 1, isCut: false })
})

test('sizes and the line-number gutter read well', () => {
  expect(describeSize(900)).toBe('900 B')
  expect(describeSize(348894)).toBe('340.7 KiB')
  expect(describeSize(5 * 1024 * 1024)).toBe('5.0 MiB')
  expect(gutter(0, 9)).toBe('1')
  expect(gutter(0, 1000)).toBe('   1')
  expect(gutter(999, 1000)).toBe('1000')
})

test('cutting a 6222-line output to rows is cheap', () => {
  const text = Array.from({ length: 6222 }, (_, i) => `${i}`.padEnd(80, 'x')).join('\n')
  const start = performance.now()
  for (let i = 0; i < 20; i++) clipRows(text)
  const per = (performance.now() - start) / 20
  // Measured at about 0.3 ms; the bound is loose on purpose.
  expect(per).toBeLessThan(50)
})
