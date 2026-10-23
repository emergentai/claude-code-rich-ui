import { expect, test } from 'claude-code/testing'

import { boot } from './core/test-harness'

const FLOW = ['graph TD', '  A[Start] --> B[Done]'].join('\n')
const REPLY = ['```mermaid', FLOW, '```'].join('\n')

function message() {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text: REPLY, isFirstOfReply: true },
    viewport: { columns: 120, rows: 60 },
  } as const
}

test('a stored "off" choice is honoured from the first draw', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  const ui = await $.ui.mount(message())

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('an unreadable store falls back to the default (on)', async ($, on) => {
  await boot($, on, { prefs: 'garbage' })
  const ui = await $.ui.mount(message())

  expect(await ui.find({ key: 'toggle0' })).toBeDefined()
  await ui.unmount()
})
