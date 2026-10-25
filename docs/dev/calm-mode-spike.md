# rich-ui: Calm mode spike

Status: spike, not a design. Read from this repo and from the engine's type contract in `../ui-atlas/.claude-plugin/types/claude-code/index.d.ts` (the same file the `ui-atlas` mod is built against). Nothing here has been run; "unverified" marks a claim that needs a ten-minute experiment before it is trusted.

## 1. The idea

A "calm" mode makes the transcript quieter: fewer decorations, less jargon and animation, and the same information one click or ctrl+o away. It is the first subtractive feature in rich-ui, which only ever adds (diagrams, a band, a preview pane).

It fits the charter, with one adjustment. "UX-positive only" and "no clutter" are the reason to build it. But it changes what stock Claude Code draws for everyone who turns it on, so it ships **off by default**, and it must never hide anything the reader needs to act on (section 5).

## 2. What exists in rich-ui today

Nothing calm-specific, and a little that helps.

- **No mode or preset concept.** Preferences are one flat `{ [featureId]: boolean }` map (`hooks/core/prefs.ts`, stored shape `v: 1`). A feature is `id`, `name`, `description`, `defaultEnabled` (`hooks/core/feature.ts`). There is no place for a sub-option such as "hide turn time under 10s".
- **Every feature is additive.** `mermaid` wraps `AssistantMessage`, `markdown-preview` wraps it too and opens a `Pane`, `status-band` writes one line with `$.ui.status`. None removes or shortens a stock row.
- **The status band is already calm in spirit:** it shows nothing until context or plan usage runs high (`hooks/features/status-band/band.ts`). A calm mode can leave it alone or raise its threshold.
- **Plumbing is reusable as is:** the registry, the gate (`isOn`, `guard`), the manager pane's switches, and the rule that a disabled feature returns `next(e)` untouched, so toggling calm off restores stock drawing exactly.

## 3. What the engine lets a plugin quiet

Per render site, from the type contract. "Rewrite" changes props; "tree" replaces the row.

| Site | What a hook can do | Calm use | Confidence |
|---|---|---|---|
| `Spinner` | Rewrite `word`, `message`, `suffix`; or a tree. Elapsed time, tokens and effort are not props (a tree replaces all of it). | Replace the whimsical verb ("Sauteing") with a fixed word, drop the ellipsis suffix. | Documented |
| `TurnDuration` | Tree in place of the "Baked for 3s" line; `word` and `durationMs` readable; `isExpanded` says ctrl+o or `--verbose`. | Dim `3s` or a plain "Done", passing through when `isExpanded`. | Documented; atlas already does the tree |
| `ToolProgress` | Rewrite `hint`; `""` **draws nothing**. | Remove the `(ctrl+b to run in background)` pill. | Documented, cleanest win |
| `PromptHint` | Rewrite `hint` (replaces the line), or add `tail`; `isWorking` and `isDraft` say when. | Shorter or empty hint while a turn runs. | Documented |
| `SessionMode` | Filter `modes`. | Drop footer labels. | Documented |
| `ToolGroup` | `isExpanded` is the only prop whose rewrite changes the screen; `isCallsOnly` says whether it is safe to restyle. | Keep read/search runs folded to one count line. Stock already folds, so the gain is under `--verbose`. | Documented |
| `ToolUse`, `ToolResult` | Wrap, rewrite `output`, or a tree; `isRunning`, `isErrored`, `isExpanded` readable. | One dim line for a successful result (`ran 3 commands`), full output on error or ctrl+o. | Documented to rewrite; a one-line tree for a result is unverified |
| `InfoNotice` | Rewrite `text`/`command` or a tree. | Hide the dim lines under the logo (model source, settings hints). | Unverified that an empty tree removes the row |
| `AbovePrompt` | Draw or pass. | Draw nothing. | Documented |

