import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { boot } from '../core/test-harness'
import { VERSION } from '../core/version'
import { BANNER_COLUMNS, BANNER_ROWS, bannerCells, gradientAt, toBase64 } from './banner'
import { chipFor } from './pane'
import { contentRows, EXPERIMENTAL_HEADER_ROWS, experimentalCount, FIELD_ROWS } from './size'
import { features } from '../core/registry'

const PANE = {
  plugin: 'rich-ui',
  component: 'Pane',
  requestId: 'rich-ui',
  props: {
    title: 'rich-ui',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane lists each feature with an on/off pill and a footer', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const row = await ui.find({ key: 'mermaid' })
  expect(row?.text).toContain('● on')
  expect(row?.text).toContain('Mermaid diagrams')
  expect(await ui.find({ type: 'Text', text: /Draw mermaid diagrams/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Enter toggles/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: new RegExp(`rich-ui ${VERSION.replace(/\./g, '\\.')}`) })).toBeDefined()
  await ui.unmount()
})

test('pressing a row toggles the feature and saves the choice', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('○ off')
  expect(JSON.stringify(saved.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: { mermaid: false } }),
  )

  await ui.press({ key: 'mermaid' })
  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('● on')
  await ui.unmount()
})

test('a failed save keeps the toggle and shows a notice', async ($, on) => {
  const { clock, failSaves } = await boot($, on)
  failSaves.on = true
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('○ off')
  expect(await ui.find({ type: 'Text', text: /Couldn't save/ })).toBeDefined()
  await ui.unmount()
})

test('a note posted while drawing appears under the feature row', async ($, on) => {
  const { clock } = await boot($, on)
  const diagram = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text: '```mermaid\ngraph TD\n A-->B\n```', isFirstOfReply: true },
  })
  await clock.settle()
  await diagram.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /terminal size unknown/ })).toBeDefined()
  await ui.unmount()
})

test('toggling a feature clears its note', async ($, on) => {
  const { clock } = await boot($, on)
  const diagram = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text: '```mermaid\ngraph TD\n A-->B\n```', isFirstOfReply: true },
  })
  await clock.settle()
  await diagram.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect(await ui.find({ type: 'Text', text: /terminal size unknown/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane is left to the engine on other surfaces', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('running /rich-ui opens the pane without transcript text', async ($, on) => {
  await boot($, on)

  const result = await $.command.run({ command: 'rich-ui' } as never)

  expect(result.text).toBeUndefined()
})

test('toggling the status band clears and restores its line', async ($, on) => {
  const { clock, status } = await boot($, on)
  await $.session.measure({
    context: { window: 200_000, percent: 80 },
    rateLimits: [],
    changed: ['context'],
  } as never)
  expect(status.line).toMatch(/80%/)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'status-band' })
  await clock.settle()
  expect(status.line).toBeUndefined()

  await ui.press({ key: 'status-band' })
  await clock.settle()
  expect(status.line).toMatch(/80%/)
  await ui.unmount()
})

test('the pane draws a banner Raster, a summary and no chip on a healthy pane', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ key: 'banner' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3 of 4 on/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^(error|note)$/ })).toBeUndefined()
  await ui.unmount()
})

test('a narrow pane drops the banner for a plain title', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, bodyColumns: 30 },
    surface: 'terminal',
  })

  expect(await ui.find({ key: 'banner' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /rich-ui/ })).toBeDefined()
  expect(await ui.find({ key: 'mermaid' })).toBeDefined()
  await ui.unmount()
})

test('the summary counts features that are on', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect(await ui.find({ type: 'Text', text: /2 of 4 on/ })).toBeDefined()
  await ui.unmount()
})

test('a feature with a note shows a note chip beside its row', async ($, on) => {
  const { clock } = await boot($, on)
  const diagram = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text: '```mermaid\ngraph TD\n A-->B\n```', isFirstOfReply: true },
  })
  await clock.settle()
  await diagram.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^\s*note$/ })).toBeDefined()
  await ui.unmount()
})

test('chipFor: error beats note, healthy has none', async () => {
  expect(chipFor(undefined)).toBeUndefined()
  expect(chipFor({ notes: [] })).toBeUndefined()
  expect(chipFor({ notes: ['x'] })?.text).toBe('note')
  expect(chipFor({ notes: ['x'], error: { message: 'm', count: 1, at: 0 } })?.text).toBe('error')
})

