import { expect, test } from 'claude-code/testing'

import { clip } from './size'

test('clip leaves short text alone and cuts long text with an ellipsis', async () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long description here', 10)).toBe('a long de…')
  expect(clip('anything', 0)).toBe('')
  expect(clip('anything', 1)).toBe('…')
})
