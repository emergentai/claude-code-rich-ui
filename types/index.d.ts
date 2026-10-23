export type EnabledMap = Record<string, boolean>

export type FeatureStatus = {
  error?: { message: string; count: number; at: number }
  notes: string[]
}
export type StatusMap = Record<string, FeatureStatus>

export type ShownMap = Record<string, boolean>

declare module 'claude-code' {
  interface PluginState {
    'rich-ui': {
      enabled: Shaped<EnabledMap>
      status: Shaped<StatusMap>
      saveFailed: Shaped<boolean>
      shown: Shaped<ShownMap>
    }
  }
}
