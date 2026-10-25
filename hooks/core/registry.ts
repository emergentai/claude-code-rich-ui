import { calmSpinner } from '../features/calm-spinner'
import { markdownPreview } from '../features/markdown-preview'
import { mermaid } from '../features/mermaid'
import { quietFooter } from '../features/quiet-footer'
import { statusBand } from '../features/status-band'
import { welcomeGreeting } from '../features/welcome-greeting'
import type { Feature } from './feature'

export const features: Feature[] = [
  mermaid,
  markdownPreview,
  statusBand,
  welcomeGreeting,
  calmSpinner,
  quietFooter,
]
