# Scrollback and long tool output: spike

Question: what can a rich-ui plugin add around scrollback and long tool output that stock
Claude Code does not, and does any of it pass the first principle in
[`../FEATURES.md`](../FEATURES.md) (helps in most sessions, adds no clutter, own toggle)?
Raised in [`feature-ideas.md`](feature-ideas.md) ("What people ask for").

**Checked against Claude Code 2.1.310** (the installed binary and its bundled plugin types),
docs and issues read on 2026-10-24. The mods API is early access; re-check after upgrades.

## Short answer

- Stock fullscreen mode (`/tui fullscreen`, the default for new users since 6 May 2026)
  already answers most of the scrollback complaints. What is left is small.
- The one real gap a plugin can fill: **a long Bash result is cut to 30,000 characters
  before anyone sees it, and the rest is only a file on disk.** A plugin can read that file
  and show the whole output in a pane with its own scrolling, line numbers and a copy
  button. This was prototyped and works in the test harness; the probe against the real
  engine showed the data is there (below).
- It is **not a "most sessions" feature**. It helps in sessions that run commands with long
  output. Its clutter cost is one dim button row, shown only under a result that stock also
  folds. Build it as its own toggle, and decide its default after the hand test.
- Collapsing results, a prompt outline and a search pane all duplicate stock or fight the
  engine. Keeping a permission dialog's context visible is mostly not possible from a plugin.

## 1. What exists today

### Stock features (docs, 2.1.310)

