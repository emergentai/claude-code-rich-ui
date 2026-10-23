# rich-ui: Status band research

Status: research for a backlog feature, not a design. Sources are the public mods named below, read on 2026-10-23 through their GitHub READMEs and `hooks/register.tsx` files. Nothing here has been run, and stars belong to the hosting repo, not the mod.

## 1. Why look

Status lines and bands above the prompt are the most crowded corner of the mod catalogue. Before adding one, learn what the best ones do, what they get wrong, and where rich-ui can do it differently.

## 2. What the best ones do

| Mod | Draws | Data | Refresh |
|---|---|---|---|
| context-bar (hamzafer) | Stacked bar of the context window, a legend, a percent badge | `$.session.usage({ breakdown: 'summary' })`, local estimate | `session.start`, `turn.complete` (main agent only), `session.compact`, `/context-bar` toggle |
| usage-meter (hamzafer) | One line: plan windows (5h, 7d, spend) as five-cell block bars, reset countdown, session cost | `$.session.usage()` and `session.measure` payloads | 60-second clock tick, a toast once per window past 90% |
| model-effort-band (YeonwooSung) | Bordered band: model, observed effort gauge, family badge | Observed from requests | Per main-conversation step |
| token-weather (hamzafer) | Context forecast with a prompt-cache countdown | Not read | Not read |

Shared mechanics, all via `ui.render` on component `AbovePrompt`:
- Call `next(e)` first, so Claude Code's and other mods' content is kept, then add a band.
- Skip while a survey is showing.
- Use `session.usage` for numbers, not the transcript.
- Hold the reading in a host atom so it survives hot reload; keep the on/off choice in `$.store`.
- Drop pieces from the end when the width is short (usage-meter's `fit`); model-effort-band falls to one unbordered line under 30 columns.
- Thresholds in three colors: green, yellow at 70 to 75 percent, red at 90.

## 3. What they get wrong

1. **Each band is its own row.** Install four and the prompt sits under four stacked strips. Their answer is a shared `bands.json` order file that every mod copies a helper (`stackBands`) to read, edited by hand and applied on restart. That is clutter plus configuration, which is the opposite of the charter.
2. **Hardcoded colors.** context-bar uses a nine-color hex palette, `#d97757` and grey `#808080`. They do not follow Claude's theme, which is the same light-theme trap the manager pane hit.
3. **Always on.** A band is there whether or not it says anything. A context bar at 12 percent tells the reader nothing.
4. **One mod per number.** Context, usage, model, cost and cache each live in a different mod with its own command and its own toggle.

## 4. A rich-ui spin

These are the ideas worth testing. None is decided.

- **One band, several segments.** A single composed row above the prompt (model, context, usage, cache) instead of one band per concept. The manager pane lists each segment as its own switch, so the first principle still holds per segment.
- **Quiet by default.** Show a segment only when it carries information: context past a threshold, usage near a limit, cache about to go cold. A healthy session shows no band at all, which keeps the "no clutter" promise.
- **Theme-true colors.** Only theme keys (`text`, `warning`, dimColor), never hex, so it reads in both themes without a check per theme.
- **Never fights other bands.** Keep to a single row and position by calling `next(e)` first; no order file.
- **Sized to the width.** Drop segments from the end as the terminal narrows, as usage-meter does.

## 5. Open questions

1. Does the charter's "large majority of sessions" test pass for any segment? Context fullness is the likely first one; cost and cache probably not.
2. Does quiet-by-default feel broken ("where did the bar go")? A first-run note or a one-line state in `/rich-ui` may be needed.
3. Which `session.usage` fields are stable across Claude Code releases? The API is early access.
4. Can an `AbovePrompt` band coexist with the manager pane? The earlier attempt to put the manager in that band failed on keyboard focus (`$.ui.focus` denied), so the band must stay read-only.
5. Is it worth shipping a first segment (context) alone, before the composed band exists?

## 6. Not done

I did not run these mods, read `bands.ts` line by line, or look at token-weather's source. Next step, if wanted: install context-bar and usage-meter in a scratch session and look at them in both themes.
