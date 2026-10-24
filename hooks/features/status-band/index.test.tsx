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

test('/clear ends the session with reason "clear" and the band is reset at once', async ($, on) => {
  const { status } = await boot($, on)
  await $.session.measure(measure(80))
  expect(status.line).toMatch(/context .* 80%/)

  // /clear surfaces as session.end({ reason: 'clear' }); no session.start
  // follows it, and no fresh session.measure is guaranteed soon after, so the
  // band must clear itself here rather than waiting on one.
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} } as never)
  expect(status.line).toBeUndefined()
})

test('a session ending for another reason leaves the band alone', async ($, on) => {
  const { status } = await boot($, on)
  await $.session.measure(measure(80))
  expect(status.line).toMatch(/context .* 80%/)

  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  expect(status.line).toMatch(/context .* 80%/)
})
