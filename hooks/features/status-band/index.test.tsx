import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

function measure(context: number, limits: { kind: string; percentUsed: number }[] = []) {
  return {
    context: { window: 200_000, percent: context },
    rateLimits: limits,
    changed: ['context'],
  } as never
}

test('with nothing high the status row is left empty', async ($, on) => {
  const { status } = await boot($, on)
  await $.session.measure(measure(20))

  expect(status.line).toBeUndefined()
})

test('a high context is pinned and follows later readings', async ($, on) => {
  const { status } = await boot($, on)
  await $.session.measure(measure(72))
  expect(status.line).toMatch(/^context .* 72%$/)

  await $.session.measure(measure(30))
  expect(status.line).toBeUndefined()
})

test('a high plan limit is pinned next to the context', async ($, on) => {
  const { status } = await boot($, on)
  await $.session.measure(measure(65, [{ kind: 'five_hour', percentUsed: 88 }]))

  expect(status.line).toMatch(/context .* 65%/)
  expect(status.line).toMatch(/5h 88%/)
})

test('turned off from the start, nothing is pinned', async ($, on) => {
  const { status } = await boot($, on, {
    prefs: { v: 1, enabled: { 'status-band': false } },
  })
  await $.session.measure(measure(95))

  expect(status.line).toBeUndefined()
})
