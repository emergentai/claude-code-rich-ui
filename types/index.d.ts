export type EnabledMap = Record<string, boolean>

export type FeatureStatus = {
  error?: { message: string; count: number; at: number }
  notes: string[]
}
export type StatusMap = Record<string, FeatureStatus>

export type ShownMap = Record<string, boolean>

export type UsageLimit = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

// The last reading `session.measure` reported; empty until the first one.
export type UsageSnapshot = {
  contextPercent?: number
  limits: UsageLimit[]
}

// What the markdown preview pane shows: the file it was last pointed at (by the
// person's /preview or the last markdown file Claude wrote), its text, and why
// there is none.
export type PreviewState = {
  path?: string
  text?: string
  isTruncated?: boolean
  error?: string
  lastWritten?: string
}

declare module 'claude-code' {
  interface PluginState {
    'rich-ui': {
      enabled: Shaped<EnabledMap>
      status: Shaped<StatusMap>
      saveFailed: Shaped<boolean>
      shown: Shaped<ShownMap>
      usage: Shaped<UsageSnapshot>
      preview: Shaped<PreviewState>
    }
  }
}
