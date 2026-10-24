# Manual test: markdown preview

The tests run under the engine's harness; none of this has been seen in a real terminal.
A link click reaches the plugin only in a fullscreen terminal, so test there first.

```
claude --plugin-dir .
```

Set up: have a few markdown files, for example `README.md` and `docs/usage.md` in this repo,
and a long one over 99000 characters.

## Does the link work at all? (the open question)

1. Ask Claude: "Reply with exactly: See [the readme](README.md), [usage](docs/usage.md) and
   [the readme by full path](/Users/<you>/EmergentAI/claude-code-rich-ui/README.md)." (use your
   real absolute path).
2. Do the three links look like links (underlined or coloured)? Relative links may not.
   **Note which do.**
3. Click each with a plain single click. Expected: the pane opens with the file rendered.
   **Note which links answer to a click.** If relative ones are plain text or do nothing, the
   fix is to ask Claude to use absolute paths or `file://` links, or rewrite relative links in
   the plugin.

## Behaviour

| # | Do | Expected |
|---|---|---|
| 1 | Click a link to a markdown file | Pane opens beside the transcript (wide window) or above the prompt, showing the file rendered, with the path on the first line. |
| 2 | Wheel-scroll the pane; click into it and use arrows/page keys | Content scrolls to the top and bottom. |
| 3 | Esc | The pane closes. |
| 4 | Click a second link while the pane is open | The pane shows the second file. |
| 5 | Ask Claude to edit a line of the file on show | The pane updates by itself. |
| 6 | Link to a file that does not exist | The pane shows "Could not read ...". |
| 7 | Link to a file over 99000 characters | The start is shown with a note that the rest is cut. |
| 8 | A link to a `.ts` file, a web link to a `.md`, and `docs/usage.md` in backticks | None opens the pane; they look and act as before. |
| 9 | A reply with a mermaid diagram and a markdown link | The diagram draws; the link is not clickable (known). |
| 10 | `/rich-ui`, turn Markdown preview off, click a link | Nothing opens. Turn it on and it works again. |
| 11 | A long reply with a link: compare its look with a reply without a link | Same text styling, tables and code blocks, bullet and indent; nothing missing or shifted. |
| 12 | Main-screen (non-fullscreen) terminal | Clicking does nothing new; no errors. |
| 13 | Light and dark themes | Readable in both. |
| 14 | Open `/rich-ui` while the preview pane is open | Both work; Esc closes each in turn. |

Watch for: anything that slows or breaks a tool call (the refresh hook wraps every `Write` and
`Edit`), a stuck pane, replies drawn differently from stock when they hold a link, and the
pane stealing keys from the prompt. Record results in [`verification-notes.md`](verification-notes.md).
