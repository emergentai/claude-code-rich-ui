import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

// The test's `$` is the engine's own: it raises events but has no `clock`,
// `store` or `state`, and a `$` captured from a test hook is refused those calls.
// So the core helpers (which only touch `$.state`, `$.store` and `$.clock`) are
// tested against this small in-memory stand-in, and the wired plugin is tested
// through `boot` below.

export type FakeEngine = {
  $: EngineInterface
  stored: Map<string, unknown>
  state: Map<string, { value: unknown; version: number }>
  failStore: { on: boolean }
  /** Runs every timer scheduled with `$.clock.after`. */
  flush: () => Promise<void>
  /** Reads a state value the way a test would. */
  peek: <T>(plugin: string, key: string) => T | undefined
}

export function fakeEngine(initialStore: Record<string, unknown> = {}): FakeEngine {
  const stored = new Map<string, unknown>(Object.entries(initialStore))
  const state = new Map<string, { value: unknown; version: number }>()
  const timers: Array<() => unknown> = []
  const failStore = { on: false }
  const address = (e: { plugin: string; key: string; id?: string }) =>
    `${e.plugin}:${e.key}:${e.id ?? ''}`

  const $ = {
    state: {
      get: async (e: { plugin: string; key: string; id?: string }) =>
        state.get(address(e)) ?? { value: undefined, version: 0 },
      set: async (
        ref: { plugin: string; key: string; id?: string },
        value: unknown,
        options?: { ifVersion?: number },
      ) => {
        const key = address(ref)
        const current = state.get(key)?.version ?? 0
        if (options?.ifVersion !== undefined && options.ifVersion !== current) {
          return { isSet: false, version: current }
        }
        state.set(key, { value, version: current + 1 })

        return { isSet: true, version: current + 1 }
      },
    },
    store: {
      get: async (key: string) => stored.get(key),
      set: async (key: string, value: unknown) => {
        if (failStore.on) throw new Error('disk full')
        stored.set(key, value)
      },
    },
    clock: {
      now: async () => 1_000,
      after: (_ms: number, fn: () => unknown) => {
        timers.push(fn)
      },
    },
  } as unknown as EngineInterface

  return {
    $,
    stored,
    state,
    failStore,
    flush: async () => {
      while (timers.length > 0) await timers.shift()?.()
    },
    peek: <T>(plugin: string, key: string) =>
      (state.get(`${plugin}:${key}:`)?.value as { value?: T } | undefined)?.value,
  }
}

// Boots the real plugin under the test engine: the world beneath it is mocked
// (clock, store, state in memory) and the session is started.
export async function boot(
  $: Engine,
  on: On,
  store: Record<string, unknown> = {},
) {
  mock.store(on, store)
  const clock = mock.clock(on)

  const memory = new Map<string, { value: unknown; version: number }>()
  const address = (e: { plugin: string; key: string; id?: string }) =>
    `${e.plugin}:${e.key}:${e.id ?? ''}`
  on('state.get', (_, e) => ({
    value: memory.get(address(e)) ?? { value: undefined, version: 0 },
  }))
  on('state.set', (_, e) => {
    const key = address(e)
    const current = memory.get(key)?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== current) {
      return { value: { isSet: false as const, version: current } }
    }
    memory.set(key, { value: e.value, version: current + 1 })

    return { value: { isSet: true as const, version: current + 1 } }
  })

  on('command.register', () => ({ value: { command: 'rich-ui' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return {
    clock,
    peek: <T>(plugin: string, key: string) =>
      (memory.get(`${plugin}:${key}:`)?.value as { value?: T } | undefined)?.value,
  }
}
