import { expect, test } from 'claude-code/testing'

import { boot } from '../../core/test-harness'

// A 1x1 PNG, standing for the small copy sips makes.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
// Where Claude Code keeps session s1's drops: the project is the working directory the harness reports, /repo.
const IMAGES = '/tmp/claude-501/-repo/s1/images'
const NO_WELCOME = { prefs: { v: 1, enabled: { 'welcome-greeting': false } } }

type Boot = Awaited<ReturnType<typeof boot>>

function band(props: Record<string, unknown> = {}, viewport: Record<string, unknown> = {}) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AbovePrompt',
    requestId: 'band-1',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, ...props },
    viewport: { columns: 120, rows: 40, isFullscreen: true, ...viewport },
  } as never
}

// sips answers: the size of a picture, and a small PNG made at --out.
function withSips(world: Boot['world'], width = 1124, height = 158) {
  world.answer = argv => {
    if (argv[0] !== 'sips') return undefined
    if (argv.includes('-g')) return { stdout: `${argv.at(-1)}\n  pixelWidth: ${width}\n  pixelHeight: ${height}\n` }
    world.put(argv[argv.indexOf('--out') + 1]!, { base64: TINY_PNG })

    return {}
  }
}

// Claude Code's copy of drop N.
function drop(world: Boot['world'], n: number, ext = 'png', size = 28590) {
  world.put(`${IMAGES}/${n}.${ext}`, { base64: 'AAAA', size })
}

// The timer reads the draft; what it starts runs on a little after.
async function settle(clock: Boot['clock']) {
  await clock.advance(250)
  for (let i = 0; i < 6; i++) await clock.settle()
}

test('a dropped image is shown above the prompt, with its name and size', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'ghostty'
  withSips(world)
  drop(world, 7)
  world.draft.text = 'what is this [Image #7]'
  await settle(clock)

  const ui = await $.ui.mount(band())
  const image = await ui.find({ type: 'Image' })
  expect(image?.props.source).toEqual({ png: TINY_PNG })
  // 1124 by 158 is wide: it stops at 28 columns and the rows follow its shape.
  expect(image?.props.columns).toBe(28)
  expect(image?.props.rows).toBe(2)
  expect(await ui.find({ type: 'Text', text: '#7' })).toBeDefined()
  await ui.unmount()
})

test('several images are tiles side by side, in draft order', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'ghostty'
  withSips(world, 400, 800)
  drop(world, 1)
  drop(world, 2)
  world.draft.text = '[Image #2] [Image #1]'
  await settle(clock)

  const ui = await $.ui.mount(band())
  expect(await ui.findAll({ type: 'Image' })).toHaveLength(2)
  const captions = await ui.findAll({ type: 'Text', text: /^#\d$/ })
  expect(captions.map(c => c.text)).toEqual(['#2', '#1'])
  await ui.unmount()
})

test('what does not fit across is counted, not cut', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'ghostty'
  withSips(world, 400, 800)
  for (let n = 1; n <= 8; n++) drop(world, n)
  world.draft.text = Array.from({ length: 8 }, (_, i) => `[Image #${i + 1}]`).join(' ')
  await settle(clock)

  const ui = await $.ui.mount(band({ bodyColumns: 40 }, { columns: 40 }))
  expect(await ui.find({ type: 'Text', text: /^\+\d$/ })).toBeDefined()
  await ui.unmount()
})

test('the picture is made small: sips makes a PNG of it beside the engine copy, once', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  withSips(world)
  drop(world, 7, 'jpg')
  world.draft.text = '[Image #7]'
  await settle(clock)
  await settle(clock)

  const made = world.runs.filter(argv => argv[0] === 'sips' && argv.includes('--out'))
  expect(made).toHaveLength(1)
  expect(made[0]).toEqual([
    'sips', '-s', 'format', 'png', '-Z', '400', `${IMAGES}/7.jpg`, '--out', '/tmp/claude-501/-repo/s1/rich-ui-peek-7.png',
  ])
})

