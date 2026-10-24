import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { FRAME_MS } from './aurora'
import { MAX_MISSES } from '.'

const ON = { prefs: { v: 1, enabled: { 'aurora-spinner': true } } }

function spinner(overrides: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Spinner',
    requestId: 'main',
    props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
    viewport: { columns: 120, rows: 40 },
    ...overrides,
  } as never
}

const complete = ($: Parameters<typeof boot>[0], agentId?: string) =>
  $.turn.complete({
    answer: 'done',
    durationMs: 5000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    ...(agentId === undefined ? {} : { agentId }),
  } as never)

test('off by default: the stock spinner is drawn and no timer runs', async ($, on) => {
  const { clock, blits } = await boot($, on)
  const ui = await $.ui.mount(spinner())

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await clock.advance(2000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('on: the stock line stays whole beneath a Raster', async ($, on) => {
  const { blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())

  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  // The engine's own drawing (word, elapsed time, esc hint) is in the tree untouched.
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('the timer repaints the Raster at the frame rate and no faster', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())

  await clock.advance(1000)

  expect(FRAME_MS).toBeGreaterThanOrEqual(66)
  expect(blits.calls.length).toBeGreaterThanOrEqual(10)
  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / FRAME_MS))
  expect(blits.calls.every(c => c.requestId === 'main' && c.key === 'aurora')).toBe(true)
  expect(new Set(blits.calls.map(c => c.cells)).size).toBe(blits.calls.length)
  await ui.unmount()
})

test('a redraw replaces the timer; it never runs two', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(500)
  await ui.unmount()
  // The word changed: the engine draws the site again, which starts a fresh timer.
  const ui2 = await $.ui.mount(spinner({ props: { word: 'Pondering', message: null, suffix: '…', mode: 'tool-use' } }))
  blits.calls.length = 0

  await clock.advance(1000)

  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / FRAME_MS))
  await ui2.unmount()
})

test('the turn ending stops the timer at once', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(400)
  expect(blits.calls.length).toBeGreaterThan(0)

  const result = await complete($)
  const after = blits.calls.length
  await clock.advance(5000)

  expect(result.text).toBe('done')
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('an interrupted turn stops it too', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(400)

  await $.turn.complete({ answer: '', durationMs: 900, isAborted: true, turnId: 't1', reason: 'aborted' } as never)
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test("a subagent's turn ending leaves the main spinner painting", async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(400)
  const before = blits.calls.length

  await complete($, 'agent-7')
  await clock.advance(400)

  expect(blits.calls.length).toBeGreaterThan(before)
  await ui.unmount()
})

test('a second spinner takes over the one timer; two never run at once', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const first = await $.ui.mount(spinner({ requestId: 'uuid-1' }))
  await clock.advance(400)
  const second = await $.ui.mount(spinner({ requestId: 'uuid-2' }))
  blits.calls.length = 0

  await clock.advance(1000)

  expect(blits.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / FRAME_MS))
  expect(blits.calls.every(c => c.requestId === 'uuid-2')).toBe(true)
  await second.unmount()
  await first.unmount()
})

async function sessionEndStops(reason: string, $: Parameters<typeof boot>[0], on: Parameters<typeof boot>[1]) {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(400)
  expect(blits.calls.length).toBeGreaterThan(0)

  await $.session.end({ reason, sessionId: 's1', resume: {} } as never)
  const after = blits.calls.length
  await clock.advance(5000)

  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
}

test('/clear stops it', ($, on) => sessionEndStops('clear', $, on))

test('any other session end stops it', ($, on) => sessionEndStops('other', $, on))

test('turning the feature off redraws the stock spinner and stops the timer', async ($, on) => {
  const { clock, blits, saved } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(400)
  expect(await ui.find({ type: 'Raster' })).toBeDefined()

  const pane = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'rich-ui',
    props: { title: 'rich-ui', placement: 'dock', bodyColumns: 80, view: {} },
  } as never)
  await pane.press({ key: 'aurora-spinner' })
  await clock.settle()
  const after = blits.calls.length
  await clock.advance(5000)

  expect(saved.get('prefs')).toMatchObject({ enabled: { 'aurora-spinner': false } })
  expect(blits.calls).toHaveLength(after)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a spinner that unmounted (every blit denied) stops itself after a short run of misses', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  blits.deny = 'nothing of this plugin is mounted there'

  await clock.advance(FRAME_MS * (MAX_MISSES + 20))
  const after = blits.calls.length
  await clock.advance(5000)

  expect(after).toBeLessThanOrEqual(MAX_MISSES + 1)
  expect(blits.calls).toHaveLength(after)
  await ui.unmount()
})

test('one denied frame (a resize) does not stop the animation', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  blits.deny = 'another size'
  await clock.advance(FRAME_MS * 3)
  blits.deny = undefined
  const before = blits.calls.length

  await clock.advance(FRAME_MS * 10)

  expect(blits.calls.length).toBeGreaterThan(before + 5)
  await ui.unmount()
})

test('a host slower than a frame drops frames instead of queueing them', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  blits.delayMs = 400

  await clock.advance(2000)

  // One blit in flight at a time: at most one per 400 ms, not one per 80.
  expect(blits.calls.length).toBeLessThanOrEqual(7)
  expect(blits.calls.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('a narrow window keeps the stock spinner and runs no timer', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner({ viewport: { columns: 40, rows: 40 } }))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await clock.advance(1000)
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('a short window keeps the stock spinner', async ($, on) => {
  const { blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner({ viewport: { columns: 120, rows: 15 } }))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('a window that shrinks below the minimum drops the timer', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner())
  await clock.advance(300)
  await ui.unmount()
  // The window shrank: the site is drawn again, narrow, and the timer is dropped.
  const narrow = await $.ui.mount(spinner({ viewport: { columns: 30, rows: 40 } }))
  const frozen = blits.calls.length
  await clock.advance(1000)

  expect(blits.calls).toHaveLength(frozen)
  await narrow.unmount()
})

test('no measured window keeps the stock spinner', async ($, on) => {
  const { blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner({ viewport: undefined }))

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(blits.calls).toHaveLength(0)
  await ui.unmount()
})

test('other surfaces are left alone', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  for (const surface of ['desktop', 'vscode', 'mobile']) {
    const ui = await $.ui.mount(spinner({ surface }))
    await clock.advance(500)
    await ui.unmount()
  }

  expect(blits.calls).toHaveLength(0)
})

// Mean brightness of a frame's colours, decoded from the Raster's cells.
function brightness(cells: string | undefined): number {
  const bytes = Uint8Array.from(atob(cells ?? ''), c => c.charCodeAt(0))
  let sum = 0
  let n = 0
  for (let i = 0; i < bytes.length; i += 12) {
    for (const o of [4, 8]) {
      sum += (bytes[i + o + 2] as number) + (bytes[i + o + 1] as number) + (bytes[i + o] as number)
      n += 3
    }
  }

  return sum / n
}

test('the theme setting is read when the spinner is drawn: light paints brighter than dark', async ($, on) => {
  const { clock, blits, config } = await boot($, on, ON)
  config.theme = 'dark'
  const dark = await $.ui.mount(spinner())
  await clock.advance(FRAME_MS)
  const darkFrame = blits.calls.at(-1)?.cells
  await dark.unmount()

  config.theme = 'light'
  const light = await $.ui.mount(spinner())
  await clock.advance(FRAME_MS)
  const lightFrame = blits.calls.at(-1)?.cells

  expect(darkFrame).toBeDefined()
  expect(brightness(lightFrame)).toBeGreaterThan(brightness(darkFrame) + 20)
  await light.unmount()
})
