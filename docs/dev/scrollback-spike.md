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
  before anyone sees it, and the rest is only a file on disk.** Stock's expanded view shows
  the cut text (6,221 lines ending mid-number for `seq 1 60000`) with no note and no copy
  button. A plugin can read that file and show the whole output in a pane with its own
  scrolling, line numbers and a copy button. **Built as an experiment and tried in tmux on
  2.1.310: it works** (section 5).
- It **fails the "helps in most sessions" bar**: output past 30,000 characters is rare. It
  passes the clutter bar, because the button is offered only for a call whose output was
  cut, so almost every session shows nothing new. A cheap, harmless extra, not a headline
  feature.
- **The site matters.** In fullscreen stock folds every Bash call into a `ToolGroup` line
  ("Ran 1 shell command") and never draws a standalone `ToolResult` for it. My first
  prototype wrapped `ToolResult` and its button never appeared; the working one wraps
  `ToolGroup`. In the classic renderer the mouse is not captured, so a button could not be
  pressed there and the feature must stay off outside fullscreen.
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
| `ToolResult` | `tool`, `tool_use_id`, `output` (the tool's record, `{stdout, stderr, ...}` for Bash), `isErrored`, `isExpanded`, `onScreen` | Wrap with `await next(e)` (the engine's row is a node you can nest), rewrite `output`, or return a tree that replaces the row. **Not drawn for Bash in fullscreen** (see below); drawn in the classic renderer. A hook that draws a compact row passes `isExpanded === true` through so `Ctrl+o` still shows all. |
| `ToolUse` | `tool`, `input`, `isRunning`, `isErrored`, `isInterrupted`, `output`, `isExpanded` | Same three moves. |
| `ToolGroup` | `calls[]` (each with `tool_use_id`, `input`, `output`, `isRunning`, `isErrored`, `isInterrupted`), `isActive`, `isExpanded` | **Where fullscreen draws every Bash call**: one line, "Ran 1 shell command" or "Ran 3 shell commands", folded or expanded. Wrap it to add rows under the line. `e.viewport.isFullscreen` says which renderer. |
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
same fields; the interactive fullscreen run confirmed it for `ToolGroup.calls[i].output`.

### Where a Bash result is really drawn (checked in tmux, 2.1.310)

Debug-log lines from the experiment's hooks (`claude --debug-file`), and the screen:

| Renderer | What stock draws for `seq 1 60000` | Hook that is called |
|---|---|---|
| Fullscreen (`CLAUDE_CODE_NO_FLICKER=1`) | One line, `Ran 1 shell command`, whatever the length; a click or `Ctrl+o` expands to the raw lines (the cut text, about 6,200 lines) | `ToolGroup` (id `collapsed-toolu_...`, `calls=1`). **`ToolResult` was never called** (0 log lines). |
| Classic (`CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`) | `Bash(seq 1 60000)` with three lines, then `… +6219 lines (ctrl+o to expand)` | `ToolUse` and a standalone `ToolResult` |

So there is **no per-result fold threshold in the fullscreen default view**: the whole call
folds into the group line and one click shows everything. In the interactive fullscreen
session the group's `calls[0].output` carried `persistedOutputPath`, so the headless probe's
finding holds interactively. The classic renderer captures no mouse: a click on the button
there did nothing.

Other tools: `Read` results are file contents the user can open and stock draws them as one
line; `Grep`/`Glob`/`Edit`/`Write` results are compact. MCP, WebFetch and Agent results are
the other long ones; I did not probe how they are cut.

## 3. Candidates

"Cost per draw" is the work added each time the engine draws the row (a resize redraws every
visible hooked row).

### A. Full output in a pane, with copy (prototyped, works in tmux)

In fullscreen, under the group line of a Bash call whose output the engine cut, one dim button:
`[ full output: seq 1 60000 (340.7 KiB) ]`. A group of three commands gets a button for each
cut call. Pressing it opens a pane (asked for first, inside the press) and reads the
persisted file. The pane has a header, `[ copy all ]` `[ top ]` `[ bottom ]` (hotkeys `c`,
`t`, `b` while it has focus; the row is repeated under the lines because the buttons scroll
away with them) and the lines with a number gutter. It draws the first 2,000 rows and says
so; copy takes all of the text with colour codes removed.

