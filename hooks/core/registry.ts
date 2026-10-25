import { markdownPreview } from '../features/markdown-preview'
import { mermaid } from '../features/mermaid'
import { statusBand } from '../features/status-band'
import { welcomeGreeting } from '../features/welcome-greeting'
import type { Feature } from './feature'

export const features: Feature[] = [mermaid, statusBand, markdownPreview, welcomeGreeting]
