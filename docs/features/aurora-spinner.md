# Aurora spinner

While Claude works, a slowly shifting gradient (teal, green, blue, violet) is drawn above the
spinner line, three rows tall, and goes away when the turn ends. Pure delight: it tells you
nothing the spinner does not, so it is off until you turn it on.

- id `aurora-spinner`, name "Aurora spinner", `defaultEnabled: false`
- Toggle: its own row in `/rich-ui`. Off, the spinner is exactly Claude Code's own.
- Terminal surface only. The desktop app and VS Code keep their own spinner.

## What you see

The spinner line is not touched. The mod asks the engine for the spinner it would have drawn
(the verb, the elapsed time, tokens, effort, `esc to interrupt`, the tool timer and the tips)
and puts the band above it, so what Claude is doing stays exactly as visible as without the mod.

The band is a `Raster` of half-block cells, two pixels per cell, so it is 3 rows by 6 pixels
and as wide as the window (up to 120 columns). The field is a plasma: a few sine waves
summed, mapped onto a cyclic aurora palette, with a second slow wave for the curtain
brightness. One drift takes about half a minute; a frame changes a colour channel by
a few steps out of 255.

## Theme

A `Raster` takes raw colours, not theme keys, so the band reads the `theme` setting when the
spinner is drawn:

| Theme | Look |
|---|---|
| `dark`, `dark-daltonized`, `dark-ansi` | Colours dimmed toward black: a soft glow, not a glare. |
| `light`, `light-daltonized`, `light-ansi` | Colours washed toward white: pastel curtains. |
| `auto`, a custom theme | A middle tone. `auto` follows the terminal, which a mod cannot see. |

A theme changed in the middle of a turn shows from the next turn. In a 256-colour terminal
(tmux without truecolor) the gradient is quantized and looks coarser.

## Decisions

- **Wrap, do not replace.** The spinner site allows a tree in place of the whole line, but the
  line carries things no prop exposes (elapsed time, tokens, the tool timer, the interrupt hint).
  A tree would lose them. Wrapping `next(e)` keeps all of it. The mod never rewrites `word`,
  `message` or `suffix`.
- **Frame rate: 12.5 fps** (80 ms), the cap. The engine takes 60 blits a second; a slow drift
  gains nothing from more. One frame costs about 0.15 ms to compute for 120 columns (measured in
  Node), so about 0.2% of a core, plus one `$.ui.blit` round trip per frame.
- **No render pass per frame.** The spinner hook runs when the word, mode or message changes
  (checked in the engine's source), not on every frame. A timer repaints the mounted Raster
  with `$.ui.blit`, which skips the render pass.
- **One frame in flight.** If the host is slower than a frame, the next frame is dropped, not
  queued.

## When it stops

There is one timer, and it is cancelled by each of these:

| Event | How |
|---|---|
| The turn ends, is interrupted or fails | `turn.complete` for the main loop (a subagent's end is ignored). Immediate. |
| `/clear`, exit, any session end | `session.end`, through the status band's handler (the engine allows one unmatched hook per event). |
| The feature is turned off | The spinner hook reads the toggle, so it draws again, returns the stock line and cancels. |
| The window becomes narrow or short | The same redraw falls back to the stock line and cancels. |
| The spinner went away without an event | 25 blits in a row denied (about two seconds), then the timer cancels itself. |
| A hot reload | The engine cancels a plugin's timers with the old module. |

Starting a second timer cancels the first, so there is never more than one.

## Narrow and short windows

The band needs a measured window at least 50 columns wide and 24 rows tall. Below that, or with
no measurement, the stock spinner is drawn and no timer runs. The width is checked when the
spinner is drawn, and a width change redraws it; a change of height alone does not, so a window
made shorter in mid-turn keeps the band until the next redraw.

## Does it get in the way

It registers no hook on `tool.call`, `prompt.submit` or any other event on the path of a tool
or the prompt. Its two hooks are the spinner draw, which awaits only the engine's own drawing,
the toggle and the theme, and `turn.complete`, which stops the timer synchronously and returns
the engine's answer unchanged. Any error in the spinner hook falls back to the stock line.

## Limits

- Two spinners on screen at once share the one timer: the one drawn last animates, the other
  shows a still frame. This is not expected in normal use.
- The band sits above the tool list line and below the transcript, between the last message
  and the spinner line.

## Code

| File | Role |
|---|---|
| `hooks/features/aurora-spinner/aurora.ts` | the field, palette, tone, band size, base64 (pure) |
| `hooks/features/aurora-spinner/ticker.ts` | the one timer handle and its stop |
| `hooks/features/aurora-spinner/index.tsx` | metadata, the spinner hook, the `turn.complete` hook |
| `hooks/features/status-band/index.tsx` | calls `stopAurora()` from its `session.end` handler |
| `hooks/register.tsx` | the two `on(...)` lines |