| Question | Answer |
|---|---|
| Data available | Yes. `ToolGroup.calls[i].output` has `stdout`/`stderr` inline (to 30,000 chars) and `persistedOutputPath` / `persistedOutputSize` for the rest. Seen in a real fullscreen session. Falls back to the cut text with a note when the file cannot be read. |
| Cost per draw | Every `ToolGroup` draw calls the hook. It maps the group's calls through `offerFor`: a tool-name compare, and for a Bash call a field read; no line splitting, because the cut flag is `persistedOutputPath`. Groups with no cut call return `next(e)` at once. The pane builds up to 2,000 `Text` rows per draw (row slicing 0.2 to 0.3 ms for 6,222 lines in the harness). In tmux, a 2,000-row pane opened and scrolled with no visible lag; I did not time it. One file read per press, not per draw. |
| Clutter in the common case | None in a session without a cut output: the offer rule is "finished, not failed, output cut". That also means it helps rarely (see section 6). Stock's own group line is untouched. |
| Stock does it? | No. Stock's expanded view shows the cut text with no note and no way to reach the rest or copy it (confirmed by hand test, also visible in the classic `+6219 lines` view). |
| Risks | The offer depends on `persistedOutputPath` staying a declared field. Pane rows are plain text, so a wide line is cut with an ellipsis (`truncate-end`), not wrapped. A file that Claude Code cleans up turns into the fallback note. In a narrow window (90 columns) the pane opens inline as a bordered box above the prompt; the engine caps its height (about 7 lines of text, then scrolls), so a 2,000-row tree does not swamp the screen, and `b` scrolled it to the end. |

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
| `hooks/output.ts` | pure: Bash record to text and file path, ANSI strip, line count, the offer rule (`offerFor`), row cap, labels |
| `hooks/spike.tsx` | the `ToolGroup` wrap (fullscreen only) and the pane |
| `hooks/output.test.ts` | 11 unit tests |
| `hooks/spike.test.tsx` | 11 harness tests of the wrap, the press, the pane, copy |
| `types/index.d.ts` | the one state key (`scrollback-spike.shown`) |

Run (from the repo root):

```
claude plugin test docs/dev/.scrollback-spike-experiment      # 22 pass
claude plugin validate docs/dev/.scrollback-spike-experiment
cd docs/dev/.scrollback-spike-experiment && ../../../tools/node_modules/.bin/tsc -p .
```

### How the first version failed, and what it taught

The first version wrapped `ToolResult` and passed 19 harness tests, because the harness
mounts whatever site a test names. In a real fullscreen terminal the button never appeared:
stock folds every Bash call into a `ToolGroup`, so `ToolResult` is not drawn for it. Lesson
for the real feature: a harness test proves a hook is right *if called*; only a real session
shows which site stock draws. Check with `$.ui.log(..., { to: 'debug' })` and
`claude --debug-file`.

### What the harness tests settle

- A `ToolGroup` with a cut Bash call keeps the engine's line (`await next(e)` nests) and adds
  a keyed `Button` per such call; none for whole outputs, failed, running or interrupted
  calls, other tools, empty or string outputs, a call without an id; none outside fullscreen
  or on another surface.
- The press asks for the pane **before** the file is read (order `open`, `read`).
- The pane shows the whole file, not the cut text; a file that cannot be read falls back to
  the cut text with a note; a 6,000-line file is cut to 2,000 rows with a note while **copy
  still takes all 6,000**; copy strips colour codes; a second call's button switches the
  pane; the buttons are repeated under the lines.
- Pure edge cases: stdout and stderr joined, stderr alone, CRLF and lone CR, trailing
  newline, ANSI colour and OSC 8 link codes, non-ASCII text, non-Bash and non-string records,
  label shortening, size formatting.
- Not settled by the harness: that `$.ui.scroll` moves the pane (the harness has no laid-out
  window). Settled in tmux below.

### What the tmux run settled (2.1.310, 130 and 90 columns)

Driven with `tmux send-keys` (typing prompts, SGR mouse clicks) and `capture-pane`, with
`pbpaste` to read the clipboard.

- Fullscreen, 130 columns: the pane **docks** at the right (the press opened it at that
  width). Header `Bash · 60,000 lines`; the first lines are `1 1`, `2 2` (gutter, then text).
- `b` jumps to row 2,000 and the "Showing the first 2,000 of 60,000 lines" note, `t` back to the
  top, `c` puts **all 60,000 lines** on the clipboard (348,894 bytes) and the label becomes
  `[ copied ]`. The wheel moves the window. `Esc` closes the pane. Clicking `[ bottom ]` works
  until the buttons scroll out of view, which is why the row is repeated and keyed.
- Three Bash calls in one turn (`printf red...; seq 1 40000`, `seq 1 40000; exit 1`, `ls
  /nonexistent_dir 2>&1; seq 1 40000; true`): one group line, **two buttons** (the call that
  exited 1 gets none). The `red` line pastes as plain `red`, with no escape codes. The `ls`
  error line is in the stream and truncated with an ellipsis in the pane. Pressing the other
  button switches the pane to that call's 40,001 lines.
