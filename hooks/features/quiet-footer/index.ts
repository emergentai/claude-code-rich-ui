import { atom, read } from 'claude-code'
import type { Hook, MatchedHook } from 'claude-code'

import type { EnabledMap } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import { pickQuote, ZEN_QUOTES } from './zen'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const quietFooter: Feature = {
  id: 'quiet-footer',
  name: 'Zen footer',
  description: 'Replace the hint line under the prompt with a zen saying, and hide the dim notices under the logo',
  isExperimental: true,
  defaultEnabled: false,
}

// Which saying shows: set at the first draw, then a new random one each time a turn
// finishes. One module environment holds it, so a hot reload starts again.
let current: number | undefined

// Each finished turn moves the footer to another saying, and the hint is drawn again to
// show it. Only the main conversation's turns come through this event.
export const advanceFooter: Hook<'turn.complete'> = async ($, e, next) => {
  current = pickQuote(current, Math.random())
  if (isOn(await read($, enabledAtom), quietFooter)) $.ui.invalidate('ui.render')

  return next(e)
}

// The hint line under the prompt says a zen saying in place of the shortcut reminders,
// "esc to interrupt" and any confirmation that would have gone in it. The keys still
// work. The engine draws "pill · hint" for any hint a mod writes, so the line reads
// "⏵⏵ auto mode on · Chop wood, carry water."; an empty hint left the "·" dangling. The
// permission-mode pill is not part of this component and stays.
export const renderPromptHint: MatchedHook<'ui.render', { component: 'PromptHint' }> = async (
  $,
  e,
  next,
) => {
  if (!isOn(await read($, enabledAtom), quietFooter) || e.surface !== 'terminal') return next(e)

  current ??= pickQuote(undefined, Math.random())

  return next({ ...e, props: { ...e.props, hint: ZEN_QUOTES[current]! } })
}

// The dim notices under the logo (the model source, an experiment, a settings hint)
// draw nothing either.
export const renderInfoNotice: MatchedHook<'ui.render', { component: 'InfoNotice' }> = async (
  $,
  e,
  next,
) => {
  if (!isOn(await read($, enabledAtom), quietFooter) || e.surface !== 'terminal') return next(e)

  const { Box } = $.ui.resolve(e)

  return Box({ display: 'none' })
}
