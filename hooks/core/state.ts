import { atom } from 'claude-code'
import type { EnabledMap, ShownMap, StatusMap } from '../../types'

export const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const statusAtom = atom(
  { plugin: 'rich-ui', key: 'status' } as const,
  {} as StatusMap,
  { shape: 'status-1' },
)

export const saveFailedAtom = atom(
  { plugin: 'rich-ui', key: 'saveFailed' } as const,
  false,
  { shape: 'save-failed-1' },
)

export const shownAtom = atom(
  { plugin: 'rich-ui', key: 'shown' } as const,
  {} as ShownMap,
  { shape: 'shown-1' },
)
