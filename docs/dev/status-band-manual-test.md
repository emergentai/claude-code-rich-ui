# Manual test: status band

The band only shows when context is at 60% or more, or a plan limit (5h, 7d, spend) is at
75% or more, so a normal session shows nothing. To test every state without filling a real
context window, run once with the thresholds lowered (part 2), then once with the real
ones (part 3).

Run in a real terminal (not the desktop app), from the repo root:

```
cd tools && npm install && cd ..
claude --plugin-dir .
```

## 1. Healthy session (real thresholds)

1. Start a fresh session and send a short message.
2. Expected: nothing under the prompt from rich-ui. No empty row, no stray text.
3. `/rich-ui`: "Status band" is listed and checked.

## 2. Forced states (temporary edit)

Edit `hooks/features/status-band/band.ts`, set these, and restart `claude --plugin-dir .`
(do not commit this edit; `git checkout hooks/features/status-band/band.ts` afterwards):

```
export const CONTEXT_SHOW = 1
export const CONTEXT_WARN = 5
export const LIMIT_SHOW = 1
export const LIMIT_WARN = 5
```

Plan limits only appear for accounts that report them (subscription plans). If yours
does not, the `5h` and `7d` checks are skipped and noted as not run.

| # | Do | Expected |
|---|---|---|
| 1 | Send a message | A line appears in the engine's status row under the prompt: `context ░░░░░░░░ N%` and, if your account reports them, `  ·  5h N% (resets in …)` and `7d …`. Plain text, one line, in the engine's own style. |
| 2 | Send more messages | The context percentage and bar grow; the 5h and 7d figures move when the engine reports a new reading. |
| 3 | Look at the reset time | Reads like `42m`, `2h 05m` or `3d 4h`, never negative; a window already past its reset is not shown. |
| 4 | `/rich-ui`, turn Status band off | The line disappears at once. |
| 5 | Send a message with it off | It stays hidden. |
| 6 | `/rich-ui`, turn it on | The line returns at once with the last reading, without waiting for a message. |
| 7 | Toggle it a few times quickly | No flicker, no duplicate lines, no error notice in the pane. |
| 8 | `/clear` | The line disappears. Send a message: it comes back with the new, small context figure, not the old one. |
| 9 | Quit and restart with Status band off in `/rich-ui` | Nothing shows from the first message (the off choice is remembered). |
| 10 | Turn it back on and restart | It shows again. |

## 3. Real thresholds with a high reading

Revert the edit (`git checkout hooks/features/status-band/band.ts`) and restart. Then
either use a session that is genuinely long (past 60% of the window), or an account close
to a limit:

1. Expected: `context ██████░░ 70%` style line appears once context passes 60%, with the
   bar roughly proportional (8 cells).
2. Expected: the `5h`, `7d` or `spend` segment appears only at 75% or more of that limit.
3. Compare the figures with `/context` and `/usage` (or `/status`): they should agree to
   within a point or two.

## 4. Layout and compatibility

1. Narrow the terminal to about 60 columns with all segments showing: the line must wrap or
   clip without breaking the prompt box or overwriting other rows.
2. Light and dark themes: the text is readable in both.
3. Open the slash menu (`/`) and a survey or permission prompt while the line is showing:
   nothing overlaps or hides the prompt.
4. With the mermaid feature on, draw a diagram while the band shows: the two do not
   interfere.
5. Run `claude --plugin-dir .` in the desktop app or another non-terminal surface if you use
   one: the band should not show or error there (not specified; note what happens).

## 5. Error cases to watch for

- Any stack trace, "hook failed" or red notice in the pane or the debug log
  (`claude --debug` and look for `rich-ui`).
- The line sticking after `/clear`, after a toggle off, or after quitting `/rich-ui`.
- A percentage over 100 or a negative reset time.
- The line showing while Status band is off.

Record results (pass, fail, not run, with the Claude Code version) in
[`verification-notes.md`](verification-notes.md).
