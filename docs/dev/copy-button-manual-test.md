# Manual test: copy code

The tests run under the engine's harness. Rows 1-4, 6, 8 and 12 and a 70-column window were also run by hand in claude 2.1.310 under tmux with real mouse clicks (all passed); the rest are still open.

```
claude --plugin-dir <path to this worktree>
```

Use a fullscreen terminal and also a main-screen one. Paste into a text editor or the prompt
to see what was copied.

| # | Ask Claude / do | Expected |
|---|---|---|
| 1 | "Reply with a 5-line python code block." | A dim `copy code` row under the reply, indented past the bullet. Press it: toast `Copied 5 lines`; paste shows the code only (no ``` lines, no trailing blank line). |
| 2 | "Reply with a ts block and a bash block, each 3 lines." | `copy 1 (ts)  copy 2 (bash)`; each copies its own block. |
| 3 | "Reply with only `npm install`  in a bash block." | No row (one short line). |
| 4 | A bash block with one 100-character line | A `copy code` row. |
| 5 | A code block inside a numbered list item (indented) | Button present; pasted code is flush left, no list indent. |
| 6 | A reply with a mermaid diagram and a ts block | Diagram and `show source` toggle as before; one `copy code` row for the ts block only; `show source` still swaps and back. |
| 7 | A mermaid diagram only | No copy row. |
| 8 | A reply with a link to a `.md` file and a code block | Link still opens the preview pane; the copy row is there. |
| 9 | Watch a long reply with a code block stream | No row until the fence closes; nothing flickers in for the unfinished block. |
| 10 | Click the button with the mouse and also Tab/Enter if the terminal focuses it | Copies either way. |
| 11 | A terminal with no clipboard tool and no OSC 52 (e.g. old VTE, or SSH without forwarding) | Toast `Could not copy: no-clipboard` or success from OSC 52; note which. |
| 12 | `/rich-ui`, turn "Copy code" off | Every copy row, old replies included, goes away; turn it on and they return. Everything else unchanged. |
| 13 | Compare a reply with a block against stock (feature off) | Same text, spacing and wrapping; the only difference is the added row. |
| 14 | Narrow window (40 columns) with three blocks | The row wraps to two lines at most; nothing overflows. |
| 15 | Light and dark themes | The row is readable but quiet. |
| 16 | Scroll back up past old replies and press an old reply's button | Copies that reply's block. |
| 17 | A ````markdown block that contains a ```ts block | One button; paste includes the inner fence lines. |

Watch for: layout shift of the reply above the row, the row showing on a summary line,
a doubled bullet, the toast lasting too long, and mermaid's toggle losing its place.
Record results in [`verification-notes.md`](verification-notes.md).
