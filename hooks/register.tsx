import type { Register } from 'claude-code'

import { startSession } from './core/prefs'
import { renderAssistantMessage } from './features/mermaid'

// The engine only accepts literal `on("event", hook)` calls here, so `on` is
// never wrapped or passed on, and every hook a feature adds is listed below by
// the name of an exported handler. Each handler checks its own feature's flag.
export const register: Register = on => {
  on('session.start', startSession)
  on('ui.render', { component: 'AssistantMessage' }, renderAssistantMessage)
}
