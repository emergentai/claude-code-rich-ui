import type { Register } from 'claude-code'

import { renderSpinner, renderToolProgress, renderTurnDuration } from './features/calm-spinner'
import { refreshOnWrite, renderLinkedReply, renderPreview } from './features/markdown-preview'
import { renderAssistantMessage } from './features/mermaid'
import { advanceFooter, renderInfoNotice, renderPromptHint } from './features/quiet-footer'
import { onSessionEnd, recordUsage } from './features/status-band'
import { renderWelcome } from './features/welcome-greeting'
import { renderPane, runCommand, startSession } from './manager'

// The engine only accepts literal `on("event", hook)` calls here, so `on` is
// never wrapped or passed on, and every hook is listed below by the name of an
// exported handler. Each feature handler checks its own feature's flag.
export const register: Register = on => {
  on('session.start', startSession)
  on('command.run', { command: 'rich-ui' }, runCommand)
  on('ui.render', { component: 'Pane', requestId: 'rich-ui' }, renderPane)

  on('ui.render', { component: 'AssistantMessage' }, renderAssistantMessage)

  on('tool.call', refreshOnWrite)
  on('ui.render', { component: 'AssistantMessage' }, renderLinkedReply)
  on('ui.render', { component: 'Pane', requestId: 'rich-ui-preview' }, renderPreview)

  on('ui.render', { component: 'AbovePrompt' }, renderWelcome)

  on('ui.render', { component: 'Spinner' }, renderSpinner)
  on('ui.render', { component: 'TurnDuration' }, renderTurnDuration)
  on('ui.render', { component: 'ToolProgress' }, renderToolProgress)

  on('turn.complete', advanceFooter)
  on('ui.render', { component: 'PromptHint' }, renderPromptHint)
  on('ui.render', { component: 'InfoNotice' }, renderInfoNotice)

  on('session.measure', recordUsage)
  on('session.end', onSessionEnd)
}
