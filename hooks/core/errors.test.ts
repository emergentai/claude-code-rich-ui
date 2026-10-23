import { expect, test } from 'claude-code/testing'

import type { StatusMap } from '../../types'
import { clearStatus, reportError, reportNote } from './errors'
import { fakeEngine } from './test-harness'

function status(peek: <T>(plugin: string, key: string) => T | undefined) {
  return peek<StatusMap>('rich-ui', 'status') ?? {}
}

test('a reported error lands after the timer runs', async () => {
  const { $, flush, peek } = fakeEngine()

  reportError($, 'mermaid', new Error('boom'))
  expect(status(peek)['mermaid']).toBeUndefined()

  await flush()
  expect(status(peek)['mermaid']?.error?.message).toBe('boom')
  expect(status(peek)['mermaid']?.error?.count).toBe(1)
})

test('a repeated error raises the count', async () => {
  const { $, flush, peek } = fakeEngine()

  reportError($, 'mermaid', new Error('boom'))
  await flush()
  reportError($, 'mermaid', new Error('boom again'))
  await flush()

  expect(status(peek)['mermaid']?.error?.count).toBe(2)
  expect(status(peek)['mermaid']?.error?.message).toBe('boom again')
})

test('a note is kept once however often it is posted', async () => {
  const { $, flush, peek } = fakeEngine()

  reportNote($, 'mermaid', 'size unknown')
  reportNote($, 'mermaid', 'size unknown')
  await flush()

  expect(status(peek)['mermaid']?.notes.length).toBe(1)
})

test('clearing a feature removes its entry', async () => {
  const { $, flush, peek } = fakeEngine()

  reportNote($, 'mermaid', 'size unknown')
  await flush()
  await clearStatus($, 'mermaid')

  expect(status(peek)['mermaid']).toBeUndefined()
})
