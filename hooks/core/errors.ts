import { update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FeatureStatus } from '../../types'
import { statusAtom } from './state'

const EMPTY: FeatureStatus = { notes: [] }

export async function addError(
  $: EngineInterface,
  id: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const at = await $.clock.now()
  await update($, statusAtom, map => {
    const previous = map[id] ?? EMPTY

    return {
      ...map,
      [id]: {
        ...previous,
        error: { message, count: (previous.error?.count ?? 0) + 1, at },
      },
    }
  })
}

export async function addNote(
  $: EngineInterface,
  id: string,
  text: string,
): Promise<void> {
  await update($, statusAtom, map => {
    const previous = map[id] ?? EMPTY
    if (previous.notes.includes(text)) return map

    return { ...map, [id]: { ...previous, notes: [...previous.notes, text] } }
  })
}

export async function clearStatus(
  $: EngineInterface,
  id: string,
): Promise<void> {
  await update($, statusAtom, map => {
    if (!(id in map)) return map
    const { [id]: _removed, ...rest } = map

    return rest
  })
}

// The engine refuses state writes while a ui.render hook draws, and errors and
// notes are raised from render hooks, so these hand the write to a timer.
export function reportError(
  $: EngineInterface,
  id: string,
  error: unknown,
): void {
  void $.clock.after(0, () => addError($, id, error))
}

export function reportNote(
  $: EngineInterface,
  id: string,
  text: string,
): void {
  void $.clock.after(0, () => addNote($, id, text))
}