From [the fullscreen docs](https://code.claude.com/docs/en/fullscreen):

| Need | Stock answer |
|---|---|
| Scroll back | Mouse wheel, `PgUp`/`PgDn`, `Ctrl+Home`/`Ctrl+End`; `CLAUDE_CODE_SCROLL_SPEED` (up to 20) or `/scroll-speed`; wheel acceleration can be turned off (`wheelScrollAccelerationEnabled`). History reaches the session start across compactions (maintainer, #28077, from 2.1.224). |
| Lost place | While scrolled up, a dim header shows the last prompt above the view (click to jump there); a `Jump to bottom` button counts new messages; `/config` Auto-scroll can be turned off, but "permission prompts and other dialogs that need a response still scroll into view regardless". |
| Long tool output | A collapsed tool result expands by a click (call and result together); also `!` shell output (from 2.1.257). `Ctrl+o` is transcript mode with every result expanded. |
| Search | In transcript mode: `/` search, `n`/`N`, `{`/`}` previous/next prompt, `g`/`G`, `less`-style paging. |
| Hand off to native tools | In transcript mode `[` writes the whole conversation, tool output expanded, into the terminal scrollback (then `Cmd+f`, tmux copy mode work); `v` opens it in `$VISUAL`/`$EDITOR`. |
| Quiet view | `/focus`: last prompt, a one-line summary of tool calls with diffstats, final response. |
| Copy | Drag to select, copies on release (`Copy on select`); `Ctrl+Shift+c`; `Shift`+arrows extend, and scroll at the edges. |
| No mouse capture | `CLAUDE_CODE_DISABLE_MOUSE=1` keeps the renderer, returns native selection, loses click-to-expand and the wheel. |
| Classic renderer | `/tui default` or `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`: the conversation stays in native scrollback. |

### What people reported (GitHub, fetched 2026-10-24)

| Issue | Complaint | State |
|---|---|---|
| [#7389](https://github.com/anthropics/claude-code/issues/7389) | No scrollback; wheel moves through prompt history (v1.0.110, Linux, Cursor) | Closed as a duplicate of #2301, Sep 2025 |
| [#28077](https://github.com/anthropics/claude-code/issues/28077) | Older content unreachable in the TUI; no setting for how much history renders | Closed "completed" 17 Aug 2026 by a maintainer ("fullscreen now handles it"); the reporter disputed it, and no depth setting was added. A community binary patch exists ([claude-code-renderpatch](https://github.com/Yan-Yu-Lin/claude-code-renderpatch), macOS arm64, tied to 2.1.203/207) |
| [#34354](https://github.com/anthropics/claude-code/issues/34354) | Auto-scroll hides the commentary above a permission dialog | Closed "not planned" (stale), Apr 2026. A commenter blames the classic renderer's spinner, which rewrites in place and drags the viewport; workarounds are tmux, Windows Terminal `snapOnOutput: false` ([claude-code-scroll-fix](https://github.com/VoxCore84/claude-code-scroll-fix)) |
| [#27875](https://github.com/anthropics/claude-code/issues/27875) | Permission and question prompts vanish after answering, no way to review | Closed as a duplicate of #26885, Feb 2026 |
| [#51233](https://github.com/anthropics/claude-code/issues/51233) | CLI shows tool output fully expanded; the desktop app collapses it | Duplicate of #40428 (`compactToolOutput` setting) |
| [#50313](https://github.com/anthropics/claude-code/issues/50313) | In tmux, cannot expand one collapsed result at the scroll position | Duplicate of #48002 (transcript view lacks internal scrolling) |
| [#79823](https://github.com/anthropics/claude-code/issues/79823) | iTerm2: large diff blocks overwrite earlier text in scrollback | Closed "not planned" (stale), Oct 2026 |

Reading across them: the older reports are about the classic renderer, and fullscreen is
Anthropic's answer. What survives is (a) people who want native terminal search and tmux
scrollback and so refuse the alternate screen, (b) a configurable history depth, (c)
collapsing tool output by default, (d) the permission-dialog context, (e) reviewing answered
prompts. A plugin cannot touch (a), (b) or most of (d) (section 4).

Reports disagree on whether tool results are folded by default (#50313 says yes, #51233
says no); I could not settle it from the sources. See "Not verified".

### Third-party tools

I found no terminal tool that browses a long tool result. What exists works on the
transcript file, outside the session: [claude-code-transcripts](https://simonwillison.net/2025/dec/25/claude-code-transcripts/)
(Simon Willison, HTML export), [Claude Transcript Viewer](https://awesome.ecosyste.ms/projects/github.com%2Fjordankzf%2Fclaude-transcript-viewer)
(browser app), the tmux and terminal tweaks above, and the renderpatch binary patch. Nothing
is a mod. The search tool did not turn up `claude-code-scroll-fix` itself; it is cited from
the #34354 page.

## 2. What a plugin gets

### The render sites (API types, 2.1.310)

| Site | Props that matter here | Notes |
|---|---|---|
| `ToolResult` | `tool`, `tool_use_id`, `output` (the tool's record, `{stdout, stderr, ...}` for Bash), `isErrored`, `isExpanded`, `onScreen` | Wrap with `await next(e)` (the engine's row is a node you can nest), rewrite `output`, or return a tree that replaces the row. A hook that draws a compact row passes `isExpanded === true` through so `Ctrl+o` still shows all. |
| `ToolUse` | `tool`, `input`, `isRunning`, `isErrored`, `isInterrupted`, `output`, `isExpanded` | Same three moves. |
| `ToolGroup` | `calls[]` (each with `input`, `output`), `isActive`, `isExpanded` | The "Read 3 files, ran 2 commands" fold. Setting `isExpanded` unfolds it. In the fullscreen `Ctrl+o` transcript no group is drawn. |
| `CommandOutput` | `command`, `args`, `text` | Slash-command output rows only. |
| `AssistantMessage`, `UserMessage` | `text`, `onScreen` | Per message. `requestId` is what `$.ui.scroll({ to: { requestId } })` takes. |
| `AbovePrompt` | `maxRows`, `scroll` | Shares its space with the slash menu and surveys (see the status-band note in `status-band-research.md`). |
| `Pane` | `scroll { offset, bodyRows }`, `placement` (`dock` or `inline`), `bodyColumns` | Engine-owned window over a taller tree; scrolls with wheel and keys when focused. |
| Permission dialog | none | "Drawn by the engine alone, since its answer authorises an action; a plugin adds context with `$.ui.notice`" (one line, `$.ui.notice(tool_use_id, text)`). |

Calls: `$.ui.open` (pane; placed at any width inside a press, otherwise from 110 or 144
columns), `$.ui.scroll({ to, in, block })` (own pane or band freely; **a transcript row only
while answering the person's own input**), `$.ui.copy({ text, surface })`, `$.fs.read/stat/exists/list`,
`$.ui.notice`, `$.process.run`.

### Are results cut before the plugin sees them? Yes, at 30,000 characters

Measured with a probe mod (appendix A) that hooks `tool.call` for Bash and records what the
hook sees after `next(e)`. Run headless (`claude -p --plugin-dir ...`) on 2.1.310:

| Command | `result.stdout` | What the model reads (`text`) |
|---|---|---|
| `seq 1 2000` (8,892 chars) | whole, 2,000 lines | whole |
| `seq 1 60000` (348,894 bytes) | **first 30,000 characters** (6,222 lines), mid-number cut | a `<persisted-output>` note, a 2 KB preview and the path |

For the second case the record also carries `persistedOutputPath` (a file under
`~/.claude/projects/<project>/<session>/tool-results/`) and `persistedOutputSize`
(348894), both declared in the bundled types. `$.fs.read(persistedOutputPath)` from the
hook returned all 348,894 bytes, first line `1`, last `60000`. So **the full output is
reachable by a plugin, one file read away.**

The 30,000 limit is the engine's `BASH_MAX_OUTPUT_LENGTH` (default 30000, clamped 4000 to
128000, from the bundled env-var text). `ToolResult.output` is documented as "the same
[record] `tool.call` resolved as `result`", so the interactive render hook should see the
same fields, but I only ran the probe headless (see "Not verified").

Other tools: `Read` results are file contents the user can open and stock draws them as one
line; `Grep`/`Glob`/`Edit`/`Write` results are compact. MCP, WebFetch and Agent results are
the other long ones; I did not probe how they are cut.

## 3. Candidates

"Cost per draw" is the work added each time the engine draws the row (a resize redraws every
visible hooked row).

### A. Full output in a pane, with copy (prototyped)

A long Bash result keeps the engine's row and gains one dim button, `[ view full output
(340.7 KiB) ]`. Pressing it opens a pane (asked for first, inside the press) and reads the
persisted file. The pane has a header, `[ copy all ]` `[ top ]` `[ bottom ]`, and the lines
with a number gutter. It draws the first 2,000 rows and says so; copy takes all of the text
with colour codes removed.

| Question | Answer |
|---|---|
| Data available | Yes: `output.stdout`/`stderr` inline (to 30,000 chars), `persistedOutputPath` for the rest. Falls back to the cut text with a note when the file cannot be read. |
| Cost per draw | Every `ToolResult` draw calls the hook. Non-Bash results return at once. A Bash result splits at most 30,000 characters into lines to count them: 0.2 to 0.3 ms for the worst case (6,222 lines, measured in the harness). Pane: builds up to 2,000 `Text` rows per draw; the row slicing is cheap but the engine's layout of that tree is **not measured** (needs a real terminal). One file read per press, not per draw. |
| Clutter in the common case | One row under a Bash result of 12 lines or more (the threshold is a guess, below). A session full of long `git log` or test output shows a button under each. Nothing in sessions without long output. Errors and `Ctrl+o` are left to the engine. |
| Stock does it? | Partly. Click to expand and `Ctrl+o` show a folded result; `[` and `v` hand the conversation to the scrollback or the editor. As far as I can tell none shows the part past 30,000 characters (stock's expanded view starts from the same cut result; **unverified**), and there is no "copy this result" button. |
| Wins | The only candidate that shows something stock cannot. Pairs with the copy-button idea (#1 in `feature-ideas.md`): one copy convention. |
| Risks | Inline pane (narrow window, classic renderer): the doc says an inline frame "fits the tree", so 2,000 rows may swamp the screen; the prototype does not cap by `placement` yet. Pane rows are plain text, so wide lines are cut with an ellipsis (`truncate-end`), not wrapped. A file that Claude Code deletes (session cleanup) turns into the fallback note. |

Prototype and tests: `docs/dev/.scrollback-spike-experiment/` (section 5).

### B. Collapse long results to one line with an expand button

Technically easy: a `ToolResult` tree replaces the row, with state per `tool_use_id`, passing
`isExpanded` through. Not recommended:

- Stock already folds results and expands them by click or `Ctrl+o`, so the benefit is a
  prettier summary line (`412 lines · exit 0`), not a new ability.
- Replacing the row throws away the engine's drawing (diffs, the interrupted marker, error
  styling) that we would have to reproduce.
- A plugin-drawn fold and the engine's click-to-expand would both be on the same row.
- Cost: state in an atom per result, and every redraw reads it.

Verdict: skip. If a summary is wanted, it belongs on `ToolGroup` or the existing fold's
label, not a second fold.

### C. Jump to previous prompt, or a prompt outline pane

Data: `UserMessage` render props carry `text` and the `requestId` that `$.ui.scroll` takes;
a press inside our pane is "the person's own input", so scrolling a transcript row is
allowed. Collecting the prompts means writing state from a render hook, which the engine
refuses, so it goes through `$.clock.after(0, ...)` (architecture 4.3). Cost: a hook call
per message draw. Stock: the sticky prompt header (click to jump), `{`/`}` in transcript
mode and `/` search. Verdict: skip; it duplicates three stock paths.

### D. Search pane over the transcript

No API reads the transcript. A plugin sees only rows as they are drawn, and rows outside
the viewport are not drawn in fullscreen (stock keeps only visible messages). A plugin could
read the session's transcript file on disk, but its location and format are not a plugin
API. Stock has `/` search in `Ctrl+o`. Verdict: skip, and not feasible cleanly.

### E. Keep a permission dialog's context visible

The dialog is engine-only. A plugin can add one line with `$.ui.notice(tool_use_id, text)`,
set from the `tool.call` hook, which runs before the permission check ("the permission check
and its dialog, then the tool"). It could repeat the model's last sentence before the call.
Limits: one line; no way to stop auto-scroll or pin the commentary; an auto-opened pane
beside the dialog is unasked, so it is placed only from 144 columns, and opening a pane for
each prompt is clutter. The issue (#34354) is mostly the classic renderer's cursor movement,
which fullscreen removes (this part is **unverified** by me). Verdict: do nothing now; at
most test the `$.ui.notice` line by hand.

### F. Reviewing answered prompts (#27875)

The `AskUserQuestion` tool call stays in the transcript as `ToolUse`/`ToolResult` rows, so a
plugin could wrap that result to show the question and the answer. Whether stock already
prints that is **unverified**, the permission prompts leave no row at all, and a plugin
cannot add rows. Verdict: skip.

### G. Extras that ride on A

- `[ open file ]` for `persistedOutputPath` through `$.process.run` with `$EDITOR` (the
  route and the editor are unverified, same as in the enhance-links spike).
- A filter or `grep` box in the pane. Not checked: whether the pane elements include a text
  input.
- Showing the path so the model or user can reuse it. Cheap.

## 4. What is not possible from a plugin

- Change the renderer, the alternate screen, native scrollback, tmux or the terminal's
  `Cmd+f`. A plugin lives inside the engine's drawing and cannot flip `/tui`.
- Set how much history the transcript renders, or turn off its cap (#28077).
- Insert a new row anywhere in the transcript. Sites can only be wrapped, rewritten or
  replaced, so "keep a record of the answered permission prompt" has nowhere to go.
- Draw, resize, pin or stop the permission dialog, or stop the transcript scrolling to it.
  Only the one-line `$.ui.notice`.
- Scroll the transcript on its own. `$.ui.scroll` reaches a transcript row only while
  answering the person's input (a press, a key).
- Read the transcript as a whole, or the viewport position; only the rows drawn, with
  `onScreen` on the rows at the viewport's edges.
- Show output the engine never kept. A Bash result past `BASH_MAX_OUTPUT_LENGTH` is on
  disk; one that a tool did not persist is gone.
- Change what the model reads (a `ToolResult` rewrite is drawn only; the stored message
  stays).
- Make a pane larger than the surface allows: it docks only in a fullscreen terminal of 110
  columns or more and otherwise sits above the prompt.
- Add a fold to the classic renderer's native scrollback: rows already written there are
  the terminal's.

## 5. The experiment

`docs/dev/.scrollback-spike-experiment/` is a separate mini-mod, **not loaded by rich-ui
and not a feature**. It is kept in a dot-folder so the repo's `npm test` does not pick up its
tests as part of rich-ui (the test runner takes every `*.test.ts(x)` under the folder).

| File | Role |
|---|---|
| `hooks/output.ts` | pure: Bash record to text and file path, ANSI strip, line count, the offer rule, row cap, labels |
| `hooks/spike.tsx` | the `ToolResult` wrap and the pane |
| `hooks/output.test.ts` | 9 unit tests (edge cases below) |
| `hooks/spike.test.tsx` | 10 harness tests of the wrap, the press, the pane, copy |
| `types/index.d.ts` | the one state key (`scrollback-spike.shown`) |

Run (from the repo root):

```
claude plugin test docs/dev/.scrollback-spike-experiment      # 19 pass
claude plugin validate docs/dev/.scrollback-spike-experiment
cd docs/dev/.scrollback-spike-experiment && ../../../tools/node_modules/.bin/tsc -p .
```

What the tests settle:

- A wrapped `ToolResult` keeps the engine's row (`await next(e)` nests) and adds a keyed
  `Button`; nothing is added for short, errored, `Ctrl+o`-expanded, non-Bash, empty or
  string results, the 12-line boundary included, nor on other surfaces.
- The press asks for the pane **before** the file is read (order `open`, `read`), which the
  placement rule needs.
- The pane shows the whole 500-line file, not the cut text; a file that cannot be read
  falls back to the cut text with a note; a 6,000-line file is cut to 2,000 rows with a
  note while **copy still takes all 6,000**; copy strips colour codes.
- Edge cases in the pure tests: stdout and stderr joined, stderr alone, CRLF and lone CR,
  trailing newline, ANSI colour and OSC 8 link codes, non-ASCII text, a non-Bash record, a
  non-string size.
- Not settled by the harness: that `$.ui.scroll` moves the pane. The harness has no laid-out
  window, so `top` and `bottom` are only checked to draw and not to break the pane. This is
  in the hand test.

## 6. Recommendation, ranked

1. **Build A as a small feature, "Long output"**, own toggle, text only. Do it after the hand
   test below confirms the three open points (row cost, inline pane, stock's own limit).
   Decide the default then: on is defensible because the button only appears where stock
   folds, but it is not a most-sessions feature, so default off is the safe call if the
   button row is noticed in everyday use. Fold the copy button for code blocks and this one
   into one "copy" convention.
2. **Extras on A** (path, open in editor, filter) only if the hand test shows people want
   to leave the pane for the file.
3. **Permission context**: try `$.ui.notice` by hand; build nothing until it proves useful.
4. **Do not build**: collapse/summary replacement (B), prompt outline (C), search pane (D),
   answered-prompt record (F).

For scrollback itself the honest summary is: stock fullscreen covers it, and the complaints
that remain (native search, history depth, dialog behaviour) are outside what a plugin can
change.

## 7. Not verified

- **Stock's fold**: how many lines a Bash result shows before it folds, and what its
  expanded view shows for a result past 30,000 characters. I could not find the constant in
  the bundled source (it is minified) and did not drive a real terminal. `OFFER_FROM_LINES`
  (12) is a guess to be replaced with the observed value.
- That the interactive `ToolResult.output` carries `persistedOutputPath` like the headless
  `tool.call` result. The API text says it is the same record.
- Layout cost and look of a 2,000-row pane; `Text` row truncation with wide characters;
  inline-pane behaviour with a tall tree; focus and the wheel in the pane.
- `$.ui.scroll` to the top and bottom of the pane (the harness cannot).
- Any behaviour in the classic renderer (`/tui default`).
- MCP, WebFetch and Agent result sizes.

## 8. What to test by hand

Use a real terminal. Load only the experiment (not rich-ui, so nothing else wraps results):

```
claude --plugin-dir /Users/kavinsingh/EmergentAI/claude-code-rich-ui-wt/docs-scrollback-spike/docs/dev/.scrollback-spike-experiment
```

Run it in fullscreen (`/tui fullscreen` once), at 120+ columns, then narrow it to about 90,
then try `/tui default`. Ask Claude to run each command with the Bash tool:

| Ask for | Expect |
|---|---|
| `seq 1 40` | The engine's result, folded as usual, plus `[ view all 40 lines ]`. Note how many lines stock shows before folding and tell me (replaces the guess of 12). |
| `seq 1 5` | Nothing added. |
| `seq 1 60000` | A button saying `view full output (340.7 KiB)`. Press it: the pane opens at once, line 1 is `1`, bottom of the first 2,000 rows is 2000, the footer says "first 2,000 of 60,000 lines". |
| Same, then `[ copy all ]` and paste into an editor | All 60,000 lines (last line `60000`), button reads `[ copied ]`. |
| Pane: wheel, `PgDn`, `[ top ]`, `[ bottom ]` | The window moves. If the buttons do nothing, say so. |
| `printf '\033[31mred\033[0m\n'; seq 1 30` | Pane and clipboard show `red` with no escape codes. |
| `ls /nonexistent; seq 1 30` | Stderr and stdout both appear. |
| A failing long command, e.g. `seq 1 40; exit 1` | No button (errors are left to stock). |
| `Ctrl+o` on a long result | No button (everything is already shown). |
| Press the button on a second long result | The pane switches to that output. |
| Narrow window / classic renderer | Where the pane opens, and whether a long output swamps the screen. |
| `Esc` in the pane | It closes. |

Report: the stock fold size, whether `persistedOutputPath` was present (the button label
shows a size only then), anything that flickers or lags with the 2,000-row pane.

## Appendix A: the probe

Source of the headless probe (scratch, not kept in the repo): a `tool.call` hook on Bash
that, after `await next(e)`, writes `Object.keys(result)`, `stdout.length`, the line count,
`persistedOutputPath` and `persistedOutputSize`, the model-facing `text` head and tail, and
the result of `$.fs.read(persistedOutputPath)` to a JSON file. Run as
`claude -p --plugin-dir <probe> --permission-mode bypassPermissions --model haiku "Use the
Bash tool exactly once to run: seq 1 60000 ..."`. Output of the 60,000-line run:
`stdoutLen 30000`, `stdoutLines 6222`, `persistedOutputSize 348894`, read-back length
348894 with tail `59999\n60000\n`.
