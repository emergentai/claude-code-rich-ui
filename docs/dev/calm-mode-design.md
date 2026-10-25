# rich-ui: Calm mode design

Status: proposal, built on [`calm-mode-spike.md`](calm-mode-spike.md). Nothing is built. The aurora spinner is dropped, so calm owns the `Spinner` site alone.

## 1. Shape

Two features, not one with sub-options, plus a preset:

| Feature | Default | Sites | What it does |
|---|---|---|---|
| **Calm spinner** (`calm-spinner`) | off | `Spinner`, `TurnDuration`, `ToolProgress` | Replaces the working row with one quiet line; trims the turn-end line and the background-task hint. |
| **Quiet tool rows** (`quiet-tools`) | off | `ToolUse`, `ToolResult`, `ToolGroup` | Hides successful tool rows. Errors, interruptions and ctrl+o stay full. |
| **Calm preset** | a button in `/rich-ui` | none | Turns both on (and later, other quiet settings) in one press, and back off. |

Why two features: the prefs store is a flat `{ id: boolean }` map, so two independent switches need no schema change, each can be tried alone, and the charter's "no feature depends on another" holds. The preset lives in the manager pane, which already owns the switches, so no feature reads another's flag.

Tool rows are the riskier half (a long turn with silent tools looks dead), so the spinner must carry the orientation they used to give. That is the main design point.

## 2. Calm spinner

Replace the whole row, as `fm` does: the hook returns a tree holding one-row `Raster`, repainted with `$.ui.blit` on a `$.clock.every` tick, so a repaint costs no render pass.

The row, at the transcript's left margin:

```
· working 42s
```

- **A cell can be any glyph**, so digits and letters go into the Raster as cells. That means the elapsed seconds update by blit, with no `$.ui.invalidate` each second. The row keeps a fixed width (padded) because a blit must repeat the mounted `columns` and `rows` exactly.
- **Elapsed time is ours.** No prop carries it, so the first sighting of a `requestId` records `$.clock.now()` and each tick computes the difference. A sub-agent's spinner has its own `requestId`, so it keeps its own clock.
- **The label** comes from the spinner's `mode`: `thinking`, `working` (tool-use, tool-input), `writing` (responding), `starting` (requesting). One lowercase word, no whimsical verb. Whether the engine re-renders the spinner when `mode` changes is unverified; if it does not, the label falls back to a fixed "working".
- **Motion** is one glyph breathing slowly: `·` to `•` and back over about four seconds, at most 2 fps. Colours: raw RGB from the theme family, chosen like `fm` does (read `theme` through `$.config.list()` at load, re-read on `config.set`), dim grey on both families.
- **Quiet tool rows enabled:** when `quiet-tools` is on, the label also names what is happening (`reading`, `editing`, `running`), fed by the `tool.call` hook, because the rows that said so are gone. This reads the other feature's flag only through its own atom, never imports it, and works the same when it is off (label stays `working`). Verify this keeps the isolation rule.
- **Narrow terminals:** under about 20 columns, the glyph and the seconds only.

`TurnDuration`: a tree with a dim `42s`, passing through when `isExpanded`. `ToolProgress`: rewrite `hint` to `""`.

Leave the footer (`PromptHint`, `SessionMode`) alone in the first cut; trimming hints is easy to add and easy to regret.

## 3. Quiet tool rows

Per site, hide with `Box({ display: "none" })` only when all of these hold; otherwise `next(e)`:

- `!isErrored && !isInterrupted` (and, for `ToolUse`, `!isRunning`? see below)
- `isExpanded !== true` (ctrl+o and `--verbose` show everything)
- `ToolGroup`: `isCallsOnly === true`, so a group with a memory row or a hook timing row stays.

Open point: hide a **running** call or not? Hiding it while it runs and again when it ends means a row never appears, which is the calm result, and the spinner label names the tool. Hiding only after it succeeds makes rows flash in and vanish. Take the first, once the spike shows the running state hides cleanly.

Not hidden in any case: permission prompts (not a render site), `AskUserQuestion`, `CommandOutput`, assistant text, user messages. `fm`'s hiding of narration and operational user rows is out of scope: that changes what Claude visibly says.

## 4. Load, toggle, restore

- Every handler is gated through `isOn` and `guard` like the other features, so a disabled or failing handler draws stock.
- **Resume:** rows can draw before `session.start` loads the prefs (found by `fm` on 2.1.272). Calm default is off, so a stale read means a stock frame, then an invalidate after the load. The manager's `startSession` should call `$.ui.invalidate("ui.render")` once after `update($, enabledAtom, …)`. Add a test.
- **Toggle:** the manager pane toggles by clicking a row; add `$.ui.invalidate("ui.render")` after any change of a calm flag so rows already drawn redraw. Non-fullscreen layouts keep old rows in scrollback; note it in the docs.
- **Timer:** start the tick when a spinner first draws, stop it when the last tracked spinner is gone or a blit is denied, as `fm` does. No timer while calm is off.

## 5. Build order

