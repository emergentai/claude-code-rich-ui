// A feature is its metadata plus the hook handlers it exports. The engine only
// allows literal `on("event", hook)` calls in register.tsx, so register.tsx
// wires each handler with `gated(feature, handler)`; features never see `on`.
export type Feature = {
  id: string
  name: string
  description: string
  defaultEnabled: boolean
}
