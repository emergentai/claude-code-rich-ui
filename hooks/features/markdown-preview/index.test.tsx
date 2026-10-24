import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const PANE = {
  plugin: 'rich-ui',
  component: 'Pane',
  requestId: 'rich-ui-preview',
  props: { title: 'Markdown preview', placement: 'dock', bodyColumns: 80, view: {} },
} as const

const mountPane = ($: Parameters<typeof boot>[0]) =>
  $.ui.mount({ ...PANE, surface: 'terminal' } as never)

test('/preview with a path reads the file and opens the pane', async ($, on) => {
  const { files, opened } = await boot($, on)
  files.set('/repo/plan.md', '# Plan\n\n- first step')

  const result = await $.command.run({ command: 'preview', args: '/repo/plan.md' } as never)
  const ui = await mountPane($)

  expect(result.text).toBeUndefined()
  expect(opened).toContain('rich-ui-preview')
  expect(await ui.find({ type: 'Text', text: '/repo/plan.md' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /first step/ })).toBeDefined()
  await ui.unmount()
})

test('quotes around the path are dropped', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/docs/a b.md', 'spaced')

  await $.command.run({ command: 'preview', args: '"/repo/docs/a b.md"' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Markdown', text: 'spaced' })).toBeDefined()
  await ui.unmount()
})

test('with nothing to show the pane says so', async ($, on) => {
  await boot($, on)

  await $.command.run({ command: 'preview', args: '' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Text', text: /No markdown file yet/ })).toBeDefined()
  await ui.unmount()
})

test('a file that cannot be read shows the reason', async ($, on) => {
  await boot($, on)

  await $.command.run({ command: 'preview', args: 'missing.md' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Text', text: /Could not read missing\.md/ })).toBeDefined()
  await ui.unmount()
})

test('with no path, /preview shows the last markdown file Claude wrote', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/spec.md', 'the spec')
  await $.tool.call({ tool: 'Write', file_path: '/repo/spec.md', content: 'the spec' } as never)

  await $.command.run({ command: 'preview', args: '' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Markdown', text: 'the spec' })).toBeDefined()
  await ui.unmount()
})

test('an edit to the file on show refreshes it', async ($, on) => {
  const { files, clock } = await boot($, on)
  files.set('/repo/spec.md', 'version one')
  await $.command.run({ command: 'preview', args: '/repo/spec.md' } as never)
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Markdown', text: 'version one' })).toBeDefined()

  files.set('/repo/spec.md', 'version two')
  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/spec.md',
    old_string: 'one',
    new_string: 'two',
  } as never)
  await clock.settle()

  expect(await ui.find({ type: 'Markdown', text: 'version two' })).toBeDefined()
  await ui.unmount()
})

test('files that are not markdown are not remembered', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/main.ts', 'code')
  await $.tool.call({ tool: 'Write', file_path: '/repo/main.ts', content: 'code' } as never)

  await $.command.run({ command: 'preview', args: '' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Text', text: /No markdown file yet/ })).toBeDefined()
  await ui.unmount()
})

test('a file over the drawing limit is cut and says so', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/big.md', 'x'.repeat(99_050))

  await $.command.run({ command: 'preview', args: '/repo/big.md' } as never)
  const ui = await mountPane($)

  expect(await ui.find({ type: 'Text', text: /rest is cut/ })).toBeDefined()
  await ui.unmount()
})

test('turned off, the command says so and the pane is left to the engine', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { 'markdown-preview': false } } })

  const result = await $.command.run({ command: 'preview', args: 'a.md' } as never)
  const ui = await mountPane($)

  expect(result.text).toMatch(/off/)
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})
