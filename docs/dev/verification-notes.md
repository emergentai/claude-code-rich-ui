# rich-ui: live verification notes

Run with `claude --plugin-dir .` in a real terminal, Claude Code 2.1.309.

## Result

The live check of v0.1.0 passed (reported by the owner): `/rich-ui` opens the pane, diagrams draw, and the source toggle and feature toggle work. The finer open items in the implementation plan, Task 13 step 3 (streaming, viewport margin, themes, scroll on toggle, ELK-only syntax, uninstall data), have not been recorded individually yet.

## Supported diagram types

Only these five mermaid diagram types are rendered and supported:

- flowchart (`graph` / `flowchart`)
- sequence (`sequenceDiagram`)
- class (`classDiagram`)
- state (`stateDiagram`, `stateDiagram-v2`)
- entity relationship (`erDiagram`)

Everything else (gantt, pie, journey, gitGraph, mindmap, and so on) is not rendered and not supported: it stays a normal code block. The user docs and README must say this plainly and not imply wider coverage.
