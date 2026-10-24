import type { Register } from 'claude-code'

import { renderPane, renderResult } from './spike'

export const register: Register = on => {
  on('ui.render', { component: 'ToolResult' }, renderResult)
  on('ui.render', { component: 'Pane', requestId: 'spike-output' }, renderPane)
}
