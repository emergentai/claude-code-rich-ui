import { expect, test } from 'claude-code/testing'

import { clip, contentRows } from './size'

test('content rows cover header, feature rows, status, spacers and footer', async () => {
  expect(contentRows(1, 0, false)).toBe(6)
  expect(contentRows(2, 3, false)).toBe(11)
  expect(contentRows(1, 0, true)).toBe(7)
})

test('clip leaves short text alone and cuts long text with an ellipsis', async () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long description here', 10)).toBe('a long de…')
  expect(clip('anything', 0)).toBe('')
  expect(clip('anything', 1)).toBe('…')
})
