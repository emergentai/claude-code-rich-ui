// What the pane shows: the result whose button was pressed last.
export type Shown = {
  id: string
  tool: string
  // The text the pane draws, with ANSI removed.
  text: string
  // The size of the whole output, in lines, before the pane's row cap.
  total: number
  // Why the text is not the whole output, when it is not.
  note?: string
  // 'copied' after a copy press, or why a copy failed.
  copy?: string
}

declare module 'claude-code' {
  interface PluginState {
    'scrollback-spike': { shown: Shaped<Shown | null> }
  }
}
