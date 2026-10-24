import type { Register } from 'claude-code'

import { renderGroup, renderPane } from './spike'

export const register: Register = on => {
  on('ui.render', { component: 'ToolGroup' }, renderGroup)
  on('ui.render', { component: 'Pane', requestId: 'spike-output' }, renderPane)
}
