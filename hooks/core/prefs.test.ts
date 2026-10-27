import { expect, test } from 'claude-code/testing'

import { mergePrefs, parseStored, parseWelcome, serialize, toggled } from './prefs'

const FEATURE = { id: 'mermaid', defaultEnabled: true }

test('parseStored accepts only the current shape', async () => {
  expect(JSON.stringify(parseStored({ v: 1, enabled: { a: true, b: 'x' } }))).toBe(
    JSON.stringify({ a: true }),
  )
  expect(JSON.stringify(parseStored({ v: 2, enabled: { a: true } }))).toBe('{}')
  expect(JSON.stringify(parseStored(null))).toBe('{}')
  expect(JSON.stringify(parseStored('nope'))).toBe('{}')
})

test('serialize and parseStored round trip', async () => {
  const saved = serialize({ mermaid: false })

  expect(JSON.stringify(saved)).toBe(JSON.stringify({ v: 1, enabled: { mermaid: false } }))
  expect(JSON.stringify(parseStored(saved))).toBe(JSON.stringify({ mermaid: false }))
})

test('a toggle flips the effective flag', async () => {
  const off = toggled({}, FEATURE)
  expect(off['mermaid']).toBe(false)

  const on = toggled(off, FEATURE)
  expect(on['mermaid']).toBe(true)

  expect(toggled({}, { id: 'x', defaultEnabled: false })['x']).toBe(true)
})

test('the welcome text is kept beside the choices, and left out when unset', () => {
  expect(serialize({ a: true })).toEqual({ v: 1, enabled: { a: true } })
  expect(parseWelcome(serialize({}, 'hi there'))).toBe('hi there')
  expect(parseWelcome(serialize({}))).toBeUndefined()
  expect(parseWelcome({ v: 2, welcome: 'x' })).toBeUndefined()
  expect(parseWelcome({ v: 1, welcome: 3 })).toBeUndefined()
  expect(parseWelcome(null)).toBeUndefined()
  // Choices saved before the text existed still load.
  expect(parseStored(serialize({ a: false }, 'hi'))).toEqual({ a: false })
})

test('a save keeps what another session stored and changes only what it names', async () => {
  const stored = { v: 1, enabled: { mermaid: false, zen: true }, welcome: 'Hi from B' }

  const toggle = mergePrefs(stored, { enabled: { 'markdown-preview': false } })
  expect(JSON.stringify(toggle.enabled)).toBe(
    JSON.stringify({ mermaid: false, zen: true, 'markdown-preview': false }),
  )
  expect(toggle.welcome).toBe('Hi from B')

  const typed = mergePrefs(stored, { welcome: { text: 'Mine' } })
  expect(JSON.stringify(typed.enabled)).toBe(JSON.stringify({ mermaid: false, zen: true }))
  expect(typed.welcome).toBe('Mine')

  expect(mergePrefs(stored, { welcome: { text: undefined } }).welcome).toBe(undefined)
  expect(JSON.stringify(mergePrefs(undefined, {}).enabled)).toBe('{}')
})
