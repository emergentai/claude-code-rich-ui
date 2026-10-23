import { expect, test } from 'claude-code/testing'

import { guard, isOn } from './gate'

const FEATURE = { id: 'demo', defaultEnabled: true }

test('a feature with no choice uses its default', async () => {
  expect(isOn({}, FEATURE)).toBe(true)
  expect(isOn({}, { id: 'demo', defaultEnabled: false })).toBe(false)
})

test('a stored choice wins over the default', async () => {
  expect(isOn({ demo: false }, FEATURE)).toBe(false)
  expect(isOn({ demo: true }, { id: 'demo', defaultEnabled: false })).toBe(true)
})

test('guard returns the work when it succeeds', async () => {
  const result = await guard(
    async () => 'ran',
    () => 'fallback',
    () => {
      throw new Error('should not report')
    },
  )

  expect(result).toBe('ran')
})

test('guard reports a throw and falls back', async () => {
  const reported: string[] = []
  const result = await guard(
    () => {
      throw new Error('hook broke')
    },
    () => 'fallback',
    error => reported.push((error as Error).message),
  )

  expect(result).toBe('fallback')
  expect(reported[0]).toBe('hook broke')
})
