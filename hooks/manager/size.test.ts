import { expect, test } from 'claude-code/testing'

import { clip, contentRows } from './size'

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
