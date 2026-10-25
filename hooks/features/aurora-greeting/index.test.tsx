import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { FRAME_MS } from '../aurora-common/aurora'
import { HOLD_MS, SWEEP_IN_MS, SWEEP_OUT_MS, TOTAL_MS, sweepAt } from '.'

const ON = { prefs: { v: 1, enabled: { 'aurora-greeting': true } } }

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

test('the sweep comes in, holds, then goes out', () => {
  expect(sweepAt(0)).toEqual({ from: 0, to: 0 })
  expect(sweepAt(SWEEP_IN_MS / 2)).toEqual({ from: 0, to: 0.5 })
  expect(sweepAt(SWEEP_IN_MS + HOLD_MS / 2)).toEqual({ from: 0, to: 1 })
  expect(sweepAt(SWEEP_IN_MS + HOLD_MS + SWEEP_OUT_MS / 2)).toEqual({ from: 0.5, to: 1 })
  expect(sweepAt(TOTAL_MS)).toEqual({ from: 1, to: 1 })
  expect(sweepAt(TOTAL_MS * 3).from).toBe(1)
})

test('off by default: the band is the engine own', async ($, on) => {
  const { clock, blits } = await boot($, on)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await clock.advance(5000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('on: a Raster over the engine band, repainted until the sweep is done', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()

  await clock.advance(TOTAL_MS + 1000)
  const total = blits.calls.length

  expect(total).toBeGreaterThanOrEqual(Math.floor(TOTAL_MS / FRAME_MS) - 2)
  expect(total).toBeLessThanOrEqual(Math.ceil(TOTAL_MS / FRAME_MS) + 1)
  expect(blits.calls.every(c => c.key === 'aurora-greeting' && c.requestId === 'band-1')).toBe(true)
  await clock.advance(5000)
  expect(blits.calls).toHaveLength(total)
  await ui.unmount()
})

test('once played, a later draw hands the band back to the engine', async ($, on) => {
  const { clock } = await boot($, on, ON)
  const first = await $.ui.mount(band())
  await clock.advance(TOTAL_MS + 500)
  await first.unmount()

  const again = await $.ui.mount(band({ requestId: 'band-2' }))

  expect(await again.find({ type: 'Raster' })).toBeUndefined()
  await again.unmount()
})

test('a redraw during the sweep keeps drawing it, not a restart', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const first = await $.ui.mount(band())
  await clock.advance(1000)
  await first.unmount()
  const second = await $.ui.mount(band({ requestId: 'band-2' }))
  blits.calls.length = 0

  await clock.advance(TOTAL_MS)

  // Only what is left of the sweep (about 1.8 s), not another full one.
  expect(await second.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil((TOTAL_MS - 1000) / FRAME_MS) + 1)
  await second.unmount()
})

test('/clear lets it play once more', async ($, on) => {
  const { clock } = await boot($, on, ON)
  const first = await $.ui.mount(band())
  await clock.advance(TOTAL_MS + 500)
  await first.unmount()

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} } as never)
  const again = await $.ui.mount(band({ requestId: 'band-3' }))

  expect(await again.find({ type: 'Raster' })).toBeDefined()
  await again.unmount()
})

test('a survey or a working turn keeps it from starting', async ($, on) => {
  await boot($, on, ON)
  const survey = await $.ui.mount(band({}, { hasSurvey: true }))
  expect(await survey.find({ type: 'Raster' })).toBeUndefined()
  await survey.unmount()

  const working = await $.ui.mount(band({ requestId: 'band-2' }, { isWorking: true }))
  expect(await working.find({ type: 'Raster' })).toBeUndefined()
  await working.unmount()
})

test('a narrow or unmeasured window, or another surface, keeps the engine band', async ($, on) => {
  const { blits, clock } = await boot($, on, ON)
  for (const overrides of [
    { viewport: { columns: 40, rows: 40 } },
    { viewport: { columns: 120, rows: 10 } },
    { viewport: undefined },
    { surface: 'desktop' },
  ]) {
    const ui = await $.ui.mount(band(overrides))
    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    await ui.unmount()
  }
  await clock.advance(2000)
  expect(blits.calls).toHaveLength(0)
})

test('session end stops a sweep in progress', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  await clock.advance(500)

  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('turning it off mid-sweep stops it', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  await clock.advance(500)
  const pane = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'rich-ui',
    props: { title: 'rich-ui', placement: 'dock', bodyColumns: 80, view: {} },
  } as never)

  await pane.press({ key: 'aurora-greeting' })
  await clock.settle()
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls.length).toBeLessThanOrEqual(after + 1)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})
