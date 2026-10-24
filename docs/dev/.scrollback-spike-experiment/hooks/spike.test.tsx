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

const CUT = { stdout: lines(40), stderr: '', persistedOutputPath: '/out/full.txt', persistedOutputSize: 348894 }

type Call = Record<string, unknown>

function bash(id: string, output: unknown, extra: Call = {}): Call {
  return {
    tool: 'Bash',
    tool_use_id: id,
    input: { command: 'seq 1 60000' },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
    output,
    ...extra,
  }
}

// What the engine draws for Bash in fullscreen: a group of calls.
function group(calls: Call[], fullscreen = true) {
  return {
    plugin: 'scrollback-spike',
    surface: 'terminal',
    component: 'ToolGroup',
    requestId: 'collapsed-1',
    viewport: { rows: 40, columns: 120, isFullscreen: fullscreen },
    props: { calls, isActive: false, isExpanded: false },
  } as never
}

const PANE = {
  plugin: 'scrollback-spike',
  surface: 'terminal',
  component: 'Pane',
  requestId: PANE_ID,
  props: { title: 'Output', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as never

test('a call whose output was cut keeps the engine line and gains one button', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(group([bash('t1', CUT)]))

  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'full-t1' })).toBeDefined()
  await ui.unmount()
})

test('whole, failed, running, interrupted, other-tool and empty calls get no button', async ($, on) => {
  await boot($, on)
  const whole = { stdout: lines(500), stderr: '' }
  const cases = [
    [bash('a', whole)],
    [bash('b', CUT, { isErrored: true })],
    [bash('c', CUT, { isRunning: true })],
    [bash('d', CUT, { isInterrupted: true })],
    [bash('e', CUT, { tool: 'Grep' })],
    [bash('f', { stdout: '', stderr: '' })],
    [bash('g', 'plain string')],
    [bash('h', CUT, { tool_use_id: undefined })],
  ]
  for (const calls of cases) {
    const ui = await $.ui.mount(group(calls))
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})

test('a group of several calls gets a button for each cut one only', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(
    group([bash('a', CUT), bash('b', CUT, { isErrored: true }), bash('c', CUT), bash('d', { stdout: 'x', stderr: '' })]),
  )

  expect(await ui.find({ type: 'Button', key: 'full-a' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'full-b' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'full-c' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'full-d' })).toBeUndefined()
  await ui.unmount()
})

test('outside fullscreen, or on another surface, the group is the engine alone', async ($, on) => {
  await boot($, on)
  const classic = await $.ui.mount(group([bash('a', CUT)], false))
  expect(await classic.find({ type: 'Button' })).toBeUndefined()
  await classic.unmount()

  const desktop = await $.ui.mount({ ...(group([bash('a', CUT)]) as object), surface: 'desktop' } as never)
  expect(await desktop.find({ type: 'Button' })).toBeUndefined()
  await desktop.unmount()
})

test('the pane is asked for before the file is read, and shows the whole output', async ($, on) => {
  const { order, files } = await boot($, on)
  files.set('/out/full.txt', lines(500))
  const ui = await $.ui.mount(group([bash('t1', CUT)]))

  await ui.press({ key: 'full-t1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(order.slice(0, 2)).toEqual(['open', 'read'])
  expect(await pane.find({ type: 'Text', text: /Bash · 500 lines/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /line 500/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a kept file that cannot be read falls back to the cut text and says so', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(group([bash('t1', { ...CUT, stdout: lines(30), persistedOutputPath: '/gone.txt' })]))

  await ui.press({ key: 'full-t1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /could not be read/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /line 30/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('pressing the button of another call switches the pane to that output', async ($, on) => {
  const { files } = await boot($, on)
  files.set('/out/a.txt', lines(7))
  files.set('/out/b.txt', lines(9))
  const ui = await $.ui.mount(
    group([bash('a', { ...CUT, persistedOutputPath: '/out/a.txt' }), bash('b', { ...CUT, persistedOutputPath: '/out/b.txt' })]),
  )

  await ui.press({ key: 'full-a' } as never)
  await ui.press({ key: 'full-b' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Text', text: /Bash · 9 lines/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a very long output is cut to the row cap, and copy still takes all of it', async ($, on) => {
  const { files, copied } = await boot($, on)
  files.set('/out/big.txt', lines(6000))
  const ui = await $.ui.mount(group([bash('t1', { ...CUT, persistedOutputPath: '/out/big.txt' })]))
  await ui.press({ key: 'full-t1' } as never)
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
  const { copied, files } = await boot($, on)
  const ui = await $.ui.mount(
    group([bash('t1', { stdout: `\u001b[32mgreen\u001b[0m\n${lines(20)}`, stderr: '', persistedOutputPath: '/p.txt' })]),
  )
  files.set('/p.txt', `\u001b[32mgreen\u001b[0m\n${lines(20)}`)
  await ui.press({ key: 'full-t1' } as never)
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
  const { files } = await boot($, on)
  files.set('/out/full.txt', lines(30))
  const ui = await $.ui.mount(group([bash('t1', CUT)]))
  await ui.press({ key: 'full-t1' } as never)
  const pane = await $.ui.mount(PANE)

  expect(await pane.find({ type: 'Button', key: 'top' })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'end' })).toBeDefined()
  // Repeated below the lines, because the buttons scroll away with them.
  expect(await pane.find({ type: 'Button', key: 'copy-end' })).toBeDefined()
  await pane.press({ key: 'end' } as never)
  await settle()
  expect(await pane.find({ type: 'Text', text: /line 30/ })).toBeDefined()
  await pane.unmount()
  await ui.unmount()
})

test('a pane with nothing chosen says so', async ($, on) => {
  await boot($, on)
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: 'Nothing to show.' })).toBeDefined()
  await pane.unmount()
})
