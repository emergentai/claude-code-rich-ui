import type { Register } from 'claude-code'

import { renderDoge } from './features/doge-greeting'
import { renderGreeting } from './features/aurora-greeting'
import { renderHeader } from './features/aurora-header'
import { renderMeter } from './features/aurora-meter'
import { onTurnComplete, renderSpinner } from './features/aurora-spinner'
import { renderNyan } from './features/nyan-greeting'
import { refreshOnWrite, renderLinkedReply, renderPreview } from './features/markdown-preview'
import { renderAssistantMessage } from './features/mermaid'
import { onSessionEnd, recordUsage } from './features/status-band'
import { renderPane, runCommand, startSession } from './manager'

// The engine only accepts literal `on("event", hook)` calls here, so `on` is
// never wrapped or passed on, and every hook is listed below by the name of an
// exported handler. Each feature handler checks its own feature's flag.
export const register: Register = on => {
  on('session.start', startSession)
  // Before the manager's own pane hook: an earlier hook wraps the later ones, and the
  // manager answers without calling next, so a header registered after it never runs.
  on('ui.render', { component: 'Pane', requestId: 'rich-ui' }, renderHeader)
  on('command.run', { command: 'rich-ui' }, runCommand)
  on('ui.render', { component: 'Pane', requestId: 'rich-ui' }, renderPane)

  on('ui.render', { component: 'AssistantMessage' }, renderAssistantMessage)

  on('tool.call', refreshOnWrite)
  on('ui.render', { component: 'AssistantMessage' }, renderLinkedReply)
  on('ui.render', { component: 'Pane', requestId: 'rich-ui-preview' }, renderPreview)

  on('ui.render', { component: 'Spinner' }, renderSpinner)
  on('ui.render', { component: 'AbovePrompt' }, renderGreeting)
  on('ui.render', { component: 'AbovePrompt' }, renderMeter)
  on('ui.render', { component: 'AbovePrompt' }, renderNyan)
  on('ui.render', { component: 'AbovePrompt' }, renderDoge)
  on('turn.complete', onTurnComplete)

  on('session.measure', recordUsage)
  on('session.end', onSessionEnd)
}
