import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { FRAME_MS, MAX_MISSES, wordmarkWidth } from '../aurora-common/aurora'
import { WORDMARK } from '.'

const ON = { prefs: { v: 1, enabled: { 'aurora-header': true } } }

function pane(bodyColumns = 80, surface = 'terminal') {
  return {
    plugin: 'rich-ui',
    surface,
    component: 'Pane',
    requestId: 'rich-ui',
    props: { title: 'rich-ui', placement: 'dock', bodyColumns, view: {} },
  } as never
}

test('off by default: the pane has no header', async ($, on) => {
  const { clock, blits } = await boot($, on)
  const ui = await $.ui.mount(pane())

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'rich-ui features' })).toBeDefined()
  await clock.advance(2000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('on: the wordmark sits above the manager rows, which are all still there', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(pane())

  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'rich-ui features' })).toBeDefined()
  expect(await ui.find({ key: 'aurora-header' })).toBeDefined()
  await clock.advance(1000)
  expect(blits.calls.length).toBeGreaterThan(5)
  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / FRAME_MS))
  expect(blits.calls.every(c => c.key === 'aurora-header' && c.requestId === 'rich-ui')).toBe(true)
  await ui.unmount()
})

test('the Raster is exactly as wide as the wordmark', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(pane())
  const raster = (await ui.find({ type: 'Raster' })) as unknown as { props: { columns: number; rows: number } }

  expect(raster.props.columns).toBe(wordmarkWidth(WORDMARK))
  expect(raster.props.rows).toBe(3)
  await ui.unmount()
})

test('a pane too narrow for the wordmark is drawn without it', async ($, on) => {
  const { blits, clock } = await boot($, on, ON)
  const ui = await $.ui.mount(pane(20))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'rich-ui features' })).toBeDefined()
  await clock.advance(1000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('a closed pane (every blit denied) ends the timer after a short run', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(pane())
  blits.deny = 'nothing of this plugin is mounted there'

  await clock.advance(FRAME_MS * (MAX_MISSES + 20))
  const after = blits.calls.length
  await clock.advance(5000)

  expect(after).toBeLessThanOrEqual(MAX_MISSES + 1)
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('session end stops it', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(pane())
  await clock.advance(400)

  await $.session.end({ reason: 'other', sessionId: 's1', resume: {} } as never)
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('turning the header off redraws the pane without it and stops the timer', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(pane())
  await clock.advance(400)

  await ui.press({ key: 'aurora-header' })
  await clock.settle()
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls.length).toBeLessThanOrEqual(after + 1)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('other surfaces get the manager pane alone', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(pane(80, 'desktop'))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('running /rich-ui reserves the header rows only while it is on', async ($, on) => {
  const { opened } = await boot($, on, ON)
  await $.command.run({ command: 'rich-ui' } as never)

  expect(opened).toContain('rich-ui')
})
