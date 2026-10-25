import { expect, test } from 'claude-code/testing'

import { pickQuote, ZEN_MAX, ZEN_QUOTES } from './zen'

test('every saying is short, plain and different from the rest', () => {
  expect(ZEN_QUOTES.length).toBeGreaterThanOrEqual(20)
  expect(new Set(ZEN_QUOTES).size).toBe(ZEN_QUOTES.length)
  for (const line of ZEN_QUOTES) {
    expect(line.length).toBeGreaterThan(0)
    expect(line.length).toBeLessThanOrEqual(ZEN_MAX)
    expect(line).toBe(line.trim())
    expect(line).not.toContain(' · ')
  }
})

test('a roll picks a saying, and the ends of the range are in range', () => {
  expect(pickQuote(undefined, 0)).toBe(0)
  expect(pickQuote(undefined, 0.999999)).toBe(ZEN_QUOTES.length - 1)
  expect(pickQuote(undefined, 1)).toBe(ZEN_QUOTES.length - 1)
  expect(pickQuote(undefined, -3)).toBe(0)
  expect(pickQuote(undefined, Number.NaN)).toBe(0)
})

test('it is never the saying just shown', () => {
  for (let previous = 0; previous < ZEN_QUOTES.length; previous++) {
    for (let step = 0; step < 100; step++) {
      expect(pickQuote(previous, step / 100)).not.toBe(previous)
    }
  }
})
