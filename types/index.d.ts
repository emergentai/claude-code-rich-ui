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
// its text, and why there is none.
export type PreviewState = {
  path?: string
  text?: string
  isTruncated?: boolean
  error?: string
}

// What the attachment peek knows of the prompt draft. The engine leaves a tag in the draft
// for each drop or paste ("[Image #3]", "[Pasted text #4 +12 lines]"); `lines` is the
// "+12" of a paste's tag, 0 for an image.
export type PeekTag = { kind: 'image' | 'text'; n: number; lines: number }

// What was learnt of a tag: for an image its size and a small PNG the band can draw
// (`thumb`, a path, '' where there is none); for a paste its opening lines.
export type PeekItem =
  | { kind: 'image'; n: number; ext: string; bytes: number; width: number; height: number; thumb: string }
  | { kind: 'text'; n: number; lines: string[]; more: number; total: number; chars: number }

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
