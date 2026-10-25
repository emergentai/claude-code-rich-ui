import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { FRAME_MS, MAX_MISSES } from '../aurora-common/aurora'

const ON = { prefs: { v: 1, enabled: { 'aurora-meter': true } } }

function band(overrides: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AbovePrompt',
    requestId: 'band-1',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, ...props },
    viewport: { columns: 120, rows: 40 },
    ...overrides,
  } as never
}

const measure = ($: Parameters<typeof boot>[0], context: number, limits: { kind: string; percentUsed: number }[] = []) =>
  $.session.measure({
    context: { window: 200_000, percent: context },
    rateLimits: limits,
    changed: ['context'],
  } as never)

test('off by default: nothing is added above the prompt', async ($, on) => {
  await boot($, on)
  await measure($, 80)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('a healthy session draws nothing', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 20)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await clock.advance(1000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('a high context shows a gradient bar with its label and percent, over the engine band', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 72)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'context ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 72%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await clock.advance(1000)
  expect(blits.calls.length).toBeGreaterThan(5)
  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / FRAME_MS))
  expect(blits.calls.every(c => c.key === 'aurora-meter')).toBe(true)
  await ui.unmount()
})

test('a plan limit shows as text beside the bar, in the status band order', async ($, on) => {
  await boot($, on, ON)
  await measure($, 65, [{ kind: 'five_hour', percentUsed: 88 }])
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h 88%/ })).toBeDefined()
  await ui.unmount()
})

test('a limit alone has no bar and no timer', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 20, [{ kind: 'five_hour', percentUsed: 88 }])
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Text', text: /5h 88%/ })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await clock.advance(1000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('the status band text line is cleared while the meter is on, and back when it is off', async ($, on) => {
  const { clock, status } = await boot($, on, ON)
  await measure($, 80)
  expect(status.line).toBeUndefined()

  const pane = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'rich-ui',
    props: { title: 'rich-ui', placement: 'dock', bodyColumns: 80, view: {} },
  } as never)
  await pane.press({ key: 'aurora-meter' })
  await clock.settle()

  expect(status.line).toMatch(/context .* 80%/)
  await pane.unmount()
})

test('the usage dropping below the threshold removes the bar and stops the timer', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 80)
  const ui = await $.ui.mount(band())
  await clock.advance(400)

  await measure($, 10)
  await clock.settle()
  const after = blits.calls.length
  await clock.advance(3000)

  expect(blits.calls.length).toBeLessThanOrEqual(after + 1)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('a survey holds the band: no meter', async ($, on) => {
  await boot($, on, ON)
  await measure($, 90)
  const ui = await $.ui.mount(band({}, { hasSurvey: true }))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('a narrow band, or another surface, keeps the engine band', async ($, on) => {
  await boot($, on, ON)
  await measure($, 90)
  for (const overrides of [{ surface: 'desktop' }]) {
    const ui = await $.ui.mount(band(overrides))
    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    await ui.unmount()
  }
  const narrow = await $.ui.mount(band({ requestId: 'band-2' }, { bodyColumns: 30 }))
  expect(await narrow.find({ type: 'Raster' })).toBeUndefined()
  await narrow.unmount()
})

test('session end and a run of denied blits stop it', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 80)
  const ui = await $.ui.mount(band())
  await clock.advance(400)
  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  const after = blits.calls.length
  await clock.advance(3000)
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('every blit denied ends the timer on its own', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  await measure($, 80)
  const ui = await $.ui.mount(band())
  blits.deny = 'not mounted'

  await clock.advance(FRAME_MS * (MAX_MISSES + 20))
  const after = blits.calls.length
  await clock.advance(5000)

  expect(after).toBeLessThanOrEqual(MAX_MISSES + 1)
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})
