# Aurora spinner (and the other aurora features)

A family of four small, off-by-default features that use the half-block `Raster` to put a
slowly shifting aurora gradient (teal, green, blue, violet) where it adds no clutter. An
earlier version drew a 3-row band above the spinner; it looked like added furniture and was
replaced. Each feature has its own row in `/rich-ui`, is terminal-only, and when off leaves
the stock UI untouched.

| Feature | id | Where | When |
|---|---|---|---|
| Aurora spinner | `aurora-spinner` | a 4x1 swatch to the left of the spinner line | while Claude works |
| Aurora greeting | `aurora-greeting` | a 3-row band above the prompt | once per session (and after `/clear`), about 2.8 s |
| Aurora pane header | `aurora-header` | the `rich-ui` wordmark in pixel type above the `/rich-ui` pane | while the pane is open |
| Aurora usage meter | `aurora-meter` | the status band as a row above the prompt with a gradient bar | only when the status band would show |
| Nyan greeting | `nyan-greeting` | a 7-row banner across the whole window above the prompt | once per session (and after `/clear`), about 4.3 s |
| Doge greeting | `doge-greeting` | a centred doge face with "welcome" under it above the prompt, dissolving away | once per session (and after `/clear`), about 4 s |

## Aurora spinner

While Claude works, a four-cell, one-row swatch drifts to the left of the spinner block. The
stock block is kept whole: the hook awaits `next(e)` (the engine's own drawing: the verb,
elapsed time, tokens, `esc to interrupt`, the tool timer, the tips) and places it to the right
of the swatch. The mod never rewrites `word`, `message` or `suffix`. The swatch is pushed down
one row (`marginTop`) because the stock block starts with a blank row.

- Frame rate 12.5 fps (80 ms) through `$.clock.every` and `$.ui.blit`, one frame in flight (a
  slow host drops frames; nothing queues). A frame costs well under a millisecond.
- The spinner hook runs when the word, mode or message changes (the engine's source memoizes
  the render input on those), not on every frame.
- A window under 50 columns or 24 rows, or with no measured size, keeps the stock line.

## Aurora greeting

On the first idle draw of the band above the prompt, a 3-row aurora sweeps in from the left over
0.9 s, holds for 1 s and sweeps out over 0.9 s, then the band goes back to the engine's. It plays
once per session and again after `/clear`. Turned on mid-session it plays at the next redraw, so
it can be judged without restarting. It does not start while a turn is running or a survey holds
the band. A redraw during the sweep continues it from the clock; it never restarts.

## Aurora pane header

The word `rich-ui` in a 5-pixel-tall block font (31 columns by 3 rows, half-block cells), its
pixels filled with the drifting field, above the pane's own content. It wraps the manager's pane
hook, which is why its `on(...)` line sits before the manager's in `hooks/register.tsx` (an
earlier hook wraps later ones, and the manager answers without calling `next`). The pane's
height is raised by 4 rows only while the header is on. Panes narrower than 33 columns are drawn
without it. When the pane closes, the repaint is denied and the timer ends within about 2 s.

## Aurora usage meter

Takes over the status band: the same segments with the same thresholds (context from 60%, plan
limits from 75%; a healthy session shows nothing), drawn as one row above the prompt with the
context bar as a gradient that drifts, filled to the context percent over a dim shade. Plan limits
stay plain text beside it. While this is on, the status band's own text line in the status row
is cleared, so the same figures are never shown twice, and restored when it is off. Needs a band
at least 44 columns wide, and yields to a survey. Only a context segment animates; a limit alone
starts no timer.

## Nyan greeting

The same shape as the aurora greeting (it shares its timer, pacer and once-per-session clock), but
a picture: a pixel-art nyan cat (24 by 14 pixels, two walking frames) flies from off the left edge
to off the right over 4 s whatever the window's width, a six-stripe rainbow streaming from the left
edge to its body, bending a pixel every three columns, over a navy sky with twinkling stars. It is
drawn in half-block cells (two pixels per cell), 7 rows tall and as wide as the band (up to 400
columns, the Raster allows 512), then the band goes back to the engine's after a 0.3 s hold. The
colours are fixed (it is a picture, not themed). Skipped under 50 columns or 24 rows, while a turn
runs or a survey holds the band. `nyan.ts` is pure: `pixelAt(x, y, ms, width)` is the whole scene.

## Doge greeting

