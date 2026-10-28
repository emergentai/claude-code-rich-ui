import { expect, test } from 'claude-code/testing'

import { enabledKey, parseStored, parseWelcome, readPrefs, toggled, welcomeValue } from './prefs'

const FEATURE = { id: 'mermaid', defaultEnabled: true }

test('parseStored accepts only the current shape', async () => {
  expect(JSON.stringify(parseStored({ v: 1, enabled: { a: true, b: 'x' } }))).toBe(
    JSON.stringify({ a: true }),
  )
  expect(JSON.stringify(parseStored({ v: 2, enabled: { a: true } }))).toBe('{}')
  expect(JSON.stringify(parseStored(null))).toBe('{}')
  expect(JSON.stringify(parseStored('nope'))).toBe('{}')
})

test('a toggle flips the effective flag', async () => {
  const off = toggled({}, FEATURE)
  expect(off['mermaid']).toBe(false)

  const on = toggled(off, FEATURE)
  expect(on['mermaid']).toBe(true)

  expect(toggled({}, { id: 'x', defaultEnabled: false })['x']).toBe(true)
})

test('the legacy record: its welcome text is read, and choices saved before the text existed still load', () => {
  expect(parseWelcome({ v: 1, enabled: {}, welcome: 'hi there' })).toBe('hi there')
  expect(parseWelcome({ v: 1, enabled: {} })).toBeUndefined()
  expect(parseWelcome({ v: 2, welcome: 'x' })).toBeUndefined()
  expect(parseWelcome({ v: 1, welcome: 3 })).toBeUndefined()
  expect(parseWelcome(null)).toBeUndefined()
  expect(parseStored({ v: 1, enabled: { a: false }, welcome: 'hi' })).toEqual({ a: false })
})

test('each choice has its own entry, so two sessions saving different ones cannot overwrite each other', () => {
  expect(enabledKey('mermaid')).not.toBe(enabledKey('markdown-preview'))
})

test('the choices: each entry laid over the legacy record, and the welcome text null for the default', () => {
  const legacy = { v: 1, enabled: { mermaid: false, zen: true }, welcome: 'Old' }

  expect(readPrefs(undefined, {}, undefined)).toEqual({ enabled: {}, welcome: undefined })
  // The legacy record alone is what an older version wrote.
  expect(readPrefs(legacy, {}, undefined)).toEqual({ enabled: { mermaid: false, zen: true }, welcome: 'Old' })
  // An entry wins over it, and an entry that is not a flag is not one.
  expect(readPrefs(legacy, { mermaid: true, zen: 'x', other: false }, 'New').enabled).toEqual({ mermaid: true, zen: true, other: false })
  expect(readPrefs(legacy, {}, 'New').welcome).toBe('New')
  // null says the default, over the legacy text; nothing says nothing was saved.
  expect(readPrefs(legacy, {}, welcomeValue(undefined)).welcome).toBeUndefined()
  expect(readPrefs(legacy, {}, undefined).welcome).toBe('Old')
  expect(readPrefs('garbage', { mermaid: false }, 3)).toEqual({ enabled: { mermaid: false }, welcome: undefined })
})
