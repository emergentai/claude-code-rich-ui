import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { FRAME_MS } from '../aurora-common/aurora'
import { MAX_COLUMNS } from '.'
import { BANNER_ROWS, TOTAL_MS } from './nyan'

const ON = { prefs: { v: 1, enabled: { 'nyan-greeting': true } } }

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

test('off by default: the band is the engine own', async ($, on) => {
  const { clock, blits } = await boot($, on)
  const ui = await $.ui.mount(band())

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await clock.advance(6000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('on: a banner as wide as the band, over the engine band, repainted until the cat is gone', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  const raster = (await ui.find({ type: 'Raster' })) as unknown as { props: { columns: number; rows: number } }

  expect(raster.props.columns).toBe(100)
  expect(raster.props.rows).toBe(BANNER_ROWS)
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()

  await clock.advance(TOTAL_MS + 1000)
  const total = blits.calls.length
  expect(total).toBeGreaterThanOrEqual(Math.floor(TOTAL_MS / FRAME_MS) - 2)
  expect(total).toBeLessThanOrEqual(Math.ceil(TOTAL_MS / FRAME_MS) + 1)
  expect(blits.calls.every(c => c.key === 'nyan-greeting' && c.requestId === 'band-1')).toBe(true)
  expect(new Set(blits.calls.map(c => c.cells)).size).toBeGreaterThan(total / 2)
  await clock.advance(5000)
  expect(blits.calls).toHaveLength(total)
  await ui.unmount()
})

test('it spans a wide window up to the Raster limit', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(band({ viewport: { columns: 600, rows: 40 } }, { bodyColumns: 595 }))
  const raster = (await ui.find({ type: 'Raster' })) as unknown as { props: { columns: number } }

  expect(raster.props.columns).toBe(MAX_COLUMNS)
  expect(MAX_COLUMNS).toBeLessThanOrEqual(512)
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

test('a redraw during the flight carries on, not a restart', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const first = await $.ui.mount(band())
  await clock.advance(2000)
  await first.unmount()
  const second = await $.ui.mount(band({ requestId: 'band-2' }))
  blits.calls.length = 0

  await clock.advance(TOTAL_MS)

  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil((TOTAL_MS - 2000) / FRAME_MS) + 1)
  await second.unmount()
})

test('/clear lets it fly once more', async ($, on) => {
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

test('session end stops a flight in progress', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  await clock.advance(1000)

  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  const after = blits.calls.length
  await clock.advance(6000)

  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('every blit denied ends the timer on its own', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  blits.deny = 'not mounted'

  await clock.advance(FRAME_MS * 60)
  const after = blits.calls.length
  await clock.advance(6000)

  expect(after).toBeLessThanOrEqual(26)
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('turning it off mid-flight stops it', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(band())
  await clock.advance(800)
  const pane = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'rich-ui',
    props: { title: 'rich-ui', placement: 'dock', bodyColumns: 80, view: {} },
  } as never)

  await pane.press({ key: 'nyan-greeting' })
  await clock.settle()
  const after = blits.calls.length
  await clock.advance(6000)

  expect(blits.calls.length).toBeLessThanOrEqual(after + 1)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('pressing Enter (a turn starts) ends it at once: the engine band is back and nothing more is painted', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const playing = await $.ui.mount(band())
  await clock.advance(500)
  expect(await playing.find({ type: 'Raster' })).toBeDefined()
  await playing.unmount()

  // The band is drawn again with a turn running, as the engine does when the prompt is sent.
  const working = await $.ui.mount(band({ requestId: 'band-2' }, { isWorking: true }))
  const after = blits.calls.length
  await clock.advance(6000)

  expect(await working.find({ type: 'Raster' })).toBeUndefined()
  expect(await working.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(blits.calls).toHaveLength(after)
  await working.unmount()

  // And it does not come back once the turn is over.
  const idle = await $.ui.mount(band({ requestId: 'band-3' }))
  expect(await idle.find({ type: 'Raster' })).toBeUndefined()
  await idle.unmount()
})
