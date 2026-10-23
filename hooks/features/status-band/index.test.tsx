import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const BAND = {
  plugin: 'rich-ui',
  surface: 'terminal',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

function measure(context: number, limits: { kind: string; percentUsed: number }[] = []) {
  return {
    context: { window: 200_000, percent: context },
    rateLimits: limits,
    changed: ['context'],
  } as const
}

test('with nothing high the band leaves the prompt area to the engine', async ($, on) => {
  await boot($, on)
  await $.session.measure(measure(20) as never)
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /context/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a high context shows in the band and follows later readings', async ($, on) => {
  await boot($, on)
  await $.session.measure(measure(72) as never)
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /context .* 72%/ })).toBeDefined()

  await $.session.measure(measure(30) as never)
  expect(await ui.find({ type: 'Text', text: /context/ })).toBeUndefined()
  await ui.unmount()
})

test('a high plan limit shows next to the context', async ($, on) => {
  await boot($, on)
  await $.session.measure(
    measure(65, [{ kind: 'five_hour', percentUsed: 88 }]) as never,
  )
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /context/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h 88%/ })).toBeDefined()
  await ui.unmount()
})

test('a survey keeps the band out of the way', async ($, on) => {
  await boot($, on)
  await $.session.measure(measure(95) as never)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })

  expect(await ui.find({ type: 'Text', text: /context/ })).toBeUndefined()
  await ui.unmount()
})

test('turned off, the band draws nothing of its own', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { 'status-band': false } } })
  await $.session.measure(measure(95) as never)
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /context/ })).toBeUndefined()
  await ui.unmount()
})
