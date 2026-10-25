# Welcome greeting (experimental)

A big "welcome" in Claude's orange sweeps in from the left above the prompt, holds for half a
second and sweeps out from the left, about two seconds in all, once per session. Pure delight, so it is
**experimental** and off until you turn it on: it may be removed in any future version.

- id `welcome-greeting`, name "Welcome greeting", `defaultEnabled: false`, `isExperimental: true`
- Toggle: its own row in `/rich-ui`, under the **Experimental** header. Off, nothing is drawn and the
  stock UI is untouched.
- Terminal surface only.

## What you see

The word is drawn in pixel capitals (half-block cells, two pixels per cell) in the band above the
prompt, centred and as big as the band allows, in Claude's orange, a touch lighter at the top of the
letters. It floats over the terminal's own background (cells that are not part of a letter keep the
terminal's colours), so it looks the same on a dark or a light theme. A pixel at a time dissolves in
along a front that moves from the left, the word holds for 0.5 s, and the front passes again from the left
to take it away (0.9 s each way). Then the band goes back to the engine's.

- Plays once per session, and again after `/clear`.
- Turned on mid-session it plays at the next redraw, so it can be judged without restarting.
- The band is as wide as the prompt and as tall as the engine allows (`maxRows - 1`, 7 to 28 rows, at
  most half the terminal). A mod cannot draw full-screen.
- Skipped in a window under 50 columns or 24 rows, with no measured window, when the band has fewer than
  8 rows, and while a survey holds the band. It only starts on an idle prompt.
- **It ends the moment a turn starts.** Pressing Enter on a message hands the band back to the engine at
  once, so the greeting never covers the transcript while Claude answers, and it does not come back until
  `/clear`.

## Setting the text

`/rich-ui` has a **Welcome text (20 max)** field under the Welcome greeting row. There is no save step:

- Every edit changes the sign at once, and is written to the store after a 0.4 s pause in typing.
- The field keeps exactly what you type and typing never replaces it, so nothing flickers. It stops at 20
  characters.
- The sign shows the text cleaned to what the pixel font draws: lowercase, letters, digits, `! ? .` and
  `-`, single spaces, 20 characters. An empty field gives "welcome" (nothing is stored for the default).
- A band too narrow for a long word, even in the smallest type, shows as many letters from the start as fit.
- **Enter** writes immediately. The engine empties a text field on Enter (it is a submit, as in the prompt
  box), so the pane then draws a fresh field holding your text, once per Enter, with a brief redraw.
- The text is saved with the on/off choices and comes back in the next session.

## How it runs

One timer, `$.clock.every` at 80 ms (12.5 frames a second), repaints the Raster with `$.ui.blit` (no render
pass); one frame in flight, so a slow host drops frames. While the word holds still nothing is sent. The
timer stops when:

| Event | How |
|---|---|
| The show is over | The timer asks for the redraw that hands the band back. |
| A turn starts (Enter) | The hook sees `isWorking`, cancels and marks the show played. |
| `/clear`, exit, any session end | `session.end`, through the status band's handler (the engine allows one unmatched hook per event). `/clear` also lets it play again. |
| The feature is turned off | The hook reads the toggle, so it draws again, returns the stock band and cancels. |
| The window is too small | The same redraw returns the stock band and cancels. |
| 25 blits in a row are denied | The Raster is gone: the timer cancels itself (about two seconds). |
| A hot reload | The engine cancels a plugin's timers with the old module. |

It registers no hook on `tool.call` or `prompt.*`, so it cannot delay a tool or the prompt. An error in the
hook falls back to the stock band.

## Code

| File | Role |
|---|---|
| `hooks/features/welcome-greeting/index.tsx` | metadata, the `AbovePrompt` hook |
| `hooks/features/welcome-greeting/welcome.ts` | the font, text cleaning, layout, colours and dissolve (pure) |
| `hooks/features/welcome-greeting/frames.ts` | frame rate, window rule, base64, the pacer (pure) |
| `hooks/features/welcome-greeting/clock.ts` | the timer handle and the once-per-session clock |
| `hooks/manager/pane.tsx`, `index.ts`, `size.ts` | the Experimental header, the text field and its saving |
| `hooks/features/status-band/index.tsx` | stops the timer on `session.end` |
| `hooks/register.tsx` | the `on(...)` line |
