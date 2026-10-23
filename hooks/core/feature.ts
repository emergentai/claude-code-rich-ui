import type { EngineInterface, On } from 'claude-code'

export type GatedOn = On

export type FeatureContext = {
  id: string
  postNote: ($: EngineInterface, text: string) => void
}

export type Feature = {
  id: string
  name: string
  description: string
  defaultEnabled: boolean
  register: (on: GatedOn, ctx: FeatureContext) => void
}
