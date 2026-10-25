import { expect, test } from 'claude-code/testing'

import { boot } from '../core/test-harness'
import { VERSION } from '../core/version'

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

test('the pane lists each feature with a checkbox and a footer', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const row = await ui.find({ key: 'mermaid' })
  expect(row?.text).toContain('[x]')
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

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[ ]')
  expect(JSON.stringify(saved.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: { mermaid: false } }),
  )

  await ui.press({ key: 'mermaid' })
  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[x]')
  await ui.unmount()
})

test('a failed save keeps the toggle and shows a notice', async ($, on) => {
  const { clock, failSaves } = await boot($, on)
  failSaves.on = true
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[ ]')
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

test('the welcome text is typed into the pane, cleaned and saved with the choices', async ($, on) => {
  const { clock, saved } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'welcome' })
  await ui.input({ key: 'welcome-text-0', text: 'Hello World!!!!!!!!!' })
  await clock.settle()

  // Saved: the field is drawn again, as a new element carrying the saved text.
  expect(await ui.find({ key: 'welcome-text-0' })).toBeUndefined()
  expect((await ui.find({ key: 'welcome-text-1' }))?.props).toMatchObject({ value: 'hello world!' })
  expect(JSON.stringify(saved.get('prefs'))).toBe(
    JSON.stringify({ v: 1, enabled: {}, welcome: 'hello world!' }),
  )
  await ui.unmount()
})

test('a saved welcome text comes back in the pane', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: {}, welcome: 'hi team' } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ key: 'welcome-text-0' }))?.props).toMatchObject({ value: 'hi team' })
  await ui.unmount()
})

test('saving the same text again redraws the field too, so it never stays blank', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.input({ key: 'welcome-text-0', text: 'hello' })
  await clock.settle()
  await ui.input({ key: 'welcome-text-1', text: 'hello' })
  await clock.settle()

  expect((await ui.find({ key: 'welcome-text-2' }))?.props).toMatchObject({ value: 'hello' })
  await ui.unmount()
})

test('toggling a feature after saving the text keeps the field and its text', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'welcome-text-0', text: 'hey' })
  await clock.settle()

  await ui.press({ key: 'status-band' })
  await clock.settle()

  expect((await ui.find({ key: 'welcome-text-1' }))?.props).toMatchObject({ value: 'hey' })
  await ui.unmount()
})
