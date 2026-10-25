import { atom, read, update } from 'claude-code'
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

// Which saying shows, kept in shared state and not in the module: a hook may run in a fresh
// module environment each time, and a saying held there came back as a new pick on every
// draw. -1 means none chosen yet.
const quoteAtom = atom(
  { plugin: 'rich-ui', key: 'zen-quote' } as const,
  -1,
  { shape: 'zen-quote-1' },
)

export const quietFooter: Feature = {
  id: 'quiet-footer',
  name: 'Zen footer',
  description: 'Swap the hint under the prompt for a zen saying',
  isExperimental: true,
  defaultEnabled: false,
}

// Each finished turn moves the footer to another saying, and the hint is drawn again to
// show it. Only the main conversation's turns come through this event.
export const advanceFooter: Hook<'turn.complete'> = async ($, e, next) => {
  if (isOn(await read($, enabledAtom), quietFooter)) {
    await update($, quoteAtom, previous =>
      pickQuote(previous < 0 ? undefined : previous, Math.random()),
    )
    $.ui.invalidate('ui.render')
  }

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

  // Drawing never picks: the first saying is chosen once, after the draw, and kept until
  // the next turn ends.
  const stored = await read($, quoteAtom)
  if (stored < 0 || stored >= ZEN_QUOTES.length) {
    void $.clock.after(0, () =>
      update($, quoteAtom, previous =>
        previous >= 0 && previous < ZEN_QUOTES.length ? previous : pickQuote(undefined, Math.random()),
      ),
    )
  }

  return next({ ...e, props: { ...e.props, hint: ZEN_QUOTES[stored >= 0 && stored < ZEN_QUOTES.length ? stored : 0]! } })
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
