import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { trackColor } from './line'

const ON = { prefs: { v: 1, enabled: { 'calm-spinner': true } } }

function spinner(mode = 'thinking', columns = 120) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'Spinner',
    requestId: 'agent-1',
    props: { word: 'Sauteing', message: null, suffix: '…', mode },
    viewport: { columns, rows: 40 },
  } as const
}

function turnEnd(props: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'TurnDuration',
    requestId: 'turn-1',
    props: { word: 'Baked', durationMs: 3000, ...props },
  } as const
}

// Cells back to text, to read what a packed row says.
function textOf(cells: string): string {
  const bytes = Uint8Array.from(atob(cells), char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  let out = ''

  for (let i = 0; i < bytes.length; i += 12) out += String.fromCodePoint(view.getUint32(i, true))

  return out.trimEnd()
}

test('turned off, the engine draws its own spinner', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { 'calm-spinner': false } } })
  const ui = await $.ui.mount(spinner() as never)

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('with no saved choice the spinner is on', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(spinner() as never)

  expect(await ui.find({ key: 'rich-ui-calm-spinner' })).toBeDefined()
  await ui.unmount()
})

test('on, the working row is one Raster line with the mode and the time', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(spinner() as never)

  const row = await ui.find({ key: 'rich-ui-calm-spinner' })
  expect(row).toBeDefined()
  expect(row?.props.rows).toBe(1)
  expect(textOf(row?.props.cells as string)).toMatch(/^ {2}[•·]{8} {2}thinking 0s$/)
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeUndefined()
  await ui.unmount()
})

test('the clock repaints the row, moving the highlight and the seconds', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner() as never)

  await clock.advance(3000)

  expect(new Set(blits.calls.map(blit => blit.cells)).size).toBeGreaterThan(10)
  const last = blits.calls.at(-1)
  expect(last?.requestId).toBe('agent-1')
  expect(last?.key).toBe('rich-ui-calm-spinner')
  expect(textOf(last!.cells)).toMatch(/^ {2}[•·]{8} {2}thinking 3s$/)
  await ui.unmount()
})

test('a row the surface no longer takes is dropped and stops being repainted', async ($, on) => {
  const { clock, blits } = await boot($, on, ON)
  const ui = await $.ui.mount(spinner() as never)

  blits.deny = 'not mounted'
  await clock.advance(10_000)
  const seen = blits.calls.length
  await clock.advance(10_000)

  expect(blits.calls.length).toBe(seen)
  await ui.unmount()
})

test('a narrow window drops the label and keeps the time', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(spinner('thinking', 12) as never)

  const row = await ui.find({ key: 'rich-ui-calm-spinner' })
  expect(row?.props.columns).toBe(10)
  expect(textOf(row?.props.cells as string)).toMatch(/^ {2}[•·] {2}0s$/)
  await ui.unmount()
})

test('a spinner off the terminal is left to the engine', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount({ ...spinner(), surface: 'desktop' } as never)

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('the turn-end line is a dim time', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(turnEnd() as never)

  const line = await ui.find({ type: 'Text', text: /3s/ })
  expect(line?.props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: /Baked/ })).toBeUndefined()
  await ui.unmount()
})

test('ctrl+o and a line waiting on agents keep the engine turn-end line', async ($, on) => {
  await boot($, on, ON)
  const expanded = await $.ui.mount(turnEnd({ isExpanded: true }) as never)
  expect(await expanded.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await expanded.unmount()

  const waiting = await $.ui.mount(
    turnEnd({ waitingFor: { agents: [{ id: 'a', agentType: 'x' }], workflows: 0 } }) as never,
  )
  expect(await waiting.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await waiting.unmount()
})

test('the background-task hint is emptied, and left alone when off', async ($, on) => {
  const { rendered } = await boot($, on, ON)
  const props = { tool_use_id: 't1', kind: 'background_hint', hint: '(ctrl+b to run in background)' }
  const hint = {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'ToolProgress',
    requestId: 'p1',
    props,
  } as const
  const ui = await $.ui.mount(hint as never)
  await ui.unmount()

  expect(rendered.at(-1)?.props).toEqual({ ...props, hint: '' })
})

test('turned off, the hint is passed as the engine drew it', async ($, on) => {
  const { rendered } = await boot($, on, { prefs: { v: 1, enabled: { 'calm-spinner': false } } })
  const props = { tool_use_id: 't1', kind: 'background_hint', hint: '(ctrl+b to run in background)' }
  const ui = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'ToolProgress',
    requestId: 'p1',
    props,
  } as never)
  await ui.unmount()

  expect(rendered.at(-1)?.props).toEqual(props)
})

test('the row has a blank line above it', async ($, on) => {
  await boot($, on, ON)
  const ui = await $.ui.mount(spinner() as never)

  expect((await ui.find({ type: 'Box' }))?.props.marginTop).toBe(1)
  await ui.unmount()
})

// The foreground of one cell of a packed row.
function foregroundAt(cells: string, column: number): number {
  const bytes = Uint8Array.from(atob(cells), char => char.charCodeAt(0))

  return new DataView(bytes.buffer).getUint32(column * 12 + 4, true)
}

// At time 0 the highlight is on the first track cell and the last is unlit.
for (const theme of ['dark', 'light'] as const) {
  test(`the track takes its colours from the ${theme} theme`, async ($, on) => {
    await boot($, on, ON, theme)
    const ui = await $.ui.mount(spinner() as never)
    const cells = (await ui.find({ key: 'rich-ui-calm-spinner' }))?.props.cells as string

    expect(foregroundAt(cells, 2)).toBe(trackColor(theme, 1))
    expect(foregroundAt(cells, 2 + 7)).toBe(trackColor(theme, 0))
    await ui.unmount()
  })
}

test('an unreadable or automatic theme uses the light colours', async ($, on) => {
  await boot($, on, ON, 'auto')
  const ui = await $.ui.mount(spinner() as never)
  const cells = (await ui.find({ key: 'rich-ui-calm-spinner' }))?.props.cells as string

  expect(foregroundAt(cells, 2 + 7)).toBe(trackColor('light', 0))
  await ui.unmount()
})
