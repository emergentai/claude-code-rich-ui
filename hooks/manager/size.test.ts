import { expect, test } from 'claude-code/testing'

import { clip, contentRows } from './size'

test('content rows cover banner, dividers, feature rows, status and footer', async () => {
  // 3 banner + 1 divider + 1 footer = 5, plus two rows a feature and a blank between
  expect(contentRows(1, 0, false)).toBe(7)
  expect(contentRows(2, 3, false)).toBe(5 + 5 + 3)
  expect(contentRows(1, 0, true)).toBe(8)
  expect(contentRows(0, 0, false)).toBe(5)
})

test('clip leaves short text alone and cuts long text with an ellipsis', async () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long description here', 10)).toBe('a long de…')
  expect(clip('anything', 0)).toBe('')
  expect(clip('anything', 1)).toBe('…')
})
