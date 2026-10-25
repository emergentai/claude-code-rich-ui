import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'
import { ZEN_QUOTES } from './zen'

const ON = { prefs: { v: 1, enabled: { 'quiet-footer': true } } }

function hint(text: string, extra: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'PromptHint',
    requestId: 'hint',
    props: { isDraft: false, isWorking: false, hint: text, ...extra },
  } as never
}

const notice = {
  plugin: 'rich-ui',
  surface: 'terminal',
  component: 'InfoNotice',
  requestId: 'notice-1',
  props: { text: 'Using model from settings', command: '/model' },
} as never

test('off from the start, the hint is as the engine drew it', async ($, on) => {
  const { rendered } = await boot($, on)
  const ui = await $.ui.mount(hint('(shift+tab to cycle) · ← for agents'))
  await ui.unmount()

  expect(rendered.at(-1)?.props).toMatchObject({ hint: '(shift+tab to cycle) · ← for agents' })
})

// The hint the engine was handed after the plugin's hook, from the last draw.
async function hintAfter(
  $: Parameters<typeof boot>[0],
  rendered: { props: unknown }[],
  text: string,
  extra: Record<string, unknown> = {},
) {
  const ui = await $.ui.mount(hint(text, extra))
  await ui.unmount()

  return (rendered.at(-1)?.props as { hint: string }).hint
}

async function finishTurn($: Parameters<typeof boot>[0]) {
  await $.turn.complete({
    turnId: 't1',
    answer: '',
    durationMs: 1,
    isAborted: false,
    reason: 'answer',
  } as never)
}

test('on, whatever the hint said, it says a zen saying', async ($, on) => {
  const { rendered } = await boot($, on, ON)

  const seen = new Set<string>()
  for (const text of [
    '(shift+tab to cycle) · ← for agents',
    '(shift+tab to cycle) · esc to interrupt',
    'Press Ctrl-C again to exit',
    '',
  ]) {
    const line = await hintAfter($, rendered, text, { isWorking: text.includes('interrupt') })
    expect(ZEN_QUOTES).toContain(line)
    seen.add(line)
  }
  // Drawn again with nothing finished, it is the same saying.
  expect(seen.size).toBe(1)
})

test('each finished turn moves the footer to a different saying', async ($, on) => {
  const { rendered } = await boot($, on, ON)

  const first = await hintAfter($, rendered, '(shift+tab to cycle)')
  await finishTurn($)
  const second = await hintAfter($, rendered, '(shift+tab to cycle)')

  expect(ZEN_QUOTES).toContain(second)
  expect(second).not.toBe(first)
})

test('turned off, finishing a turn changes nothing', async ($, on) => {
  const { rendered } = await boot($, on)
  await finishTurn($)

  expect(await hintAfter($, rendered, '(shift+tab to cycle)')).toBe('(shift+tab to cycle)')
})

test('a hint off the terminal is left to the engine', async ($, on) => {
  const { rendered } = await boot($, on, ON)
  const ui = await $.ui.mount({ ...(hint('x') as object), surface: 'desktop' } as never)
  await ui.unmount()

  expect(rendered.at(-1)?.props).toMatchObject({ hint: 'x' })
})

test('the notices under the logo draw nothing when on, and the engine row when off', async ($, on) => {
  await boot($, on, ON)
  const quiet = await $.ui.mount(notice)
  expect((await quiet.find({ type: 'Box' }))?.props.display).toBe('none')
  expect(await quiet.find({ type: 'Text', text: 'engine' })).toBeUndefined()
  await quiet.unmount()
})

test('turned off, the notice is the engine row', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(notice)
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})