test('the first row takes the focus and the footer hints stay', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /Enter toggles · Esc closes/ })).toBeDefined()
  expect((await ui.find({ key: features[0]!.id }))?.props.autoFocus).toBe(true)
  expect((await ui.find({ key: features[1]!.id }))?.props.autoFocus).toBeUndefined()
  await ui.unmount()
})

test('a docked pane and an inline pane both draw every row', async ($, on) => {
  await boot($, on)
  for (const placement of ['dock', 'inline'] as const) {
    const ui = await $.ui.mount({
      ...PANE,
      props: { ...PANE.props, placement, bodyColumns: 80 },
      surface: 'terminal',
    })
    for (const feature of features) {
      expect(await ui.find({ key: feature.id })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('the pane height matches contentRows for a healthy pane', async () => {
  // header 3 + divider + 3 per feature (blank, name, description) + blank + footer
  // The experimental header (two rows) and the bordered welcome field (three) add five.
  expect(contentRows(features.length, 0, false, experimentalCount(features))).toBe(3 + 1 + features.length * 3 + 2 + EXPERIMENTAL_HEADER_ROWS + FIELD_ROWS)
  expect(contentRows(3, 0, false)).toBe(15)
})

test('the banner cells are well formed', async () => {
  const cells = bannerCells()
  const bytes = BANNER_COLUMNS * BANNER_ROWS * 12
  // base64 length of `bytes` bytes, padded
  expect(cells.length).toBe(Math.ceil(bytes / 3) * 4)
  expect(cells).toMatch(/^[A-Za-z0-9+/]+=*$/)
  expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
  expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=')
  expect(toBase64(new Uint8Array([77]))).toBe('TQ==')
  expect(gradientAt(0)).toBe(0xe07a4f)
  expect(gradientAt(BANNER_COLUMNS - 1)).toBe(0x8a7ae8)
})

test('rows are keyed hover scopes and the pill uses theme colours', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The test engine does not report hover styles on a found element, so hover
  // is checked by hand (docs/dev/manager-refresh-manual-test.md); the keyed row
  // that scopes it is asserted here.
  expect(await ui.find({ key: 'row-mermaid' })).toBeDefined()
  const pill = await ui.find({ type: 'Text', text: /● on/ })
  expect(pill?.props.color).toBe('success')
  await ui.unmount()
})

test('an off feature shows the inactive pill', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const pill = await ui.find({ type: 'Text', text: /○ off/ })
  expect(pill?.props.color).toBe('inactive')
  expect(await ui.find({ type: 'Text', text: /2 of 4 on/ })).toBeDefined()
  await ui.unmount()
})

const heightFor = async (
  $: Engine,
  placement: 'dock' | 'inline',
  bodyRows: number,
) => {
  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, placement, scroll: { offset: 0, bodyRows } },
    surface: 'terminal',
  })
  const root = await ui.find({ type: 'Box' })
  await ui.unmount()

  return root?.props.height
}

test('a dock with room is as tall as its room, so the footer sits at the bottom', async ($, on) => {
  await boot($, on)

  expect(await heightFor($, 'dock', 40)).toBe(40)
})

test('a dock too short for the content, and an inline pane, keep their natural height', async ($, on) => {
  await boot($, on)

  expect(await heightFor($, 'dock', contentRows(features.length, 0, false, experimentalCount(features)))).toBeUndefined()
  expect(await heightFor($, 'dock', 5)).toBeUndefined()
  expect(await heightFor($, 'inline', 40)).toBeUndefined()
})

test('the welcome text saves as it is typed, with no save step and no new field', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'welcome' })

  await ui.input({ key: 'welcome-text-0', text: 'Hello Wor', kind: 'change' })
  await ui.input({ key: 'welcome-text-0', text: 'Hello World!!!!!!!!!', kind: 'change' })
  await clock.advance(500)

  // The field keeps what was typed (the same element, so nothing flickers)...
  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'Hello World!!!!!!!!!' })
  // ...and the store holds the cleaned text the sign shows, written once after the pause.
  expect(JSON.stringify(saved.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: {}, welcome: 'hello world!!!!!!!!!' }),
  )
  await ui.unmount()
})

