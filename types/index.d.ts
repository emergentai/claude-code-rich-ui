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

declare module 'claude-code' {
  interface PluginState {
    'rich-ui': {
      enabled: Shaped<EnabledMap>
      status: Shaped<StatusMap>
      saveFailed: Shaped<boolean>
      shown: Shaped<ShownMap>
      usage: Shaped<UsageSnapshot>
    }
  }
}