A shiba face in the middle of the band, three-quarter view, eyes glancing aside (modelled on the
well-known photo, drawn by us from shapes), with "welcome" in lowercase pixel type centred below it.
Both sit over the terminal's own background (cells that are not part of the picture keep the
terminal's colours, so the face floats like a cut-out), and the whole picture dissolves in over
0.45 s, holds 1.8 s, and dissolves away over 1.7 s (about four seconds in all): each pixel has
a fixed random threshold and shows while the fade is past it, so it fades without needing to know
the background colour. Then the band goes back to the engine's. Once per session and again after
`/clear`. The caption follows the theme (light on dark, dark on light, mid grey on `auto`); the face
is the same everywhere.

The face is sized by the band's height less the caption, and centred; the band is as wide as the
prompt and as tall as the engine allows (`maxRows - 1`, 7 to 28 rows, at most half the terminal), so
the face is largest in a tall window. A mod cannot draw full-screen, so there is no taller option.
Skipped when the band has fewer than 8 rows, under 50 columns or 24 rows, or while a turn runs or
a survey holds the band. `doge.ts` is pure: `facePixel(u, v)` is the face in a unit frame.

## Theme

The aurora features read the `theme` setting; the nyan greeting does not.

A `Raster` takes raw colours, so each feature reads the `theme` setting when it draws.

| Theme | Look |
|---|---|
| `dark`, `dark-daltonized`, `dark-ansi` | Colours dimmed toward black: a soft glow, not a glare. |
| `light`, `light-daltonized`, `light-ansi` | Colours washed toward white: pastel. |
| `auto`, a custom theme | A middle tone. `auto` follows the terminal, which a mod cannot see. |

A theme changed mid-turn shows from the next draw. In a 256-colour terminal (tmux without
truecolor) the gradient is quantized and looks coarser.

## When timers stop

There is at most one timer per feature (`aurora-common/ticker.ts`); starting one cancels the
previous.

| Event | Spinner | Greeting | Header | Meter |
|---|---|---|---|---|
| Turn ends, is interrupted or fails (`turn.complete`, main loop) | stops | - | - | - |
| Session end, `/clear`, exit (`session.end`, through the status band's handler: the engine allows one unmatched hook per event) | stops | stops | stops | stops |
| Feature turned off (the hook draws again, subscribed to the toggle) | stops | stops | stops | stops |
| Window narrow or short | stops | - | - | - |
| 25 denied blits in a row (the Raster is gone) | stops | stops | stops | stops |
| Sweep finished | - | stops | - | - |
| Usage no longer high | - | - | - | stops |
| Hot reload | the engine cancels a plugin's timers with the old module | | | |

## Does it get in the way

None registers a hook on `tool.call` or `prompt.*`. The hooks are render hooks that await the
engine's own drawing, the toggle and the theme, and one `turn.complete` hook that stops a timer
synchronously and returns the turn's answer unchanged. Any error in a render hook falls back to
the stock drawing.

## Tried and dropped

- **A band above the spinner** (the first version): looked like clutter; replaced by the swatch.
- **A swatch on the "Cooked for 12s" line.** The `TurnDuration` hook ran and reserved the columns
  (the stock text moved right), but neither a `Raster` nor coloured `Text` of ours painted in
  that transcript row in a real run (three variants tried; blits were accepted but nothing
  showed), and a redraw of the row is cached, so a sweep cannot be played by redrawing. Not
  shipped. Putting the swatch to the right of the stock text was clipped by the line's full width.

## Code

| File | Role |
|---|---|
| `hooks/features/aurora-common/aurora.ts` | the field, palette, tone, sweep, meter, wordmark, pacer, base64 (pure) |
| `hooks/features/aurora-common/ticker.ts` | the timer handles and the greeting clock |
| `hooks/features/aurora-spinner/index.tsx` | spinner hook, the plugin's one `turn.complete` hook |
| `hooks/features/aurora-greeting/index.tsx` | greeting hook (`AbovePrompt`) |
| `hooks/features/aurora-header/index.tsx` | header hook (wraps the manager's `Pane`) |
| `hooks/features/aurora-meter/index.tsx` | meter hook (`AbovePrompt`) |
| `hooks/features/status-band/index.tsx` | stops every timer on `session.end`; clears its line while the meter is on |
| `hooks/manager/index.ts` | reserves the header rows; refreshes the status line when the meter toggles |
