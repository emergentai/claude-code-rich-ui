# Manual test: the aurora features

Four toggles, all off by default: **Aurora spinner**, **Aurora greeting**, **Aurora pane header**,
**Aurora usage meter**. The tests run under the engine's harness, and a first real run in tmux
(130 x 40, 256 colours, fullscreen UI) saw the spinner swatch, the greeting, the header and a
usage row. Everything below still needs a person in a real terminal, ideally truecolor
(iTerm2, Ghostty, kitty), in a dark and a light theme.

```
claude --plugin-dir <this worktree>
```

Open `/rich-ui` and turn on one feature at a time (Enter or click on its row).

## Aurora spinner

| # | Do | Expected |
|---|---|---|
| 1 | Ask: `Run the shell command: sleep 20 && echo finished. Then say done.` | A 4-cell drifting swatch to the left of the spinner line (`▀▀▀▀ · Thundering… (4s · ↓ 91 tokens)`); the line itself is unchanged, with `esc to interrupt` and the tip. |
| 2 | Wait for the end, or press Esc | The swatch is gone with the spinner. |
| 3 | Shrink the window under 50 columns, or 24 rows, mid-turn | The stock spinner (the swatch goes at the next redraw). |
| 4 | Turn the feature off mid-turn | The swatch disappears. |
| 5 | Type in the prompt while a turn runs | No lag or dropped keys. |
| 6 | Esc during a tool turn, then type while the next turn runs (fullscreen) | No garbled screen. (A garbled redraw was seen once with the earlier band version.) |

## Aurora greeting

| # | Do | Expected |
|---|---|---|
| 7 | Turn it on at an idle prompt | A 3-row aurora sweeps in from the left, holds about 1 s, sweeps out, and leaves no gap above the prompt. |
| 8 | Toggle off and on again | It does not replay (once per session). |
| 9 | `/clear` | It plays once more. |
| 10 | Start a new `claude` with it already on | It plays at startup. |
| 11 | Open a survey or start typing a slash command during it | No overlap, no leftover rows. |

## Aurora pane header

| # | Do | Expected |
|---|---|---|
| 12 | `/rich-ui` with it on | `rich-ui` in pixel type above "rich-ui features", its colours drifting; all rows below still readable and pressable. |
| 13 | Close the pane with Esc, reopen | Header again, no stuck frames. |
| 14 | Turn the header off from the pane | It disappears at once; the pane keeps working. |
| 15 | Inline (narrow) pane and docked pane | Both fit; under about 33 columns it is simply not drawn. |

## Aurora usage meter

Needs context at 60% or a plan limit at 75% to show anything (a long session, or an account near
its limit).

| # | Do | Expected |
|---|---|---|
| 16 | With the meter on and context high | A row above the prompt: `context ▇▇▇▇▇▇░░░ 72%` with a drifting gradient bar, then any limit text. The old text line under the prompt is gone. |
| 17 | Turn the meter off | The text line under the prompt returns. |
| 18 | Healthy session | Nothing extra. |

## Nyan greeting

| # | Do | Expected |
|---|---|---|
| a | Turn it on at an idle prompt | A navy, starry 7-row banner as wide as the window; a nyan cat flies left to right in about 4 s with a rainbow streaming behind it; the banner is gone about 0.3 s after the cat has left, and nothing is left above the prompt. |
| b | Resize the window wider and narrower, then `/clear` | The banner uses the new width; under 50 columns it is skipped; `/clear` plays it again. |
| c | Toggle off mid-flight | It stops at once. |
| d | Light theme | Unchanged (fixed colours); check it is not harsh. |

## Doge greeting

| # | Do | Expected |
|---|---|---|
| e | Turn it on at an idle prompt | A big orange "welcome" fades in from the left in the middle above the prompt, holds about half a second, then fades out from the left, about two and a half seconds in all; the terminal's own background shows around it, no coloured block; nothing is left above the prompt. |
| f | A tall window, a short one (24 rows), a narrow one (under 50 columns) | Taller window, bigger word; a short or narrow one has none. |
| g | Dark and light themes | The orange reads on both. |
| h | `/clear` | It plays again. |
| i | Type a message and press Enter while a greeting (doge, nyan or aurora) is still up | The greeting is gone at once; your message and Claude's answer are fully visible; the greeting does not return. |

## All

| # | Do | Expected |
|---|---|---|
| 19 | Light and dark themes (`/theme`) | Dark: a dim glow. Light: pastel. Text beside stays legible. |
| 20 | Watch CPU during a 60 s tool call | `claude` stays low; compare with everything off. |
| 21 | `claude --debug-file /tmp/x.log` after a session | No `ui.render ... refused` or `skipped` lines for rich-ui. |

Watch for: anything left on screen after its moment, a frozen frame, a flicker of surrounding
rows, colours that are hard to read against, and CPU that does not drop when idle. Record results
in [`verification-notes.md`](verification-notes.md).