Also available: `$.config.list()` and `$.config.set({ key, value })` change `/config` rows as if the person did (the contract's own example is `verbose`). Which rows exist in the installed build is unverified, so `$.config.list()` is the first thing to run. Calm could set `verbose` off on entry, but then it must remember and restore the person's value on exit.

### What it cannot reach

- **Permission dialogs.** Only `AskUserQuestion` is a render site; tool-permission prompts are not. They stay as stock draws them. That is fine, since they should not be calmed.
- **The logo and welcome banner**, other than the `InfoNotice` lines under it.
- **Stock edit diffs** inside a tool result, which the tool's own renderer draws. Rewriting `output` can shorten them, at the cost of breaking the diff.
- **The reply text itself.** Calm must not touch `AssistantMessage` wording: rich-ui "never changes what Claude says".

## 3b. Prior art: how existing mods do it

Read on 2026-10-24 from `../mods-to-try/fm` (the Firstmate "Calm" mod, `hooks/register.ts` and `lib/fm-calm-presentation.ts`). The other mods there (`heatmap`, `token-run`, `ruview`) only use `AbovePrompt` and `Pane`, so they say nothing about quieting. The web search found requests for a quiet mode ([#25066](https://claudeissues.com/issue/25066-add-quiet-minimal-display-mode-that-hides-tool-call-output), [#50460](https://claudeissues.com/issue/50460-feature-request-add-transcript-filtering-mode-to-suppress-tool-output-rendering)), a write-up of a "plain-view" add-on ([article](https://levelup.gitconnected.com/claude-code-just-got-mods-6491f4b45049)) that I could not read in full, and Pi packages ([cc-my-pi](https://pi.dev/packages/cc-my-pi?name=pi-claude-code)) that are not Claude Code mods.

What `fm` does:

- **Hides rows with a zero-height box.** `ToolUse`, `ToolResult`, `ToolGroup`, operational `UserMessage` rows and mid-turn `AssistantMessage` narration each return `Box({ display: "none" })` while calm is on, and `next(e)` otherwise. This answers open question 1: it is the working way to remove a row, and its tests assert on it.
- **Replaces the spinner** with a two-row sailboat `Raster`, repainted on a `$.clock.every` tick through `$.ui.blit` (no render pass), colours taken from the `theme` config row and re-read on a `config.set` hook.
- **Toggles live.** A `/calm` command flips a flag, persists it, then calls `$.ui.invalidate("ui.render")` so rows already on screen redraw. It saves first and keeps the old value if the write fails.
- **Finds "working notes" structurally**, in a `turn.step` hook: assistant text from a step that stopped for `tool_use` and is short is narration; substantive text is a final reply and stays. It also classifies a restored transcript from `$.session.messages()` on resume.
- **Has no per-row escape.** It does not check `isExpanded` or `isErrored`, so in calm a failed tool call is hidden too. It also has no sub-options: calm is on or off, kept in a file.

What to take and what to change:

| Take | Change |
|---|---|
| `display: "none"` for hidden rows | Hide only on success; pass through when `isErrored`, `isInterrupted` or `isExpanded` (section 5) |
| `$.ui.invalidate("ui.render")` after a toggle | The manager already redraws on toggle; confirm it covers every calm site |
| Structural narration test (`stopReason` plus length) | Optional and later; hiding Claude's own text is a bigger step than rich-ui has taken |
| Theme-aware colours from `$.config.list()` | Only needed if we draw a `Raster`; a plain-word spinner needs none |
| Save-then-apply on toggle | Already how the manager works |

**Evidence from `fm`'s own feasibility record** (`docs/calm-mode-feasibility.md` in the Firstmate repo, the 2026-09-15 to 09-28 sections; a copy sits in another session's scratchpad). It was run against real Claude Code TUIs under tmux, 2.1.272 through 2.1.284, not only a test harness:

- Hidden rows leave **no gap**: spacing with calm on equals a turn that never used tools. Each render dispatch took under 3 ms.
- `ToolUse`, `ToolResult` and `ToolGroup` hooks see **every** tool, built-in, MCP or plugin, so there is no same-name override problem as on Pi.
- Toggling redraws rows already on screen, with one caveat: in the **non-fullscreen** layout the terminal's own scrollback keeps the old rendering above the redraw. Fullscreen has no stale copy.
- **Restored sessions draw before `session.start`.** After `claude --continue`, rows draw before the preference loads, so the first build showed hidden rows for one frame. `fm` fixed it by making every hook await one cached load. rich-ui's `startSession` loads prefs the same way, so calm needs the same care (or an `$.ui.invalidate` after load).
- The `ctrl+o` view keeps per-message timestamp and model headers where hidden assistant rows were, because those headers are not a render component.
- Stock options are coarse: `spinnerVerbs`, `spinnerTipsEnabled` and `prefersReducedMotion` change spinner text and tips only, and `/focus` (fullscreen only) shows prompt, summary and response with no per-row policy. A statusLine command cannot hide rows or know a turn is running.
- `fm` guards on the `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` variable because its mod is opt-in; rich-ui does not need that, since mods are on by default from 2.1.287.

Hiding every tool row is the opposite of the "one dim line" idea in section 4, which keeps the reader oriented. `fm` can afford total silence because Firstmate reports through its own notes (`$.ui.log`); rich-ui has no such channel, so hiding tools wholesale would leave a long turn looking dead.

## 4. Feature suggestions

Ordered by value over risk.

1. **Plain spinner.** A fixed word ("Working"), no suffix. Smallest change and visible in every turn.
2. **Quiet turn end.** "Baked for 3s" becomes a dim `3s`; the engine's line when `isExpanded`. Option: leave it out under ~10s, if an empty tree turns out to remove the row.
3. **No background-task pill.** `ToolProgress` hint set to `""`.
4. **Quiet prompt footer.** Empty `PromptHint` while working; `SessionMode` labels dropped. Keep the hint when the prompt holds a draft.
5. **One-line tool results.** The biggest calming effect and the biggest risk: a success becomes one dim line, an error stays in full, ctrl+o shows everything. Build after the first four, behind its own sub-switch.
6. **A "Calm" preset in the manager pane**, not a master switch the other features read. The pane flips the others (status band to critical-only, say) in one press. Features still never depend on each other, which the charter requires.
7. **Calm status band.** Show only above 90% (the band's current threshold is lower). A small change inside an existing feature.
8. **Peek.** A click on a collapsed row expands it in place, so calm never means "hidden". Needs a spike: the per-row expand goes through `isExpanded`, which only ctrl+o and `--verbose` set today.

Not suggested: hiding thinking or tool rows entirely, removing error colours, animated "breathing" effects (they are the opposite of calm and cost repaint work), and anything on `AssistantMessage`.

## 5. Safety rules for any calm site

1. Errors, interruptions and refusals draw as stock (`isErrored`, `isInterrupted`).
2. `isExpanded` true means pass through, so ctrl+o and `--verbose` show everything.
3. Every handler goes through the existing gate and `guard`, so an exception draws the stock row.
4. Turning calm off redraws stock exactly, as the other features do.

## 6. Open questions to answer by experiment

1. `display: "none"` removes `ToolUse`, `ToolResult`, `ToolGroup`, `UserMessage` and `AssistantMessage` rows (shown by `fm`). `fm` verified this on real Claude Code builds (2.1.272 to 2.1.284). Still unverified at `TurnDuration`, `InfoNotice`, `Spinner` (`fm` replaces the spinner with a tree, not a hidden box) and on 2.1.310.
2. What does `$.config.list()` return in Claude Code 2.1.310, and which rows can calm set and restore safely?
3. How do two mods that rewrite the same site compose (rich-ui calm and another spinner mod)? The wrap order is not documented in what I read.
4. Does the spinner rewrite hold on `desktop` and `vscode` surfaces, or only the terminal? The README says terminal only today, so probably moot.
5. Does a one-line `ToolResult` tree keep working with copy/select, and with the fullscreen scrollback?

## 7. Recommended first slice

Build suggestions 1 to 4 as a single feature `calm` (default off, one switch in `/rich-ui`), running experiment 1 first so the turn-end and footer behaviour is known. Defer 5 and 8 until the first four are in use. Prefs need no schema change for this slice; sub-options (v2 of the store) can wait until 5 needs one.
