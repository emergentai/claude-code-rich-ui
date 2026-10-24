// EXPERIMENT (scrollback spike): the pure helpers.
import { expect, test } from 'claude-code/testing'

import {
  bashSource,
  clipRows,
  describeSize,
  gutter,
  lineCount,
  MAX_ROWS,
  OFFER_FROM_LINES,
  shouldOffer,
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

test('the button is offered from the threshold, never for errors or ctrl+o', () => {
  const base = { lines: OFFER_FROM_LINES, isErrored: false, isExpanded: false }
  expect(shouldOffer(base)).toBe(true)
  expect(shouldOffer({ ...base, lines: OFFER_FROM_LINES - 1 })).toBe(false)
  expect(shouldOffer({ ...base, isErrored: true })).toBe(false)
  expect(shouldOffer({ ...base, isExpanded: true })).toBe(false)
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
