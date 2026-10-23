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
) {
  mock.store(on, store)
  const clock = mock.clock(on)

  on('command.register', () => ({ value: { command: 'rich-ui' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return h(Text, {}, 'engine') as RenderElement
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return { clock }
}
