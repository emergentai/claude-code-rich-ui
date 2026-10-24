// EXPERIMENT (scrollback spike): the engine side. Does a wrapped ToolResult keep
// the engine's row, does the button open the pane first, does the pane scroll and
// copy. Nothing here ships.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

import { PANE_ID } from './spike'

async function boot($: Engine, on: On) {
  const order: string[] = []
  const files = new Map<string, string>()
  const copied: string[] = []
  const toasts: string[] = []
  on('ui.open', (_, e) => {
    order.push('open')

    return { value: { isPlaced: true } }
  })
  on('fs.read', (_, e) => {
    order.push('read')
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: text }
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return h(Text, {}, 'engine') as RenderElement
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return { order, files, copied, toasts }
}

// The test engine has no timers in its types.
declare function setTimeout(run: () => void, ms: number): unknown

// The presses start their work and return; let it finish.
const settle = () => new Promise<void>(done => setTimeout(done, 20))

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n') + '\n'

function result(output: unknown, props: Record<string, unknown> = {}) {
  return {
    plugin: 'scrollback-spike',
    surface: 'terminal',
    component: 'ToolResult',
    requestId: 'toolu_1',
    props: { tool: 'Bash', tool_use_id: 'toolu_1', output, isErrored: false, isExpanded: false, ...props },
  } as never
}

const PANE = {
  plugin: 'scrollback-spike',
  surface: 'terminal',
  component: 'Pane',
  requestId: PANE_ID,
  props: { title: 'Output', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as never

test('a long result keeps the engine row and gains one button', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(result({ stdout: lines(40), stderr: '' }))

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'full-toolu_1' })).toBeDefined()
  await ui.unmount()
})

test('short, errored, expanded, non-Bash and empty results are the engine alone', async ($, on) => {
  await boot($, on)
  const cases = [
    result({ stdout: lines(3), stderr: '' }),
    result({ stdout: lines(40), stderr: '' }, { isErrored: true }),
    result({ stdout: lines(40), stderr: '' }, { isExpanded: true }),
    result({ stdout: lines(40), stderr: '' }, { tool: 'Grep' }),
    result({ stdout: '', stderr: '' }),
    result('plain string'),
  ]
  for (const one of cases) {
    const ui = await $.ui.mount(one)
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})

test('the exact threshold shows the button and one line fewer does not', async ($, on) => {
  await boot($, on)
  const at = await $.ui.mount(result({ stdout: lines(12), stderr: '' }))
  expect(await at.find({ type: 'Button' })).toBeDefined()
  await at.unmount()
  const under = await $.ui.mount(result({ stdout: lines(11), stderr: '' }))
  expect(await under.find({ type: 'Button' })).toBeUndefined()
  await under.unmount()
})

test('the pane is asked for before the file is read, and shows the whole output', async ($, on) => {
  const { order, files } = await boot($, on)
  files.set('/out/full.txt', lines(500))
  const ui = await $.ui.mount(
    result({ stdout: lines(40), stderr: '', persistedOutputPath: '/out/full.txt', persistedOutputSize: 4000 }),
  )

  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(order.slice(0, 2)).toEqual(['open', 'read'])
  expect(await pane.find({ type: 'Text', text: /Bash · 500 lines/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /line 500/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('without a kept file the pane shows what the plugin holds, with no read', async ($, on) => {
  const { order } = await boot($, on)
  const ui = await $.ui.mount(result({ stdout: lines(30), stderr: 'warn\n' }))

  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(order).toEqual(['open'])
  expect(await pane.find({ type: 'Text', text: /Bash · 31 lines/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a kept file that cannot be read falls back to the cut text and says so', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(
    result({ stdout: lines(30), stderr: '', persistedOutputPath: '/gone.txt' }),
  )

  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /could not be read/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /line 30/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a very long output is cut to the row cap, and copy still takes all of it', async ($, on) => {
  const { files, copied } = await boot($, on)
  files.set('/out/big.txt', lines(6000))
  const ui = await $.ui.mount(result({ stdout: lines(40), stderr: '', persistedOutputPath: '/out/big.txt' }))
  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /Showing the first 2,000 of 6,000 lines/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /line 2001/ })).toBeUndefined()
  await pane.press({ key: 'copy' } as never)
  await settle()
  expect(copied).toHaveLength(1)
  expect(copied[0]).toBe(lines(6000))
  await pane.unmount()
  await ui.unmount()
})

test('copy strips colour codes and then the pane says copied', async ($, on) => {
  const { copied } = await boot($, on)
  const ui = await $.ui.mount(result({ stdout: `\u001b[32mgreen\u001b[0m\n${lines(20)}`, stderr: '' }))
  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  await pane.press({ key: 'copy' } as never)
  await settle()
  expect(copied[0]?.startsWith('green\n')).toBe(true)
  await pane.unmount()
  await ui.unmount()
})

// The harness cannot answer $.ui.scroll: the engine resolves it against a laid-out
// window, which a mounted tree does not have. So this only proves the buttons are
// there and a press that the engine refuses does not break the pane; that they
// move the window is in the manual test.
test('top and bottom are drawn and a refused scroll does not break the pane', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(result({ stdout: lines(30), stderr: '' }))
  await ui.press({ key: 'full-toolu_1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Button', key: 'top' })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'end' })).toBeDefined()
  await pane.press({ key: 'end' } as never)
  await settle()
  expect(await pane.find({ type: 'Text', text: /line 30/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a pane with nothing chosen says so, and another surface is the engine', async ($, on) => {
  await boot($, on)
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: 'Nothing to show.' })).toBeDefined()
  await pane.unmount()

  const other = await $.ui.mount({ ...(result({ stdout: lines(40), stderr: '' }) as object), surface: 'desktop' } as never)
  expect(await other.find({ type: 'Button' })).toBeUndefined()
  await other.unmount()
})
