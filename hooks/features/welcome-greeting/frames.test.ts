import { expect, test } from 'claude-code/testing'

import { MAX_MISSES, MIN_COLUMNS, MIN_ROWS, bandSize, createPacer, encodeBase64, encodeWords } from './frames'

test('base64 matches the standard vectors', () => {
  const bytes = (s: string) => [...s].map(c => c.charCodeAt(0))
  expect(encodeBase64([])).toBe('')
  expect(encodeBase64(bytes('f'))).toBe('Zg==')
  expect(encodeBase64(bytes('fo'))).toBe('Zm8=')
  expect(encodeBase64(bytes('foo'))).toBe('Zm9v')
  expect(encodeBase64(bytes('foobar'))).toBe('Zm9vYmFy')
})

test('words are little-endian u32s', () => {
  expect(encodeWords([0x04030201])).toBe(encodeBase64([1, 2, 3, 4]))
  expect(encodeWords([])).toBe('')
})

test('a window needs measuring, 50 columns and 24 rows', () => {
  expect(bandSize({ columns: MIN_COLUMNS, rows: MIN_ROWS })).toEqual({ columns: 50, rows: 24 })
  expect(bandSize({ columns: 49, rows: 40 })).toBeUndefined()
  expect(bandSize({ columns: 120, rows: 23 })).toBeUndefined()
  expect(bandSize(undefined)).toBeUndefined()
  expect(bandSize({})).toBeUndefined()
  expect(bandSize({ columns: Number.NaN, rows: 40 })).toBeUndefined()
  expect(bandSize({ columns: 120, rows: Number.POSITIVE_INFINITY })).toBeUndefined()
})

test('the pacer drops a frame while one is in flight', () => {
  const pacer = createPacer()

  expect(pacer.begin()).toBe(true)
  expect(pacer.begin()).toBe(false)
  expect(pacer.end(false)).toBe(false)
  expect(pacer.begin()).toBe(true)
})

test('the pacer stops after a run of denials and forgives a success', () => {
  const pacer = createPacer(3)
  const run = (denied: boolean) => {
    pacer.begin()

    return pacer.end(denied)
  }

  expect(run(true)).toBe(false)
  expect(run(true)).toBe(false)
  expect(run(false)).toBe(false) // a success resets the run
  expect(run(true)).toBe(false)
  expect(run(true)).toBe(false)
  expect(run(true)).toBe(true)
  expect(MAX_MISSES).toBeGreaterThan(10)
})
