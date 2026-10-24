# Feature ideas

A round of ideas after 0.3.0, from three sources: what the mods API can do (the
`ui-atlas` mod in `../ui-atlas`, which exercises every `ui.render` site), what people ask
for around Claude Code's terminal UI (web search), and what rich-ui already has. Each idea
is judged against the first principle in [`../FEATURES.md`](../FEATURES.md): does it help
in most sessions, and add no clutter. Nothing here is built; "unverified" marks a claim
that needs a spike before it is trusted.

## What the API allows (from ui-atlas)

- **Fifteen render sites** can be wrapped, rewritten or replaced: `UserMessage`,
  `AssistantMessage`, `ToolUse`, `ToolResult`, `ToolGroup`, `CommandOutput`, `ToolProgress`,
  `Spinner`, `TurnDuration`, `InfoNotice`, `SessionMode`, `PromptHint`, `AbovePrompt`,
  `AskUserQuestion` and `Pane`. A wrap keeps the engine's row and adds to it; a rewrite
  changes props (the spinner's `word` and `suffix`, the prompt footer's `modes`, the hint's
  `tail`); a tree replaces the row (the "Baked for 3s" line).
- **Raster** (terminal only) is a grid of cells, each a glyph with a foreground and
  background colour, repainted with `$.ui.blit` at up to 60 fps without a render pass.
  Half-block glyphs give two pixels per cell vertically. **Image** draws a real picture
  on kitty and iTerm2 terminals and alt text elsewhere.
- **Calls:** `$.ui.copy` (clipboard), `$.ui.notify` (native notification), `$.ui.toast`,
  `$.ui.ask` (the question dialog), `$.process.run` (a host command by argument vector),
  `$.fs.exists / stat / list`, hover groups on keyed boxes, tabs and dialog panes.

## What people ask for

