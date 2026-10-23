import type { Register } from 'claude-code'

import { renderAssistantMessage } from './features/mermaid'
import { renderBand, runCommand, startSession } from './manager'

// The engine only accepts literal `on("event", hook)` calls here, so `on` is
// never wrapped or passed on, and every hook is listed below by the name of an
// exported handler. Each feature handler checks its own feature's flag.
export const register: Register = on => {
  on('session.start', startSession)
  on('command.run', { command: 'rich-ui' }, runCommand)
  on('ui.render', { component: 'AbovePrompt' }, renderBand)

  on('ui.render', { component: 'AssistantMessage' }, renderAssistantMessage)
}
