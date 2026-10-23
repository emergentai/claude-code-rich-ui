import type { FeatureStatus, StatusMap } from '../../types'

// Pure helpers over the status map. The engine's module scan rejects a function
// that is handed `$`, so the state writes themselves are written inline in each
// hook (`$.clock.after(0, ...)` then `update($, statusAtom, map => withError(...))`).
// The writes are deferred because the engine refuses state writes while a
// ui.render hook draws, and errors and notes are raised from render hooks.

const EMPTY: FeatureStatus = { notes: [] }

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function withError(
  map: StatusMap,
  id: string,
  message: string,
  at: number,
): StatusMap {
  const previous = map[id] ?? EMPTY

  return {
    ...map,
    [id]: {
      ...previous,
      error: { message, count: (previous.error?.count ?? 0) + 1, at },
    },
  }
}

export function withNote(map: StatusMap, id: string, text: string): StatusMap {
  const previous = map[id] ?? EMPTY
  if (previous.notes.includes(text)) return map

  return { ...map, [id]: { ...previous, notes: [...previous.notes, text] } }
}

export function withoutStatus(map: StatusMap, id: string): StatusMap {
  if (!(id in map)) return map
  const { [id]: _removed, ...rest } = map

  return rest
}