- `seq 1 40` (whole output): no button. `Ctrl+o` kept the buttons.
- 90 columns: the pane opens inline, bordered, and `b` scrolls it.
- Classic renderer: the engine draws `Bash(...)` + three lines + `+6219 lines`; the mouse is
  not captured, so a click on a button did nothing. The feature therefore does not offer the
  button outside fullscreen.

## 6. Recommendation, ranked

1. **Candidate A as a cheap backlog item, not a headline feature.** It is the only thing found
   that shows what stock cannot, it adds nothing in sessions without a cut output, and it
   works. But output past 30,000 characters is rare, so it fails the "helps in most
   sessions" test in `FEATURES.md`. If built, give it its own toggle row; default on is
   harmless because of the zero clutter, but say so plainly in the README as a rarely
   used extra. Fold the copy button for code blocks (#1 in `feature-ideas.md`) and this one
   into one "copy" convention.
2. **A wider offer (copy for any long result)** would help more sessions but adds a button
   under ordinary long outputs, which is the clutter the first principle forbids, and stock
   already expands them in one click. Not recommended unless hand use shows people struggle to
   copy a long result.
3. **Permission context**: try `$.ui.notice` by hand; build nothing until it proves useful.
4. **Do not build**: collapse/summary replacement (B), prompt outline (C), search pane (D),
   answered-prompt record (F).

For scrollback itself the honest summary is: stock fullscreen covers it, and the complaints
that remain (native search, history depth, dialog behaviour) are outside what a plugin can
change.

## 7. Not verified

- The permission dialog candidates (E, F): nothing was run. `$.ui.notice` has not been tried.
- MCP, WebFetch and Agent result sizes, and whether they are persisted the same way.
- Layout cost of a 2,000-row pane was only watched, not timed.
- Wide characters in pane rows (CJK, emoji) under `truncate-end`.
- Light themes and other terminals (only tmux inside one terminal; fullscreen, 130 and 90
  columns, and classic).
- Whether `persistedOutputPath` files are removed while a session is still open.
- How an output of exactly 30,000 characters is flagged (not persisted: probably no button).

## 8. What to test by hand

Real terminal, only the experiment loaded (not rich-ui):

```
CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir /Users/kavinsingh/EmergentAI/claude-code-rich-ui-wt/docs-scrollback-spike/docs/dev/.scrollback-spike-experiment
```

Ask Claude to run each command with the Bash tool. Already seen in tmux (see section 5); worth
a look by eye for how it feels:

| Ask for | Expect |
|---|---|
| `seq 1 5` and `seq 1 40` | `Ran 1 shell command` and nothing else. |
| `seq 1 60000` | Under the group line a dim `[ full output: seq 1 60000 (340.7 KiB) ]`. Click it: the pane opens beside the chat at 110+ columns; line 1 is `1`. |
| In the pane: `b`, `t`, `c`, the wheel, `Esc` | End of the first 2,000 rows, top, clipboard holds all 60,000 lines and the button reads `copied`, the window moves, the pane closes. |
| Click `Ran 1 shell command` to expand | The button stays under the group. |
| `seq 1 40000; exit 1` | No button. |
| Narrow the window to about 90 columns, press the button | Pane opens above the prompt as a box; `b` scrolls it. |
| Run it with `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` | No button anywhere. |

Look for: flicker or lag while scrolling the 2,000-row pane, a button that is hard to hit,
and whether the dim button under the group line looks like clutter to you.

## Appendix A: the probe

Source of the headless probe (scratch, not kept in the repo): a `tool.call` hook on Bash
that, after `await next(e)`, writes `Object.keys(result)`, `stdout.length`, the line count,
`persistedOutputPath` and `persistedOutputSize`, the model-facing `text` head and tail, and
the result of `$.fs.read(persistedOutputPath)` to a JSON file. Run as
`claude -p --plugin-dir <probe> --permission-mode bypassPermissions --model haiku "Use the
Bash tool exactly once to run: seq 1 60000 ..."`. Output of the 60,000-line run:
`stdoutLen 30000`, `stdoutLines 6222`, `persistedOutputSize 348894`, read-back length
348894 with tail `59999\n60000\n`.

## Appendix B: the tmux recipe

```
tmux new-session -d -s S -x 130 -y 40 -c <empty dir> \
  "CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir <experiment> --permission-mode bypassPermissions --debug-file <log>"
tmux send-keys -t S Up Enter                       # trust the folder on first run
tmux send-keys -t S -l 'Use the Bash tool exactly once to run: seq 1 60000 ...'; tmux send-keys -t S Enter
tmux capture-pane -t S -p                          # read the screen
tmux send-keys -t S -l $'\e[<0;COL;ROWM\e[<0;COL;ROWm'   # click (1-based); the layout shifts when a pane docks, so re-read rows
tmux send-keys -t S -l $'\e[<65;COL;ROWM'          # wheel down
```
