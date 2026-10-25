# Manual test: welcome greeting (experimental)

The tests run under the engine's harness, and a real tmux run saw the pane section, the saved text and
the band drawing. Everything below still needs a person in a real terminal, ideally truecolor, in a dark
and a light theme.

```
claude --plugin-dir <this worktree>
```

| # | Do | Expected |
|---|---|---|
| 1 | `/rich-ui` | Mermaid, Status band and Markdown preview, then an **Experimental · may be removed in any version** header, then Welcome greeting (off) with a **Welcome text (20 max)** field under it. The summary counts it ("3 of 4 on"). |
| 2 | Turn Welcome greeting on, close the pane | Within a moment a big orange "welcome" sweeps in from the left above the prompt, holds half a second, sweeps out from the left; nothing is left above the prompt. |
| 3 | `/clear` | It plays again; running it twice in a row without `/clear` does not. |
| 4 | Type a message and press Enter while it is still showing | It is gone at once; your message and the answer are fully visible; it does not return. |
| 5 | A short window (under 24 rows), a narrow one (under 50 columns) | No greeting. |
| 6 | Dark and light themes | The orange word reads on both. |
| 7 | `/rich-ui`, type in the text field (try capitals, `!`, 25 letters, an emoji) | The sign changes as you type; the field stops at 20 characters; no flicker and no save step; clearing the field is allowed. |
| 8 | Close and reopen the pane; start a new session | The text is still there. |
| 9 | Press Enter in the text field | The text stays (a brief redraw is expected). |
| 10 | Toggle the greeting off mid-show | It stops at once. |
| 11 | A long word (20 letters) in a 50-column window | The start of the word that fits, not a word cut off at both edges. |
| 12 | Compare CPU during the show and at rest | Nothing noticeable; no activity at all once it is gone. |

Watch for: a band left on screen after the show, a frozen frame, flicker of rows around the band, and
anything delayed when a message is sent. Record results in [`verification-notes.md`](verification-notes.md).
