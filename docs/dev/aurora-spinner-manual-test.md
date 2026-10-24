# Manual test: aurora spinner

The unit tests run under the engine's harness. A first real run in tmux (130 x 40, 256 colours)
saw the band animate, keep the stock line, and disappear at the end of a turn and on Esc.
Everything in the table below still needs a person in a real terminal, ideally a truecolor one
(iTerm2, Ghostty, kitty) in both a dark and a light theme.

```
claude --plugin-dir <this worktree>
```

The feature is off by default: run `/rich-ui` and press the **Aurora spinner** row first.

To get a turn that lasts, ask: `Run the shell command: sleep 20 && echo finished. Then say done.`
or `Count from 1 to 40, one per line, with a fun fact each.`

| # | Do | Expected |
|---|---|---|
| 1 | Start `claude` with the mod and ask for a 20 second turn without turning the feature on | The stock spinner only. |
| 2 | `/rich-ui`, turn Aurora spinner on, ask for the 20 second turn | A 3-row gradient appears above the spinner line and drifts slowly; no flicker. |
| 3 | Look at the spinner line while it runs | The verb, `(12s · ↓ 300 tokens)`, `esc to interrupt` and the tip are all there, unchanged. |
| 4 | Wait for the turn to end | The band is gone at the same moment the `Cooked for 20s` line appears. |
| 5 | Start a turn and press Esc | The band is gone at once. |
| 6 | After a turn, run `/clear`, then start a new turn | A fresh turn animates normally; nothing stale from the last one. |
| 7 | Mid-turn, open `/rich-ui` and turn the feature off | The band disappears and the stock spinner remains. Turn it on: it returns on the next redraw (the next word or mode change). |
| 8 | Shrink the window under 50 columns mid-turn | The band is replaced by the stock spinner. Widen it again: it returns at the next redraw. |
| 9 | Start a turn in a window under 24 rows | The stock spinner. |
| 10 | Dark theme (`/theme`), then light | Dark: a dim glow. Light: pastel. Neither hurts to read, and the text around stays legible. |
| 11 | Type in the prompt while a turn runs | Keys are not delayed or dropped; the prompt echoes immediately. |
| 12 | Ask for a long tool call (a 60 second sleep) and watch CPU in Activity Monitor | The terminal and `claude` process stay low (a few percent at most); compare with the feature off. |
| 13 | A turn that asks a permission question | The band is not drawn over the dialog; it resumes (or not) afterwards, no stuck frame. |
| 14 | tmux or screen, and a terminal over ssh | Works, or falls back; note any garbage characters. |
| 15 | After many turns, check `claude --debug-file` output | No `ui.render ... refused` or `skipped` lines mentioning rich-ui. |

Watch for: a band left on screen after a turn, a band that freezes while the spinner counts on,
a flicker of the whole spinner area, colours that are hard on the eyes, and CPU that does not
fall when the turn ends. Record results in [`verification-notes.md`](verification-notes.md).
