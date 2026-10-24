import { auroraSpinner } from '../features/aurora-spinner'
import { markdownPreview } from '../features/markdown-preview'
import { mermaid } from '../features/mermaid'
import { statusBand } from '../features/status-band'
import type { Feature } from './feature'

export const features: Feature[] = [mermaid, statusBand, markdownPreview, auroraSpinner]