test('a picture still being written is given a moment before it is read', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  withSips(world)
  // Touched 50 ms before the timer reads the draft (the clock stands at 250 then).
  world.put(`${IMAGES}/7.png`, { base64: 'AAAA', size: 100, mtimeMs: 200 })
  world.draft.text = '[Image #7]'
  await settle(clock)
  expect(world.runs.filter(argv => argv[0] === 'sips')).toHaveLength(0)

  await clock.advance(100)
  for (let i = 0; i < 6; i++) await clock.settle()
  expect(world.runs.filter(argv => argv[0] === 'sips').length).toBeGreaterThan(0)
})

test('a draft with no tag, or with its tag deleted, shows nothing', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'ghostty'
  withSips(world)
  drop(world, 7)
  world.draft.text = '[Image #7]'
  await settle(clock)
  let ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()

  world.draft.text = 'never mind'
  await settle(clock)
  ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  await ui.unmount()
})

test('sending the prompt takes the tiles away at once, not at the next read of the draft', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'ghostty'
  withSips(world)
  drop(world, 7)
  world.draft.text = '[Image #7]'
  await settle(clock)
  let ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()

  await $.prompt.submit({ text: '[Image #7]' } as never)
  ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '#7' })).toBeUndefined()
  await ui.unmount()
})

test('an image Claude Code has not saved shows nothing, and the draft is not stuck on it', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  withSips(world)
  world.draft.text = '[Image #9]'
  await settle(clock)
  await clock.advance(4000)

  const ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Text', text: /Image #9/ })).toBeUndefined()
  await ui.unmount()
})

test('a long paste is left alone: no tile, and the clipboard is not read', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.draft.text = '[Pasted text #2 +20 lines]'
  await settle(clock)

  const ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Text', text: /#2/ })).toBeUndefined()
  await ui.unmount()
  expect(world.runs.some(argv => argv[0] === 'pbpaste')).toBe(false)
})

test('where the terminal cannot draw pictures there is no tile', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'Apple_Terminal'
  withSips(world)
  drop(world, 1)
  world.draft.text = '[Image #1]'
  await settle(clock)

  const ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '[Image #1]' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '#1' })).toBeUndefined()
  await ui.unmount()
})

test('iTerm2 draws pictures under fullscreen rendering only', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  world.env.TERM_PROGRAM = 'iTerm.app'
  withSips(world)
  drop(world, 1)
  world.draft.text = '[Image #1]'
  await settle(clock)

  let ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()
  ui = await $.ui.mount(band({}, { isFullscreen: false }))
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  await ui.unmount()
})

test('turned off, nothing is drawn and nothing is read', async ($, on) => {
  const { clock, world } = await boot($, on, { prefs: { v: 1, enabled: { 'welcome-greeting': false, 'attachment-peek': false } } })
  withSips(world)
  drop(world, 1)
  world.draft.text = '[Image #1]'
  await settle(clock)

  const ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Text', text: /Image #1/ })).toBeUndefined()
  expect(world.runs.filter(argv => argv[0] === 'sips')).toHaveLength(0)
  await ui.unmount()
})

test('a survey holds the band: the tiles wait', async ($, on) => {
  const { clock, world } = await boot($, on, NO_WELCOME)
  withSips(world)
  drop(world, 1)
  world.draft.text = '[Image #1]'
  await settle(clock)

  const ui = await $.ui.mount(band({ hasSurvey: true }))
  expect(await ui.find({ type: 'Text', text: /Image #1/ })).toBeUndefined()
  await ui.unmount()
})

test('/clear starts the pictures over: the new session has none of the old one', async ($, on) => {
  const { clock, world, session } = await boot($, on, NO_WELCOME)
  withSips(world)
  drop(world, 1)
  world.draft.text = '[Image #1]'
  await settle(clock)
  session.id = 's2'
  await settle(clock)

  const ui = await $.ui.mount(band())
  expect(await ui.find({ type: 'Text', text: /Image #1/ })).toBeUndefined()
  await ui.unmount()
})