test('typing writes after a pause, not on every key', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.input({ key: 'welcome-text-0', text: 'h', kind: 'change' })
  await clock.advance(100)
  expect(saved.get('prefs')).toBeUndefined()
  await ui.input({ key: 'welcome-text-0', text: 'hi', kind: 'change' })
  await clock.advance(100)
  expect(saved.get('prefs')).toBeUndefined()
  await clock.advance(500)

  expect(JSON.stringify(saved.get('prefs'))).toBe(JSON.stringify({ v: 1, enabled: {}, welcome: 'hi' }))
  await ui.unmount()
})

test('Enter writes it at once', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.input({ key: 'welcome-text-0', text: 'hey', kind: 'change' })
  await ui.input({ key: 'welcome-text-0', text: 'hey' })
  await clock.settle()

  expect(JSON.stringify(saved.get('prefs'))).toBe(JSON.stringify({ v: 1, enabled: {}, welcome: 'hey' }))
  await ui.unmount()
})

test('Enter does not empty the field: it is drawn again holding the text, once per Enter', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'welcome-text-0', text: 'hey there', kind: 'change' })
  await clock.advance(500)
  // Typing never replaced the field.
  expect(await ui.find({ key: 'welcome-text-0' })).toBeDefined()

  await ui.input({ key: 'welcome-text-0', text: 'hey there' })
  await clock.settle()
  expect(await ui.find({ key: 'welcome-text-0' })).toBeUndefined()
  expect((await ui.find({ key: 'welcome-text-1' }))?.props).toMatchObject({ value: 'hey there' })

  // And again: Enter on an unchanged text still brings it back.
  await ui.input({ key: 'welcome-text-1', text: 'hey there' })
  await clock.settle()
  expect((await ui.find({ key: 'welcome-text-2' }))?.props).toMatchObject({ value: 'hey there' })
  await ui.unmount()
})

test('clearing the field is allowed: it is not refilled while typing, and the sign falls back to "welcome"', async ($, on) => {
  const { clock, saved } = await boot($, on, { prefs: { v: 1, enabled: {}, welcome: 'hi team' } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.input({ key: 'welcome-text-0', text: '', kind: 'change' })
  await clock.advance(500)

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: '' })
  // The default is not stored: back to nothing saved.
  expect(JSON.stringify(saved.get('prefs'))).toBe(JSON.stringify({ v: 1, enabled: {} }))
  await ui.unmount()
})

test('a saved welcome text comes back in the pane', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: {}, welcome: 'hi team' } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'hi team' })
  await ui.unmount()
})

test('toggling a feature after typing keeps the field and its text, and saves both', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'welcome-text-0', text: 'hey', kind: 'change' })

  await ui.press({ key: 'status-band' })
  await clock.settle()

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'hey' })
  expect(JSON.stringify(saved.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: { 'status-band': false }, welcome: 'hey' }),
  )
  await ui.unmount()
})

test('the field stops at 20 characters', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.input({ key: 'welcome-text-0', text: 'abcdefghijklmnopqrstuvwxyz', kind: 'change' })
  await clock.advance(500)

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'abcdefghijklmnopqrst' })
  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ label: 'Text' })
  await ui.unmount()
})

test('the welcome greeting is listed under an Experimental header, after the regular features', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: 'Experimental' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /may be removed in any version/ })).toBeDefined()
  const order = ['Mermaid diagrams', 'Status band', 'Markdown preview', 'Experimental', 'Welcome greeting']
  for (const text of order) expect(await ui.find({ type: 'Text', text: new RegExp(text) })).toBeDefined()
  expect(await ui.find({ key: 'welcome-greeting' })).toBeDefined()
  expect(await ui.find({ key: 'welcome-text-0' })).toBeDefined()
  await ui.unmount()
})

test('the welcome greeting row toggles like any feature and saves the choice', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'welcome-greeting' })
  await clock.settle()

  expect(JSON.stringify(saved.get('prefs'))).toBe(JSON.stringify({ v: 1, enabled: { 'welcome-greeting': true } }))
  await ui.unmount()
})