0. **Experiments** (a scratch session, nothing committed). Settle: does `display: "none"` work at `TurnDuration`; does the spinner re-render on `mode` change; what `$.config.list()` returns on this build; does a spinner tree with a Raster hold up next to a hook from another mod.
1. **Calm spinner** with `TurnDuration` and `ToolProgress`. Pure parts first with tests: elapsed formatting, label from mode, the cell packing, width fitting. Then the hooks.
2. **Quiet tool rows**, hiding on the rules in section 3, with tests for each pass-through condition.
3. **Manager:** the Calm preset button, the invalidate after load and toggle.
4. Docs: `docs/features/calm.md`, README row, FEATURES, CHANGELOG, a manual-test page like the other features'.

## 6. What would change the plan

- If the spinner does not re-render on `mode`, the label stays fixed and the tool-name label (which comes from `tool.call` and a blit) carries the information.
- If a Raster spinner cannot coexist with a hook from another mod, ship calm spinner as documented-exclusive.
- If hiding a running `ToolUse` leaves a blank row, fall back to hiding after success and document the flash.

## 7. As built

Built on `feature/manager-refresh` and checked in a real Claude Code 2.1.310 session under tmux (spinner, hidden and shown rows, ctrl+o, an erroring call, the preset on and off with rows redrawing).

What changed from the plan above:

- **No tool name on the spinner.** The label is the turn's mode only. A name needs a second unmatched `tool.call` hook, and the engine allows one per event (`refreshOnWrite` holds it). Left for a later pass.
- **A sweep, not a breath.** The motion is a short track of dots with a highlight gliding along it and back (margin of two cells, repainted at 8 fps), rather than one breathing glyph at 2 fps.
- **Theme colours.** The dots use the stock spinner's orange (`#d77757`, the same in both families) faded from a dim shade, the words a quiet grey per family. The family comes from the `theme` row of `$.config.list()` at each spinner draw (`auto` and custom themes use light). A blank line sits above the row (`marginTop`).
- **Settled by the run:** `display: "none"` works at `ToolUse`, `ToolResult` and `ToolGroup` on 2.1.310 and leaves no gap; the spinner redraws on a mode change (`thinking`, then `working`); a Raster spinner draws and blits with the other features loaded. Not tried: `InfoNotice`, and another mod hooking `Spinner` at the same time.
- **Observed and kept:** a failed call still shows the stock folded line (`Listed 1 directory`), because a group with an error is not calls-only.
- **Also changed:** the manager redraws after a toggle and after the saved choices load; `toBase64` moved to `hooks/core/raster.ts` with a `packCells` helper.
- **Placement.** After merging `release`, both calm features are marked `isExperimental` and sit under the Experimental header in `/rich-ui`; the Calm preset is a row in its own Presets section below them (`presets` in `hooks/core/registry.ts`, `Preset` in `hooks/core/feature.ts`), so a later preset is data, not pane code.
- **Round two.** Quiet footer (`PromptHint` rewrite and `InfoNotice` hidden), Hide mid-turn narration (a `turn.step` stream hook plus an `AssistantMessage` render hook; the lines are remembered by hash in a `narration` atom, also filled from `$.session.messages()` at session start) and a Calmest preset. A live run on 2.1.310 showed the footer hint is `(shift+tab to cycle)`, `· ← for agents` or `· esc to interrupt`, the permission-mode pill is not part of it, and any rewritten hint is drawn as `pill · hint`, which leaves a dangling `·` when the hint is empty. `InfoNotice` never fired in the sessions tried, so that part is tested only in the harness. The stock `/focus` view is in [`calm-mode-focus-research.md`](calm-mode-focus-research.md).
- **Scope cut after round two.** Quiet tool rows and Hide mid-turn narration were built and then removed: Claude Code's `/focus` view does the same, and the person using this runs it. What is left is the calm spinner and the quiet footer. The footer now hides the whole `PromptHint` (a zero-height box) instead of trimming it; a stray `·` stays after the permission-mode pill with every variant tried (empty or blank hint, hidden box, empty text), so it is a known flaw. The removed code is in git history (commit 2a4dec5 and earlier).
- **Footer word.** Hiding the hint outright left a dangling `·` after the permission pill (not removable: no render site, no `/config` row; a probe of `$.config.list()` on 2.1.310 listed about 45 rows and none controls the footer). The hint is now replaced with one word, `calm`, which makes the line read `⏵⏵ auto mode on · calm`.
- **Affirmations.** The footer word is now one of twenty short affirmations, advancing on `turn.complete` (a module-level turn count plus a per-session seed; the hint is invalidated so it redraws). The feature keeps the id `quiet-footer` and is named "Footer affirmations".
- **Zen.** The calm spinner is shown as "Zen spinner" and the footer as "Zen footer" (ids `calm-spinner` and `quiet-footer` unchanged, so saved choices carry over). The footer picks a random saying from `ZEN_QUOTES` (24 traditional sayings, at most 56 characters so one fits beside the pill at 80 columns), never the same twice in a row, a new one each turn. The Calm preset and the Presets section were removed because a preset over two independent switches only confused the pane; `Preset`, `presets` and the pane section are in git history (commit 0992004 and earlier).
- **Defaults.** Zen spinner ships on by default (it only restyles the working row and the turn-end line); Zen footer stays off, since it replaces hint text a person may rely on.
