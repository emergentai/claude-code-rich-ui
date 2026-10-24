import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

const TS = ['```ts', 'const a = 1', 'const b = 2', '```'].join('\n')
const SH = ['```bash', 'cd repo', 'make test', '```'].join('\n')
const FLOW = ['```mermaid', 'graph TD', '  A[Start] --> B{Valid?}', '  B -->|yes| C[Done]', '```'].join('\n')
const ROOMY = { columns: 120, rows: 60 }

function message(text: string, extra: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text, isFirstOfReply: true },
    ...extra,
  } as never
}

// The engine's copy and toast, answered under the plugin so a test can read them.
function listen($: Parameters<typeof boot>[0], on: Parameters<typeof boot>[1], isCopied = true) {
  const copied: { text: string; surface?: string }[] = []
  const toasts: string[] = []
  on('ui.copy', (_, e) => {
    copied.push({ text: e.text, ...(e.surface ? { surface: e.surface } : {}) })

    return { value: isCopied ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } } as never
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined } as never
  })

  return { copied, toasts }
}

test('a code block gets a copy button, the engine draws the reply, and the press copies the source', async ($, on) => {
  const { copied, toasts } = listen($, on)
  await boot($, on)
  const ui = await $.ui.mount(message(`Here:\n\n${TS}\n\nDone.`))

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect((await ui.find({ key: 'copy1' }))?.text).toContain('copy code')
  await ui.press({ key: 'copy1' })

  expect(copied).toEqual([{ text: 'const a = 1\nconst b = 2', surface: 'terminal' }])
  expect(toasts).toEqual(['Copied 2 lines'])
  await ui.unmount()
})

test('several blocks are numbered, each copies its own source', async ($, on) => {
  const { copied } = listen($, on)
  await boot($, on)
  const ui = await $.ui.mount(message(`${TS}\n\n${SH}`))

  expect((await ui.find({ key: 'copy1' }))?.text).toContain('copy 1 (ts)')
  expect((await ui.find({ key: 'copy2' }))?.text).toContain('copy 2 (bash)')
  await ui.press({ key: 'copy2' })
  await ui.press({ key: 'copy1' })

  expect(copied.map(c => c.text)).toEqual(['cd repo\nmake test', 'const a = 1\nconst b = 2'])
  await ui.unmount()
})

test('a failed copy says why in a toast', async ($, on) => {
  const { toasts } = listen($, on, false)
  await boot($, on)
  const ui = await $.ui.mount(message(TS))

  await ui.press({ key: 'copy1' })

  expect(toasts).toEqual(['Could not copy: no-clipboard'])
  await ui.unmount()
})

test('replies with nothing to copy are left to the engine', async ($, on) => {
  await boot($, on)
  for (const text of ['plain words', '```sh\nnpm i\n```', '```ts\na\nb', '`inline` code']) {
    const ui = await $.ui.mount(message(text))
    expect(await ui.find({ key: 'copy1' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})

test('an unfinished fence next to a finished one only offers the finished one', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(`${TS}\n\n\`\`\`bash\nstreaming\nmore`))

  expect((await ui.find({ key: 'copy1' }))?.text).toContain('copy code')
  expect(await ui.find({ key: 'copy2' })).toBeUndefined()
  await ui.unmount()
})

test('a summary row, another surface and a disabled feature get nothing', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: {} } })
  const summary = await $.ui.mount(message(TS, { props: { text: TS, isFirstOfReply: true, isSummary: true } }))
  expect(await summary.find({ key: 'copy1' })).toBeUndefined()
  await summary.unmount()

  const desktop = await $.ui.mount(message(TS, { surface: 'desktop' }))
  expect(await desktop.find({ key: 'copy1' })).toBeUndefined()
  expect(await desktop.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await desktop.unmount()
})

test('off in the saved choices: the engine draws the reply alone', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { 'copy-button': false } } })
  const ui = await $.ui.mount(message(TS))

  expect(await ui.find({ key: 'copy1' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('with mermaid: the diagram and its toggle stay, the mermaid source is not offered, other blocks are', async ($, on) => {
  const { copied } = listen($, on)
  await boot($, on)
  const ui = await $.ui.mount(message(`${FLOW}\n\n${TS}`, { viewport: ROOMY }))

  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle0' })).toBeDefined()
  expect((await ui.find({ key: 'copy1' }))?.text).toContain('copy code')
  expect(await ui.find({ key: 'copy2' })).toBeUndefined()

  await ui.press({ key: 'toggle0' })
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  await ui.press({ key: 'copy1' })
  expect(copied.map(c => c.text)).toEqual(['const a = 1\nconst b = 2'])
  await ui.unmount()
})

test('with mermaid only: no copy row, the diagram is as mermaid draws it', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(FLOW, { viewport: ROOMY }))

  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  expect(await ui.find({ key: 'copy1' })).toBeUndefined()
  await ui.unmount()
})

test('with the markdown preview: a link still answers and the block still copies', async ($, on) => {
  const { copied } = listen($, on)
  const { files, opened } = await boot($, on)
  files.set('/repo/plan.md', '# Plan')
  const ui = await $.ui.mount(message(`See [plan](/repo/plan.md).\n\n${TS}`))

  expect(await ui.find({ type: 'Markdown', text: /See \[?plan/ })).toBeDefined()
  await ui.press({ key: 'reply', link: { href: '/repo/plan.md' } } as never)
  expect(opened).toContain('rich-ui-preview')
  await ui.press({ key: 'copy1' })
  expect(copied).toHaveLength(1)
  await ui.unmount()
})

test('with mermaid turned off the fence is an ordinary block again and gets a button', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  const ui = await $.ui.mount(message(`${FLOW}\n\n${TS}`, { viewport: ROOMY }))

  // Mermaid fences are never offered, drawn or not: one button, for the ts block.
  expect(await ui.find({ key: 'copy2' })).toBeUndefined()
  expect((await ui.find({ key: 'copy1' }))?.text).toContain('copy code')
  await ui.unmount()
})
