import { expect, test } from 'claude-code/testing'

import { isEnabled, loadPrefs, parseStored, toggleFeature } from './prefs'
import { fakeEngine } from './test-harness'

test('parseStored accepts only the current shape', async () => {
  expect(JSON.stringify(parseStored({ v: 1, enabled: { a: true, b: 'x' } }))).toBe(
    JSON.stringify({ a: true }),
  )
  expect(JSON.stringify(parseStored({ v: 2, enabled: { a: true } }))).toBe('{}')
  expect(JSON.stringify(parseStored(null))).toBe('{}')
  expect(JSON.stringify(parseStored('nope'))).toBe('{}')
})

test('a feature with no stored choice uses its default', async () => {
  const { $ } = fakeEngine()

  expect(await isEnabled($, 'mermaid', true)).toBe(true)
  expect(await isEnabled($, 'other', false)).toBe(false)
})

test('a stored choice wins over the default', async () => {
  const { $ } = fakeEngine({ prefs: { v: 1, enabled: { mermaid: false } } })
  await loadPrefs($)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
})

test('a toggle flips the flag, saves it and clears the status', async () => {
  const { $, stored } = fakeEngine()

  await toggleFeature($, 'mermaid', true)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
  expect(JSON.stringify(stored.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: { mermaid: false } }),
  )

  await toggleFeature($, 'mermaid', true)
  expect(await isEnabled($, 'mermaid', true)).toBe(true)
})

test('a failed save keeps the toggle and sets saveFailed', async () => {
  const { $, failStore, peek } = fakeEngine()
  failStore.on = true

  await toggleFeature($, 'mermaid', true)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
  expect(peek<boolean>('rich-ui', 'saveFailed')).toBe(true)

  failStore.on = false
  await toggleFeature($, 'mermaid', true)
  expect(peek<boolean>('rich-ui', 'saveFailed')).toBe(false)
})
