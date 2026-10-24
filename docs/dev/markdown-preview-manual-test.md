# Manual test: markdown preview

The tests run under the engine's harness; none of this has been seen in a real pane.
Run in a real terminal from the repo root:

```
claude --plugin-dir .
```

Do each in a fullscreen terminal of 140 or more columns (docked pane) and again in a
narrow window of about 80 columns (inline pane above the prompt), noting any difference.

| # | Do | Expected |
|---|---|---|
| 1 | `/preview README.md` | A pane opens with the file rendered: headings styled, tables as grids, code fenced, links styled. Path as the pane's first line. |
| 2 | Scroll with the wheel, then click into the pane or focus it and use the arrow and page keys | The content scrolls; the top and bottom are reachable. |
| 3 | Esc | The pane closes. |
| 4 | `/preview` in a fresh session | Pane opens saying "No markdown file yet". |
| 5 | Ask Claude to write `notes.md` with a heading, a list and a table, then run `/preview` | The pane shows that file, rendered. |
| 6 | With the pane open, ask Claude to edit a line of `notes.md` | The pane updates by itself after the edit. |
| 7 | Ask Claude to write `code.ts`, then `/preview` | Still shows `notes.md`; the `.ts` file was not remembered. |
| 8 | `/preview missing.md` | The pane shows "Could not read missing.md: ...". |
| 9 | `/preview` on a very large markdown file (over 99000 characters) | The start is shown, with a note that the rest is cut; no error. |
| 10 | `/rich-ui`, turn Markdown preview off, run `/preview x.md` | "Markdown preview is off. Turn it on in /rich-ui." and no pane. Turn it back on and it works. |
| 11 | Quit and restart with it off | Still off. |
| 12 | Light and dark themes | Readable in both. |
| 13 | Open `/rich-ui` while the preview pane is open | Both panes work; Esc closes each in turn; nothing is garbled. |
| 14 | Have Claude write two markdown files in a row | `/preview` shows the second (the latest) one. |

Watch for: anything that slows or breaks a tool call when Claude writes a file (the
tracker wraps every `Write` and `Edit`), a stuck pane, text cut off at the right edge, and
the pane stealing keys from the prompt. Record results in
[`verification-notes.md`](verification-notes.md).
