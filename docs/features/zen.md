# Zen spinner and Zen footer

Two switches that change what Claude Code draws around the conversation. Both are
**experimental** (listed under the Experimental header in `/rich-ui`, and may be removed in
any version). The Zen spinner is **on by default**; the Zen footer is **off by default**
because it replaces text you may rely on (the shortcut hints). Neither touches what Claude
says or does; they change only how it is drawn.

- `calm-spinner` "Zen spinner", `defaultEnabled: true`
- `quiet-footer` "Zen footer", `defaultEnabled: false`
- The ids keep their first names (`calm-spinner`, `quiet-footer`) so saved choices carry over.
- Toggle: their own rows under Experimental in `/rich-ui`. Rows already on screen redraw.
- Design and evidence: [`../dev/calm-mode-spike.md`](../dev/calm-mode-spike.md),
  [`../dev/calm-mode-design.md`](../dev/calm-mode-design.md)

**Hiding tool rows and narration is not here.** Claude Code's own `/focus` view (fullscreen
rendering) already shows only your last prompt, a one-line summary of tool calls and the
final reply, so this does not repeat it. Use `/focus` for that, and these two for the spinner
and footer. Notes: [`../dev/calm-mode-focus-research.md`](../dev/calm-mode-focus-research.md).

## Zen spinner

Replaces the working row with one quiet line, and trims two other lines.

```
  · • ● · · · · ·  thinking 42s
```

- **The working row.** A two-cell margin, a short track of dots with a soft highlight that
  glides to the far end and back every few seconds, then one plain word for what the turn
  is doing (`starting`, `thinking`, `writing`, `working`) and the seconds so far (`42s`,
  `1m 04s`, `1h 05m`). The row is a one-row `Raster` the engine draws once; a timer (eight
  times a second) repaints it with `$.ui.blit`, so the highlight and the clock move without
  a redraw. Each sub-agent's row keeps its own clock. A blank line sits above the row.
- **Colours.** The dots use the stock spinner's colour (Claude's orange), fading from a dim
  shade of it up to the full colour as the highlight passes; the words are a quiet grey.
  Both follow the `theme` setting (`dark…` or `light…`; `auto` and custom themes use the
  light set), read each time the row is drawn.
- **Narrow windows.** The track shrinks from eight cells to four, then to a single pulsing
  dot, and under about 14 cells of room the word goes and only the time is left.
- **The turn-end line.** "Baked for 3s" becomes a dim `3s`. A line that waits on
  background agents, and the ctrl+o and `--verbose` views, keep the engine's line.
- **The background-task hint.** `(ctrl+b to run in background)` is not drawn.
- Terminal only; other surfaces keep the engine's rows.

## Zen footer

Replaces the hint line under the prompt with a zen saying, and hides the dim notices under
the logo.

```
⏵⏵ auto mode on · Chop wood, carry water.
```

- **The hint line.** Everything that component draws is replaced: the shortcut reminders
  (`(shift+tab to cycle)`, `← for agents`, `? for shortcuts`), `esc to interrupt` and any
  confirmation such as "press again to exit". The keys still work; only the words are gone.
  The permission-mode pill is a separate part of the line and stays; it cannot be removed.
- **The sayings.** Twenty-four short traditional Zen sayings (`Chop wood, carry water.`,
  `Fall seven times, stand up eight.`, `Empty your cup.`, `Just this.`, ...) in `ZEN_QUOTES`
  in `hooks/features/quiet-footer/zen.ts`, each at most 56 characters so one fits next to
  the pill in an 80-column window. One is picked at random when the footer is first drawn,
  and another, never the one before, each time a turn finishes (a `turn.complete` hook, then
  the hint is drawn again). It does not change between draws of the same turn.
- **Why a saying and not blank.** The engine draws `pill · hint` for any hint a mod writes,
  so an empty hint, a blank one, a zero-height box and an empty text all left `⏵⏵ auto mode
  on ·` with the dot dangling.
- **The notices under the logo** (the model source, an experiment enrollment, a settings
  hint) draw nothing. This one is only covered by tests: no such notice showed in the
  sessions tried.
- Terminal only.

## Behaviour worth knowing

- On the non-fullscreen layout the terminal's own scrollback keeps what was drawn before a
  toggle; the live screen redraws.
- A resumed session redraws its rows once the saved choices load.

## Where the code lives

`hooks/features/calm-spinner/` (`line.ts` the words and cells, `view.tsx` the trees,
`index.ts` the three hooks and the timer) and `hooks/features/quiet-footer/` (`zen.ts` the
sayings, `index.ts` the three hooks). Raster packing is shared in `hooks/core/raster.ts`.
