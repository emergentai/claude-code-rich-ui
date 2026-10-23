import { expect, test } from 'claude-code/testing'

import { clip, contentColumns, contentRows } from './size'

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

test('the docked width fits the widest line plus padding', async () => {
  // description 10 + 4 indent = 14; footer 20; widest 20; plus 2 padding
  expect(contentColumns(['0123456789'], 'x'.repeat(20))).toBe(22)
  // a long description wins over the footer
  expect(contentColumns(['x'.repeat(30)], 'short')).toBe(36)
})
