import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

// Boots the real plugin under the test engine. What sits beneath the plugin is
// mocked: the clock and the store, the commands and panes the session opens,
// and the engine's own drawing (a Text reading "engine"), so a test can tell a
// drawing the plugin left to the engine from one it made itself. Hooks beneath
// the plugin must be registered before the first call on `$`, so they all are
// here. The engine's own state store answers `$.state` as it is.
export async function boot(
  $: Engine,
  on: On,
  store: Record<string, unknown> = {},
  theme: string = 'dark',
) {
  // Not mock.store: tests need to read back what the plugin saved.
  const failSaves = { on: false }
  const saved = new Map<string, unknown>(Object.entries(store))
  on('store.get', (_, e) => ({ value: saved.get(e.key) }))
  on('store.set', (_, e) => {
    if (failSaves.on) throw new Error('disk full')
    saved.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    saved.delete(e.key)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...saved.keys()] }))
  const clock = mock.clock(on)

  on('command.register', () => ({ value: { command: 'rich-ui' } }))
  const files = new Map<string, string>()
  // The order of reads and pane opens, for what must happen before an await.
  const order: string[] = []
  // A read of a path waits here until the test lets it go, to finish reads out of order.
  const readGates = new Map<string, Promise<void>>()
  on('fs.read', async (_, e) => {
    order.push('read')
    await readGates.get(e.path)
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: text }
  })
  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice',
        value: theme as never,
        options: ['auto', 'dark', 'light'],
        provider: { plugin: 'engine', tier: 'core' },
        isLocked: false,
      },
    ],
  }))
  on('session.cwd', () => ({ value: '/repo' }))
  // Which session this is and how many prompts it has had, for what only fresh sessions do.
  const session = { id: 's1', turns: 0 }
  on('session.id', () => ({ value: session.id }))
  on('session.turns', () => ({ value: session.turns }))
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    order.push('open')

    return { value: { isPlaced: true } }
  })
  // What the plugin passed down to the engine's own drawing.
  const rendered: { component: string; props: unknown }[] = []
  on('ui.render', ($, e) => {
    rendered.push({ component: e.component, props: e.props })
    const { Text } = $.ui.resolve(e)

    return h(Text, {}, 'engine') as RenderElement
  })
  // Every Raster repaint, and how the engine answers it: `deny` set means "not mounted";
  // `delayMs` holds an answer back on the mock clock (a slow host).
  const blits: { calls: { requestId: string; key: string; cells: string }[]; deny?: string; delayMs: number } = {
    calls: [],
    delayMs: 0,
  }
  on('ui.blit', async (_, e) => {
    blits.calls.push({ requestId: e.requestId, key: e.key, cells: 'cells' in e ? e.cells : '' })
    if (blits.delayMs > 0) await clock.sleep(blits.delayMs)

    return { value: blits.deny === undefined ? {} : { deny: blits.deny } }
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const status: { line: string | undefined } = { line: undefined }
  on('ui.status', (_, e) => {
    status.line = e.text

    return { value: undefined }
  })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return { clock, saved, failSaves, status, files, opened, order, rendered, blits, readGates, session }
}
