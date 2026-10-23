import { expect, test } from 'claude-code/testing'

import { boot } from '../core/test-harness'

const BAND = {
  plugin: 'rich-ui',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const DIAGRAM = {
  plugin: 'rich-ui',
  surface: 'terminal',
  component: 'AssistantMessage',
  requestId: 'm1',
  props: { text: '```mermaid\ngraph TD\n A-->B\n```', isFirstOfReply: true },
} as const

async function openManager($: Parameters<typeof boot>[0]) {
  await $.command.run({ command: 'rich-ui' } as never)
}

test('the band stays out of the way until /rich-ui is run', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(await ui.find({ key: 'mermaid' })).toBeUndefined()
  await ui.unmount()
})

test('/rich-ui shows each feature with a checkbox and a footer', async ($, on) => {
  await boot($, on)
  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  const row = await ui.find({ key: 'mermaid' })
  expect(row?.text).toContain('[x]')
  expect(row?.text).toContain('Mermaid diagrams')
  expect(await ui.find({ type: 'Text', text: /Draw mermaid diagrams/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ctrl\+x then Tab/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /rich-ui 0\.1\.0/ })).toBeDefined()
  await ui.unmount()
})

test('running /rich-ui adds no transcript text', async ($, on) => {
  await boot($, on)

  const result = await $.command.run({ command: 'rich-ui' } as never)

  expect(result.text).toBeUndefined()
})

test('pressing a row toggles the feature and saves the choice', async ($, on) => {
  const { clock, saved } = await boot($, on)
  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

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
  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[ ]')
  expect(await ui.find({ type: 'Text', text: /Couldn't save/ })).toBeDefined()
  await ui.unmount()
})

test('close hides the band again', async ($, on) => {
  await boot($, on)
  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await ui.press({ key: 'close' })

  expect(await ui.find({ key: 'mermaid' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a note posted while drawing appears under the feature row', async ($, on) => {
  const { clock } = await boot($, on)
  const diagram = await $.ui.mount(DIAGRAM)
  await clock.settle()
  await diagram.unmount()

  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /terminal size unknown/ })).toBeDefined()
  await ui.unmount()
})

test('toggling a feature clears its note', async ($, on) => {
  const { clock } = await boot($, on)
  const diagram = await $.ui.mount(DIAGRAM)
  await clock.settle()
  await diagram.unmount()

  await openManager($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect(await ui.find({ type: 'Text', text: /terminal size unknown/ })).toBeUndefined()
  await ui.unmount()
})

test('the band is left to the engine while a survey holds it', async ($, on) => {
  await boot($, on)
  await openManager($)
  const ui = await $.ui.mount({
    ...BAND,
    surface: 'terminal',
    props: { ...BAND.props, hasSurvey: true },
  })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})
