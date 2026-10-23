import { expect, test } from 'claude-code/testing'

import { messageOf, withError, withNote, withoutStatus } from './errors'

test('an error is recorded with a count and a time', async () => {
  const map = withError({}, 'mermaid', 'boom', 5)

  expect(map['mermaid']?.error?.message).toBe('boom')
  expect(map['mermaid']?.error?.count).toBe(1)
  expect(map['mermaid']?.error?.at).toBe(5)
})

test('a repeated error raises the count and keeps the latest message', async () => {
  const map = withError(withError({}, 'mermaid', 'boom', 5), 'mermaid', 'again', 9)

  expect(map['mermaid']?.error?.count).toBe(2)
  expect(map['mermaid']?.error?.message).toBe('again')
})

test('a note is kept once however often it is posted', async () => {
  const map = withNote(withNote({}, 'mermaid', 'size unknown'), 'mermaid', 'size unknown')

  expect(map['mermaid']?.notes.length).toBe(1)
})

test('an error and a note live side by side', async () => {
  const map = withNote(withError({}, 'mermaid', 'boom', 1), 'mermaid', 'a note')

  expect(map['mermaid']?.error?.message).toBe('boom')
  expect(map['mermaid']?.notes[0]).toBe('a note')
})

test('clearing a feature removes its entry and leaves the others', async () => {
  const both = withNote(withNote({}, 'mermaid', 'a'), 'other', 'b')
  const map = withoutStatus(both, 'mermaid')

  expect(map['mermaid']).toBeUndefined()
  expect(map['other']?.notes[0]).toBe('b')
  expect(withoutStatus(map, 'missing')).toBe(map)
})

test('messageOf reads an Error or any other value', async () => {
  expect(messageOf(new Error('x'))).toBe('x')
  expect(messageOf('y')).toBe('y')
})
