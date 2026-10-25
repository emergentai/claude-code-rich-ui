import type { Timer } from 'claude-code'

// The frame timers of the aurora features, one per feature id. They are kept here
// because a stop must be reachable from hooks that never see the render hook's closure
// (a turn ending, /clear). A module variable on purpose: a hot reload cancels the
// engine's timers with the old module environment, so a stale handle here can only be
// one already cancelled.
const current = new Map<string, Timer>()

// Replaces any running timer of `id` with `next`.
export function setTicker(id: string, next: Timer): void {
  current.get(id)?.cancel()
  current.set(id, next)
}

// Safe to call at any time, any number of times. With `only`, stops that timer and
// leaves a newer one running (a frame still in flight from a replaced timer).
export function stopTicker(id: string, only?: Timer): void {
  const running = current.get(id)
  if (only !== undefined && only !== running) {
    only.cancel()

    return
  }
  running?.cancel()
  current.delete(id)
}

// Every aurora timer: the turn or the session is over.
export function stopAllTickers(): void {
  for (const timer of current.values()) timer.cancel()
  current.clear()
}

export function runningCount(): number {
  return current.size
}

// When each once-per-session greeting began (ms since the epoch), by feature id: which no
// state needs to carry across a reload.
const plays = new Map<string, number>()

export function playStartedAt(id: string): number | undefined {
  return plays.get(id)
}

export function startPlay(id: string, at: number): void {
  plays.set(id, at)
}

// A /clear is a fresh start: the greetings may play once more.
export function resetGreeting(): void {
  plays.clear()
}
