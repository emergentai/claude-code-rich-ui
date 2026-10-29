import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const MODEL = 'claude-sonnet-5-5'

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

async function showFile($: Parameters<typeof boot>[0], path: string) {
  const ui = await $.ui.mount(message(`[f](${path})`) as never)
  await ui.press({ key: 'reply', link: { href: path } } as never)
  const pane = await mountPane($)

  return { ui, pane }
}

test('a table in the file is drawn as a box inside the pane', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/t.md', '# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n')
  const { ui, pane } = await showFile($, '/repo/t.md')

  expect(await pane.find({ type: 'Markdown', text: /┌[\s\S]*└/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('tiny table rows that grow when drawn still fit the drawing limit', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/rows.md', '|a|b|\n|-|-|\n' + '|1|2|\n'.repeat(16_000))
  const { ui, pane } = await showFile($, '/repo/rows.md')

  const md = await pane.find({ type: 'Markdown', text: /┌/ })
  expect(md).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /rest is cut/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('an empty file opens an empty preview, not an error', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/empty.md', '')
  const { ui, pane } = await showFile($, '/repo/empty.md')

  expect(await pane.find({ type: 'Text', text: '/repo/empty.md' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Could not read/ })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a second link replaces the first file, and a failed one replaces it with the reason', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/repo/a.md', 'alpha')
  files.set('/repo/b.md', 'beta')
  const first = await showFile($, '/repo/a.md')
  await first.pane.unmount()
  await first.ui.unmount()
  const second = await showFile($, '/repo/b.md')
  expect(await second.pane.find({ type: 'Markdown', text: 'beta' })).toBeDefined()
  expect(await second.pane.find({ type: 'Markdown', text: 'alpha' })).toBeUndefined()
  await second.pane.unmount()
  await second.ui.unmount()
  const third = await showFile($, '/repo/gone.md')
  expect(await third.pane.find({ type: 'Markdown', text: 'beta' })).toBeUndefined()
  expect(await third.pane.find({ type: 'Text', text: /Could not read/ })).toBeDefined()
  await third.pane.unmount()
  await third.ui.unmount()
})

test('a slow read for an earlier link does not replace the file chosen after it', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/a.md', 'alpha')
  files.set('/repo/b.md', 'beta')
  let release = () => {}
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release = resolve)))
  const ui = await $.ui.mount(message('[a](/repo/a.md) [b](/repo/b.md)') as never)

  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  await ui.press({ key: 'reply', link: { href: '/repo/b.md' } } as never)
  const pane = await mountPane($)
  expect(await pane.find({ type: 'Markdown', text: 'beta' })).toBeDefined()

  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'beta' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: 'alpha' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a read for an earlier press of a file does not replace its later, fresher read when the file is reopened', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/a.md', 'alpha old')
  files.set('/repo/b.md', 'beta')
  let release = () => {}
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release = resolve)))
  const ui = await $.ui.mount(message('[a](/repo/a.md) [b](/repo/b.md)') as never)

  // A, whose read stays out; then B; then A again, after the file changed, read at once.
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  await ui.press({ key: 'reply', link: { href: '/repo/b.md' } } as never)
  files.set('/repo/a.md', 'alpha fresh')
  readGates.delete('/repo/a.md')
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  const pane = await mountPane($)
  expect(await pane.find({ type: 'Markdown', text: 'alpha fresh' })).toBeDefined()

  // The first read now finishes, with the text the file had when it began.
  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha fresh' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: 'alpha old' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a failed read for an earlier press of a file does not replace its later read when the file is reopened', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/b.md', 'beta')
  let release = () => {}
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release = resolve)))
  const ui = await $.ui.mount(message('[a](/repo/a.md) [b](/repo/b.md)') as never)

  // A is missing at first, so its read will fail when it finishes; the file then appears and is reopened.
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  await ui.press({ key: 'reply', link: { href: '/repo/b.md' } } as never)
  files.set('/repo/a.md', 'alpha now')
  readGates.delete('/repo/a.md')
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  const pane = await mountPane($)
  expect(await pane.find({ type: 'Markdown', text: 'alpha now' })).toBeDefined()

  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha now' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Could not read/ })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a refresh begun before a later press of the same file is dropped, and the press stands', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/a.md', 'alpha v1')
  const ui = await $.ui.mount(message('[a](/repo/a.md)') as never)
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  const pane = await mountPane($)

  // A write to the file starts a refresh whose read stays out; the file then changes and is pressed again.
  let release = () => {}
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release = resolve)))
  void $.tool.call({ tool: 'Write', file_path: '/repo/a.md', content: 'x' } as never)
  await clock.settle()
  files.set('/repo/a.md', 'alpha v3')
  readGates.delete('/repo/a.md')
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  expect(await pane.find({ type: 'Markdown', text: 'alpha v3' })).toBeDefined()

  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha v3' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: 'alpha v1' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('two writes to the open file, finishing in order, leave the later text on show', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/a.md', 'alpha v1')
  const { ui, pane } = await showFile($, '/repo/a.md')

  // Both writes' reads are held; the first finishes, then the second.
  let release1 = () => {}
  let release2 = () => {}
  files.set('/repo/a.md', 'alpha v2')
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release1 = resolve)))
  void $.tool.call({ tool: 'Write', file_path: '/repo/a.md', content: 'x' } as never)
  await clock.settle()
  files.set('/repo/a.md', 'alpha v3')
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release2 = resolve)))
  void $.tool.call({ tool: 'Write', file_path: '/repo/a.md', content: 'y' } as never)
  await clock.settle()

  release1()
  await clock.settle()
  release2()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha v3' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: 'alpha v2' })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a failed read for an earlier link does not replace the file chosen after it', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/b.md', 'beta')
  let release = () => {}
  readGates.set('/repo/gone.md', new Promise<void>(resolve => (release = resolve)))
  const ui = await $.ui.mount(message('[g](/repo/gone.md) [b](/repo/b.md)') as never)

  await ui.press({ key: 'reply', link: { href: '/repo/gone.md' } } as never)
  await ui.press({ key: 'reply', link: { href: '/repo/b.md' } } as never)
  const pane = await mountPane($)

  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'beta' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Could not read/ })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('a refresh that finishes after another file was chosen is dropped', async ($, on) => {
  const { files, clock, readGates } = await boot($, on)
  files.set('/repo/a.md', 'alpha v1')
  files.set('/repo/b.md', 'beta')
  const ui = await $.ui.mount(message('[a](/repo/a.md) [b](/repo/b.md)') as never)
  await ui.press({ key: 'reply', link: { href: '/repo/a.md' } } as never)
  const pane = await mountPane($)
  expect(await pane.find({ type: 'Markdown', text: 'alpha v1' })).toBeDefined()

  let release = () => {}
  readGates.set('/repo/a.md', new Promise<void>(resolve => (release = resolve)))
  files.set('/repo/a.md', 'alpha v2')
  void $.tool.call({ tool: 'Write', file_path: '/repo/a.md', content: 'x' } as never)
  await clock.settle()
  await ui.press({ key: 'reply', link: { href: '/repo/b.md' } } as never)
  release()
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'beta' })).toBeDefined()
  expect(await pane.find({ type: 'Markdown', text: /alpha/ })).toBeUndefined()
  await pane.unmount()
  await ui.unmount()
})

