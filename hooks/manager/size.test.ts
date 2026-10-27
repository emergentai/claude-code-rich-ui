import { expect, test } from 'claude-code/testing'

import { clip, contentRows, stepFocus, wrap } from './size'

test('content rows cover banner, dividers, feature rows, status and footer', async () => {
  // 3 banner + 1 divider + 1 blank + 1 footer = 6, plus three rows a feature
  expect(contentRows(1, 0, false)).toBe(9)
  expect(contentRows(2, 3, false)).toBe(6 + 6 + 3)
  expect(contentRows(1, 0, true)).toBe(10)
  expect(contentRows(0, 0, false)).toBe(6)
})

test('clip leaves short text alone and cuts long text with an ellipsis', async () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long description here', 10)).toBe('a long de…')
  expect(clip('anything', 0)).toBe('')
  expect(clip('anything', 1)).toBe('…')
})

test('wrap breaks on words, at most two lines, cutting the rest with an ellipsis', async () => {
  expect(wrap('short', 10)).toEqual(['short'])
  expect(wrap('one two three four', 10)).toEqual(['one two', 'three four'])
  expect(wrap('one two three four five six', 10)).toEqual(['one two', 'three fou…'])
  expect(contentRows(1, 0, false, 0, 1)).toBe(10)
})

test('an arrow moves the focus one feature, stopping at the ends, and leaves a ring elsewhere alone', () => {
  const ids = ['a', 'b', 'c']
  expect(stepFocus(ids, 'a', 1)).toBe('b')
  expect(stepFocus(ids, 'b', -1)).toBe('a')
  expect(stepFocus(ids, 'a', -1)).toBe('a')
  expect(stepFocus(ids, 'c', 1)).toBe('c')
  expect(stepFocus(ids, 'welcome-text-0', 1)).toBeUndefined()
  expect(stepFocus(ids, '', 1)).toBeUndefined()
})
