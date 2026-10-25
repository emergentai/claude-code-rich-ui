import type { Timer } from 'claude-code'

// The greeting's one frame timer and its once-per-session clock, kept here because a stop
// must be reachable from hooks that never see the render hook's closure (the session ending,
// /clear). Module variables on purpose: a hot reload cancels the engine's timers with the old
// module environment, so a stale handle here can only be one already cancelled.
let current: Timer | undefined
let startedAt: number | undefined

// Replaces any running timer with `next`.
export function setTicker(next: Timer): void {
  current?.cancel()
  current = next
}

// Safe to call at any time, any number of times. With `only`, stops that timer and leaves
// a newer one running (a frame still in flight from a replaced timer).
export function stopTicker(only?: Timer): void {
  if (only !== undefined && only !== current) {
    only.cancel()

    return
  }
  current?.cancel()
  current = undefined
}

// When the greeting began (ms since the epoch), once per session.
export function playStartedAt(): number | undefined {
  return startedAt
}

export function startPlay(at: number): void {
  startedAt = at
}

// The session ended or was cleared: stop painting, and let it play once more after a /clear.
export function resetGreeting(): void {
  stopTicker()
  startedAt = undefined
}
