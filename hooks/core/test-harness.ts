import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ProcessRunResult, RenderElement } from 'claude-code'

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
  // A disk in memory beside `files`: pictures the engine saved, and what a tool made of them.
  // Paths are absolute; a folder is any path some file lies under or that was made with `dir`.
  const disk = new Map<string, { base64: string; size: number; mtimeMs: number } | 'dir'>()
  const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'))
  const world = {
    disk,
    // Adds a file, and the folders above it.
    put(path: string, file: { base64?: string; size?: number; mtimeMs?: number } = {}) {
      for (let at = dirOf(path); at !== '' && !disk.has(at); at = dirOf(at)) disk.set(at, 'dir')
      disk.set(path, { base64: file.base64 ?? '', size: file.size ?? (file.base64 ?? '').length, mtimeMs: file.mtimeMs ?? -10_000 })
    },
    // The environment variables the plugin may read.
    env: {} as Record<string, string>,
    // The prompt box, as `$.prompt.read` finds it.
    draft: { text: '' },
    // Every command the plugin ran, and how a test answers one (undefined: the default).
    runs: [] as string[][],
    answer: ((): Partial<ProcessRunResult> | undefined => undefined) as (
      argv: readonly string[],
    ) => Partial<ProcessRunResult> | undefined,
  }
  // A read of a path waits here until the test lets it go, to finish reads out of order.
  const readGates = new Map<string, Promise<void>>()
  on('fs.read', async (_, e) => {
    order.push('read')
    // What the file holds as the read begins, as a real read would see it; the gate holds only the answer.
    const file = disk.get(e.path)
    const gate = readGates.get(e.path)
    const text = files.get(e.path)
    await gate
    if (e.as === 'bytes' && file !== undefined && file !== 'dir') return { value: { base64: file.base64 } }
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: text }
  })
  on('fs.exists', (_, e) => ({ value: disk.has(e.path) || files.has(e.path) }))
  on('fs.stat', (_, e) => {
    const file = disk.get(e.path)
    if (file === undefined) throw new Error(`ENOENT: ${e.path}`)

    return file === 'dir'
      ? { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
      : { value: { kind: 'file' as const, size: file.size, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on('fs.list', (_, e) => {
    const prefix = `${e.path.replace(/\/+$/, '')}/`
    const entries = [...disk.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, file]) => ({
        name: path.slice(prefix.length),
        kind: file === 'dir' ? ('dir' as const) : ('file' as const),
        size: file === 'dir' ? 0 : file.size,
        mtimeMs: file === 'dir' ? 0 : file.mtimeMs,
        isLink: false,
      }))
    if (entries.length === 0 && disk.get(e.path.replace(/\/+$/, '')) !== 'dir') throw new Error(`ENOENT: ${e.path}`)

    return { value: entries }
  })
  on('env.get', (_, e) => ({ value: world.env[e.name] }))
  on('prompt.read', () => ({ value: { text: world.draft.text, cursor: world.draft.text.length } }))
  on('process.run', (_, e) => {
    world.runs.push([...e.argv])
    const [tool] = e.argv
    const stock = tool === 'uname' ? 'Darwin\n' : tool === 'id' ? '501\n' : ''

    return {
      value: {
        exitCode: 0,
        stdout: stock,
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
        ...world.answer(e.argv),
      },
    }
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

  return { clock, saved, failSaves, status, files, opened, order, rendered, blits, readGates, session, world }
}
