import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { StatusMap } from '../../types'
import { gateOn } from './gate'
import { toggleFeature } from './prefs'
import { fakeEngine } from './test-harness'

type Hook = (
  $: unknown,
  e: { text: string },
  next: (e: { text: string }) => unknown,
) => unknown

// A stand-in for `on` that keeps the one hook registered through it.
function capture() {
  const registered: { hook?: Hook } = {}
  const on = ((...args: unknown[]) => {
    registered.hook = args[args.length - 1] as Hook
  }) as unknown as On

  return { registered, gated: gateOn(on, { id: 'demo', defaultEnabled: true }) }
}

const passThrough = (e: { text: string }) => `next:${e.text}`

async function run(registered: { hook?: Hook }, $: unknown) {
  return registered.hook?.($, { text: 'original' }, passThrough)
}

test('an enabled feature runs its hook', async () => {
  const { $ } = fakeEngine()
  const { registered, gated } = capture()
  ;(gated as unknown as (name: string, hook: Hook) => void)('x', (_, e) => `ran:${e.text}`)

  expect(await run(registered, $)).toBe('ran:original')
})

test('a disabled feature passes the event through', async () => {
  const { $ } = fakeEngine()
  const { registered, gated } = capture()
  ;(gated as unknown as (name: string, hook: Hook) => void)('x', (_, e) => `ran:${e.text}`)
  await toggleFeature($, 'demo', true)

  expect(await run(registered, $)).toBe('next:original')
})

test('a throwing hook is recorded and the event continues', async () => {
  const { $, flush, peek } = fakeEngine()
  const { registered, gated } = capture()
  ;(gated as unknown as (name: string, hook: Hook) => void)('x', () => {
    throw new Error('hook broke')
  })

  expect(await run(registered, $)).toBe('next:original')
  await flush()
  const status = peek<StatusMap>('rich-ui', 'status') ?? {}
  expect(status['demo']?.error?.message).toBe('hook broke')
})
