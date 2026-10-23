import type { EngineInterface, On } from 'claude-code'

import { reportError } from './errors'
import { isEnabled } from './prefs'

type Next = (e: unknown) => unknown
type Hook = ($: EngineInterface, e: unknown, next: Next) => unknown
type Loose = (...args: unknown[]) => unknown

// Streaming (generator) hooks are not supported; v1 features do not use them.
export function gateOn(
  on: On,
  feature: { id: string; defaultEnabled: boolean },
): On {
  const gated = (...args: unknown[]) => {
    const hook = args[args.length - 1] as Hook
    const head = args.slice(0, -1)

    const wrapped: Hook = async ($, e, next) => {
      if (!(await isEnabled($, feature.id, feature.defaultEnabled))) {
        return next(e)
      }
      try {
        return await hook($, e, next)
      } catch (error) {
        reportError($, feature.id, error)

        return next(e)
      }
    }

    return (on as unknown as Loose)(...head, wrapped)
  }

  return gated as unknown as On
}
