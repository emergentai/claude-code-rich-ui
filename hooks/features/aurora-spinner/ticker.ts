import type { Timer } from 'claude-code'

// The one frame timer of the aurora, kept here because the stop must be reachable
// from hooks that never see the render hook's closure (a turn ending, /clear). It is
// a module variable on purpose: a hot reload cancels the engine's timers with the old
// module environment, so a stale handle here can only be one already cancelled.
let current: Timer | undefined

// Replaces any running timer with `next`.
export function setTicker(next: Timer): void {
  current?.cancel()
  current = next
}

// Safe to call at any time, any number of times. With `only`, stops that timer and
// leaves a newer one running (a frame still in flight from a replaced timer).
export function stopAurora(only?: Timer): void {
  if (only !== undefined && only !== current) {
    only.cancel()

    return
  }
  current?.cancel()
  current = undefined
}

export function isRunning(): boolean {
  return current !== undefined
}
