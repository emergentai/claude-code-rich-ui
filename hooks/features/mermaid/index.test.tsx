import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const FLOW = ['graph TD', '  A[Start] --> B{Valid?}', '  B -->|yes| C[Done]'].join('\n')

function reply(source: string) {
  return ['Here is the flow:', '', '```mermaid', source, '```', '', 'Does that match?'].join('\n')
}

function message(text: string, viewport?: { columns: number; rows: number }) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text, isFirstOfReply: true },
    ...(viewport ? { viewport } : {}),
  } as const
}

const ROOMY = { columns: 120, rows: 60 }

test('a diagram replaces the fence and text around it is kept', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  expect(await ui.find({ type: 'Markdown', text: /Here is the flow/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /Does that match/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeUndefined()
  await ui.unmount()
})

test('the toggle swaps the diagram for the source and back', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  await ui.press({ key: 'toggle1' })
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeUndefined()
  expect((await ui.find({ key: 'toggle1' }))?.text).toContain('show diagram')

  await ui.press({ key: 'toggle1' })
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  await ui.unmount()
})

test('an unsupported diagram type stays a code block', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply('gantt\n  title Plan'), ROOMY))

  expect(await ui.find({ type: 'Markdown', text: /gantt/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('a diagram too big for the window stays a code block', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), { columns: 20, rows: 12 }))

  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('an unknown window size leaves the code and posts a note', async ($, on) => {
  const { clock } = await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW)))
  await clock.settle()

  // The engine draws it; the note itself is checked in the manager pane tests.
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a reply with no mermaid is left to the engine', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message('plain words only', ROOMY))

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a disabled feature is left to the engine', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('desktop is left to the engine', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...message(reply(FLOW), ROOMY), surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('the first block of a reply carries the bullet, later blocks do not', async ($, on) => {
  await boot($, on)
  const first = await $.ui.mount(message(reply(FLOW), ROOMY))
  expect(await first.find({ type: 'Text', text: '⏺' })).toBeDefined()
  await first.unmount()

  const later = await $.ui.mount({
    ...message(reply(FLOW), ROOMY),
    props: { text: reply(FLOW), isFirstOfReply: false },
  })
  expect(await later.find({ type: 'Text', text: '⏺' })).toBeUndefined()
  expect(await later.find({ key: 'toggle1' })).toBeDefined()
  await later.unmount()
})

test('a summary row is left to the engine', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({
    ...message(reply(FLOW), ROOMY),
    props: { text: reply(FLOW), isFirstOfReply: true, isSummary: true },
  })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})
