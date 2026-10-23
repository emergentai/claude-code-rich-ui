# rich-ui: live verification notes

Run with `claude --plugin-dir .` in a real terminal, Claude Code 2.1.309.

## Result

The live check of v0.1.0 passed (reported by the owner): `/rich-ui` opens the pane, diagrams draw, and the source toggle and feature toggle work.

## Open items from the implementation plan (Task 13, step 3)

1. **Streaming:** yes. An unclosed fence stays raw and swaps to the diagram once closed.
2. **Viewport and margin:** yes. The viewport is available, and a diagram resizes (flips direction or falls back) to fit the window.
3. **Themes:** no. The dim styling is not right across themes. The drawing should follow the terminal's theme (or at least the system's). The light theme looked bad. Fixed in code: diagram lines now use the engine's `subtle` theme color instead of `dimColor`; needs a re-check in a light and a dark theme.
4. **Toggle redraw:** yes. Only that message redraws.
5. **ELK-only syntax** (decision: do not allow `xychart-beta` yet; it stays a code block): the premise was wrong. Per a direct run of the vendored renderer (owner's pasted result), the ELK stub is never reached on the ASCII path. Subgraphs, including nested ones and cross-boundary edges, render correctly as boxes inside boxes (an early failure came from writing `A-->B` with no spaces and no labels). `xychart-beta` renders as an ASCII bar chart (only a small chart was tried). Types the renderer does not support (mindmap, pie, gantt, journey) throw "Invalid mermaid header" and fall back to code. Note that the feature's own header check (`sanity.ts`) admits only the five supported types, so `xychart-beta` stays a code block in rich-ui regardless.
6. **Feature off:** the toggle applies to every mermaid diagram in the chat at once, in both directions (off reverts all of them to code, on draws all of them), because the flag is read on each redraw. The owner prefers this. The plan's note that earlier diagrams stay as drawn is wrong and must be corrected in the docs.
7. **Persistence:** yes. The toggle is remembered after quitting and reopening.
8. **Uninstall and where `$.store` lives:** unknown. Needs a marketplace install, so it waits until the repository is pushed.

## Supported diagram types

Only these five mermaid diagram types are rendered and supported:

- flowchart (`graph` / `flowchart`)
- sequence (`sequenceDiagram`)
- class (`classDiagram`)
- state (`stateDiagram`, `stateDiagram-v2`)
- entity relationship (`erDiagram`)

Everything else (gantt, pie, journey, gitGraph, mindmap, and so on) is not rendered and not supported: it stays a normal code block. The user docs and README must say this plainly and not imply wider coverage.