- Status lines carrying model, branch, context fullness and cost, with burn rate
  ([ccstatusline](https://azukiazusa.dev/en/blog/claude-code-ccstatusline), [CC Statusline](https://www.mintlify.com/chongdashu/cc-statusline)). rich-ui's band already covers context and plan usage; cost is the open segment.
- Reviewing diffs with comments in the terminal ([revise](https://pkg.go.dev/github.com/justincampbell/revise)). Stock already draws coloured edit diffs, so not a gap.
- Scrollback and long output in fullscreen: older messages unreachable, permission context
  scrolled away ([#7389](https://claudeissues.com/issue/7389-bug-terminal-ui-no-scrollback-limited-response-visibility), [#34354](https://claudeissues.com/issue/34354-auto-scroll-hides-context-when-permission-dialog-appears)). Stock now has `/focus` and ctrl+o.
- Knowing what is happening during a long turn and being told when it ends.

## Candidates

Ordered by how well each passes the first principle.

| # | Idea | What it does | Sites and calls | Verdict |
|---|---|---|---|---|
| 1 | **Copy button on code blocks** | A small `copy` button under each fenced block in a reply. Selecting code by mouse in a terminal is clumsy, and fullscreen makes it worse. | `AssistantMessage` wrap, `$.ui.copy` | Strong: every session has code blocks, additive, one row each. Same shape as mermaid's `show source`. |
| 2 | **Enhance links** | `path:line` and bare or backticked paths become clickable and open in the pane with a code gutter and highlighting (`Code` takes `startLine` and `path`); a modified click opens the editor. | `AssistantMessage` rewrite, `Code`, `$.process.run` (editor, unverified) | Strong: Claude writes `src/foo.ts:42` constantly. Needs a spike (below). |
| 3 | **Turn summary line** | Replace "Baked for 3s" with `Baked for 3s · 4 tools · 2 edits · 1 error`. | `TurnDuration` tree, counts from `tool.call` | Good: one line that already exists, no new row. |
| 4 | **Tool timing** | Show how long each tool call took, and flag the slow ones. | `ToolUse` / `ToolResult` wrap, `tool.call` clock | Good for finding slow commands; may add a line per call, so it needs a quiet design. |
| 5 | **Status band: cost** | A cost segment, only when high (the one feasible round-two item from the spike). | existing band | Cheap, already scoped. |
| 6 | **Turn-finished notification** | A native notification when a turn longer than a minute ends while you are elsewhere. | `$.ui.notify`, `session.end` / turn events (unverified) | Stock may already notify; check `preferredNotifChannel` before building. |
| 7 | **Compact nudge** | When context passes ~85%, the band offers a `compact` button. | band `Button`, running `/compact` from a press (unverified) | Useful if a plugin can run a command; unverified. |
| 8 | **Slicker manager pane** | See below. | `Pane`, `Raster`, hover, tabs | Polish, not a feature, but the one screen every user opens. |
| 9 | **Turn ribbon** (Raster) | See below. | `TurnDuration`, `Raster` | Fun and mildly useful; default off. |

Not recommended: inline edit diffs (stock has them), image-quality diagrams (turned down),
anything that adds a line to every message.

## Enhance links: what a spike would answer

1. Does a rewritten reply keep working when `path:line` is turned into a link? The text is
   ours to change for drawing, but the href must stay in `pressableLinks`.
2. Open any text file, not only markdown: read with `$.fs.read`, draw with `Code`
   (language from the path, `startLine` for the gutter), scroll to the line.
3. Existence check before linkifying a bare path (`$.fs.exists`), so prose is not turned
   into dead links. Cost per reply, and a cache.
4. Modified click: the engine runs ctrl/alt/cmd clicks as the terminal's own action, so a
   plugin-side "open in editor" needs its own trigger (a second button in the pane).
   `$.process.run(["code", "-g", "file:line"])` is the likely route; editor choice from
   `$EDITOR` through `$.env.get`.
5. False positives: version numbers, URLs with colons, `a:b` in prose. Anchor on a known
   extension and a path separator.
6. The engine draws any link it cannot hyperlink as `label (target)` (checked in the
   bundled source), so links written as a path will show their target in terminals without
   hyperlink support. Nothing to do about that.

## Slicker manager pane

Today `/rich-ui` is a list of `[x]` rows with a dim description. Ideas, all inside the
pane and all within what ui-atlas shows is possible:

- **Header banner** drawn with a `Raster`: the word "rich-ui" in half-block pixel type with
  a soft gradient, 3 rows tall. The version sits beside it as a dim badge.
- **Real switches** in place of `[x]`: a small pill (`● on ` and ` off ○`) in the theme's
  success colour, so the state reads at a glance and in the dark.
- **Hover and focus**: the row under the mouse lifts (a keyed box with a hover scope), the
  focused row keeps the engine's reverse video, and the description brightens on hover.
- **Grouping and a status chip** per feature (`ready`, `needs fullscreen`, `error`), fed by
  the status the manager already records.
- **A "what's new" strip** showing the last changelog entry once after an update.
- **Tabs** (Features, Status, About) using the pane tab row, with the current layout kept
  as the first tab.
- A rounded border, section dividers, consistent two-cell gutters, and the same layout when
  docked or inline.

Constraints: the pane draws only theme keys (`text`, `success`, `warning`, ...) except
inside a `Raster`, where colours are raw; a docked pane is 80 columns at most; keep the
footer hints (`Enter toggles · Esc closes`).

## A fun one with Raster

Two options, both off by default so they pass the clutter rule.

1. **Turn ribbon.** After each turn, the "Baked for 3s" line gains a one-row `Raster`
   ribbon: one coloured segment per tool call, its width proportional to its duration
   (reads blue, edits green, bash amber, errors red), idle gaps dim. It shows at a glance
   where a turn spent its time and doubles as a timeline of what Claude did. Data comes
   from timestamps in the `tool.call` hook, which rich-ui already wraps for the preview.
2. **Aurora spinner.** While Claude works, the spinner line draws a slowly shifting
   gradient field (plasma-style, the ui-atlas page repaints one with `$.ui.blit` at about
   15 fps) a few rows tall, then goes away. Pure delight; cost is repaint work and the
   risk of looking noisy, so it should be a toggle and capped in frame rate.

My pick for a first fun feature is the turn ribbon: it is the only one that also tells
the reader something.

## Decisions

Chosen to go forward: the copy button, the manager pane refresh, an enhance-links spike,
the aurora spinner (off by default), and a new spike on scrollback and long tool output
(done: [`scrollback-spike.md`](scrollback-spike.md); one candidate worth building, "Long output").
Dropped: tool timing, the turn summary line, the compact nudge and the turn ribbon. The
cost segment and the turn-finished notification stay in the backlog, not scheduled.

## Suggested order

1. Copy button on code blocks (small, broad, safe).
2. Manager pane refresh (small, visible, low risk).
3. Enhance links spike, then build.
4. Turn summary line and the cost segment together (both are small band and row changes).
5. Turn ribbon, as the Raster showcase.
