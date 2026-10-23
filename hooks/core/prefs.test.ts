import { expect, test } from 'claude-code/testing'

import { parseStored, serialize, toggled } from './prefs'

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
