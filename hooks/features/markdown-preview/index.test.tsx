import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const PANE = {
  plugin: 'rich-ui',
  component: 'Pane',
  requestId: 'rich-ui-preview',
  props: { title: 'Markdown preview', placement: 'dock', bodyColumns: 80, view: {} },
} as const

function message(text: string) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text, isFirstOfReply: true },
  } as const
}

const mountPane = ($: Parameters<typeof boot>[0]) =>
  $.ui.mount({ ...PANE, surface: 'terminal' } as never)

test('a reply with a link to a markdown file keeps its text and answers the link', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message('I wrote the plan in [plan.md](/repo/plan.md) for you.') as never)

  const reply = await ui.find({ type: 'Markdown', text: /I wrote the plan/ })
  expect(reply).toBeDefined()
  await ui.unmount()
})

test('pressing the link reads the file and opens the pane', async ($, on) => {
  const { files, opened } = await boot($, on)
  files.set('/repo/plan.md', '# Plan\n\n- first step')
  const ui = await $.ui.mount(message('See [the plan](/repo/plan.md).') as never)

  await ui.press({ key: 'reply', link: { href: '/repo/plan.md' } } as never)
  const pane = await mountPane($)

  expect(opened).toContain('rich-ui-preview')
  expect(await pane.find({ type: 'Text', text: '/repo/plan.md' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: /first step/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a file: link with escapes and a fragment is understood', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/docs/a b.md', 'spaced')
  const ui = await $.ui.mount(message('[x](file:///docs/a%20b.md#top)') as never)

  await ui.press({ key: 'reply', link: { href: 'file:///docs/a%20b.md#top' } } as never)
  const pane = await mountPane($)

  expect(await pane.find({ type: 'Markdown', text: 'spaced' })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a relative link is placed under the working directory', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/docs/rel.md', 'relative file')
  const ui = await $.ui.mount(message('[x](docs/rel.md)') as never)

  await ui.press({ key: 'reply', link: { href: 'docs/rel.md' } } as never)
  const pane = await mountPane($)

  expect(await pane.find({ type: 'Text', text: '/repo/docs/rel.md' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: 'relative file' })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a file that cannot be read shows the reason', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message('[x](/repo/missing.md)') as never)

  await ui.press({ key: 'reply', link: { href: '/repo/missing.md' } } as never)
  const pane = await mountPane($)

  expect(await pane.find({ type: 'Text', text: /Could not read \/repo\/missing\.md/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a file over the drawing limit is cut and says so', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/big.md', 'x'.repeat(99_050))
  const ui = await $.ui.mount(message('[big](/repo/big.md)') as never)

  await ui.press({ key: 'reply', link: { href: '/repo/big.md' } } as never)
  const pane = await mountPane($)

  expect(await pane.find({ type: 'Text', text: /rest is cut/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('an edit to the file on show refreshes it', async ($, on) => {
  const { files, clock } = await boot($, on)
  files.set('/repo/spec.md', 'version one')
  const ui = await $.ui.mount(message('[spec](/repo/spec.md)') as never)
  await ui.press({ key: 'reply', link: { href: '/repo/spec.md' } } as never)
  const pane = await mountPane($)
  expect(await pane.find({ type: 'Markdown', text: 'version one' })).toBeDefined()

  files.set('/repo/spec.md', 'version two')
  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/spec.md',
    old_string: 'one',
    new_string: 'two',
  } as never)
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'version two' })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('replies without such a link are left to the engine', async ($, on) => {
  await boot($, on)

  for (const text of [
    'No links here.',
    'A web link [docs](https://example.com/readme.md).',
    'A code file [main](/repo/main.ts).',
    'An image ![pic](/repo/pic.md).',
  ]) {
    const ui = await $.ui.mount(message(text) as never)
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})

test('turned off, links are left to the engine', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { 'markdown-preview': false } } })
  const ui = await $.ui.mount(message('[plan](/repo/plan.md)') as never)

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})