test('an edit to a different file leaves the preview alone', async ($, on) => {
  const { files, clock } = await boot($, on)
  files.set('/repo/a.md', 'alpha')
  files.set('/repo/other.md', 'other v1')
  const { ui, pane } = await showFile($, '/repo/a.md')

  files.set('/repo/other.md', 'other v2')
  await $.tool.call({ tool: 'Write', file_path: '/repo/other.md', content: 'x' } as never)
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha' })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('an edit with no previewed file, or to a file that was deleted, does not throw', async ($, on) => {
  const { files, clock } = await boot($, on)
  await $.tool.call({ tool: 'Write', file_path: '/repo/a.md', content: 'x' } as never)
  files.set('/repo/a.md', 'alpha')
  const { ui, pane } = await showFile($, '/repo/a.md')
  files.delete('/repo/a.md')
  await $.tool.call({ tool: 'Edit', file_path: '/repo/a.md', old_string: 'a', new_string: 'b' } as never)
  await clock.settle()

  expect(await pane.find({ type: 'Markdown', text: 'alpha' })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a reply with a mermaid fence and a link is left to the mermaid renderer', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message('[plan](/repo/plan.md)\n\n```mermaid\ngraph TD; A-->B\n```') as never)

  expect(await ui.find({ type: 'Markdown', key: 'reply' })).toBeUndefined()
  await ui.unmount()
})

test('a link inside a code block in a reply is not answered', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message('```\n[plan](/repo/plan.md)\n```') as never)

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('the pane is asked for before the file is read, while the press is being answered', async ($, on) => {
  const { files, order } = await boot($, on)
  files.set('/repo/plan.md', 'plan')
  const { ui, pane } = await showFile($, '/repo/plan.md')

  expect(order.indexOf('open')).toBeGreaterThanOrEqual(0)
  expect(order.indexOf('open')).toBeLessThan(order.indexOf('read'))
  await pane.unmount()
  await ui.unmount()
})

test('a long path and a long error wrap instead of being cut', async ($, on) => {
  await boot($, on)
  const long = '/repo/' + 'deeply/'.repeat(30) + 'gone.md'
  const { ui, pane } = await showFile($, long)

  expect(await pane.find({ type: 'Text', text: new RegExp(`Could not read ${long.replace(/[.]/g, '\\.')}`) })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

// The engine's own prompt, as far as these tests need: one shared section.
const engineSections = (on: Parameters<typeof boot>[1]) =>
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' }] }) as never)

test('the system prompt tells the model to link markdown files it writes', async ($, on) => {
  engineSections(on)
  await boot($, on)
  const { sections } = await $.prompt.compose({ model: MODEL, promptModel: MODEL, outputStyle: null, tools: [], traits: [], surfaces: ['terminal'] })

  const added = sections.find(section => section.id === 'rich-ui:markdown-preview')
  expect(added?.scope).toBe('session')
  expect(added?.text).toContain('markdown link')
  expect(sections.filter(section => section.id === 'rich-ui:markdown-preview')).toHaveLength(1)
})

test('with the preview off the system prompt is left alone', async ($, on) => {
  engineSections(on)
  await boot($, on, { prefs: { v: 1, enabled: { 'markdown-preview': false } } })
  const { sections } = await $.prompt.compose({ model: MODEL, promptModel: MODEL, outputStyle: null, tools: [], traits: [], surfaces: ['terminal'] })

  expect(sections.some(section => section.id === 'rich-ui:markdown-preview')).toBe(false)
})

test('where nothing draws in a terminal the system prompt is left alone', async ($, on) => {
  engineSections(on)
  await boot($, on)
  const { sections } = await $.prompt.compose({ model: MODEL, promptModel: MODEL, outputStyle: null, tools: [], traits: [], surfaces: [] })

  expect(sections.some(section => section.id === 'rich-ui:markdown-preview')).toBe(false)
})
