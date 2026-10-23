import type { EnabledMap } from '../../types'

// The gate, as pure helpers. The engine's module scan allows only literal
// `on("event", hook)` calls, forbids wrapping `on`, and rejects any function
// that is handed `$`. So a gate cannot be a wrapper: every feature hook is an
// exported const arrow that reads the flag and records failures inline, and uses
// these to decide and to contain a throw.

export function isOn(
  enabled: EnabledMap,
  feature: { id: string; defaultEnabled: boolean },
): boolean {
  return enabled[feature.id] ?? feature.defaultEnabled
}

// Runs the feature's work; if it throws, reports and falls back to the
// engine's own behaviour (`next(e)` replays if the hook already called it).
export async function guard<R>(
  run: () => R | Promise<R>,
  fallback: () => R | Promise<R>,
  onError: (error: unknown) => void,
): Promise<R> {
  try {
    return await run()
  } catch (error) {
    onError(error)

    return fallback()
  }
}
