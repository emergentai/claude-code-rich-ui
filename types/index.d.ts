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

// What the markdown preview pane shows: the file whose link was last pressed,
// its text, and why there is none. `request` counts the reads started (a press, or a refresh after
// a write), so a read applies its result only while it is still the latest: a path alone cannot
// tell a read from an earlier press of the same file.
export type PreviewState = {
  path?: string
  request?: number
  text?: string
  isTruncated?: boolean
  error?: string
}

// What the attachment peek knows of the prompt draft. The engine leaves a tag in the draft
// for each dropped image ("[Image #3]").
export type PeekTag = { kind: 'image'; n: number }

// What was learnt of a tag: its size and a small PNG the band can draw (`thumb`, a path, ''
// where there is none).
export type PeekItem = { kind: 'image'; n: number; ext: string; bytes: number; width: number; height: number; thumb: string }

// The tags in the draft, in order, and what is known of them, for one session.
export type PeekView = { session: string; tags: PeekTag[]; items: PeekItem[] }

declare module 'claude-code' {
  interface PluginState {
    'rich-ui': {
      enabled: Shaped<EnabledMap>
      welcome: Shaped<string>
      welcomeRev: Shaped<number>
      'welcome-played': Shaped<boolean>
      status: Shaped<StatusMap>
      saveFailed: Shaped<boolean>
      shown: Shaped<ShownMap>
      'zen-quote': Shaped<number>
      usage: Shaped<UsageSnapshot>
      preview: Shaped<PreviewState>
      'peek-view': Shaped<PeekView>
    }
  }
}
