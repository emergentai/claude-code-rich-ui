# rich-ui: how the mod fits Claude Code's own UI

Status: spike done 2026-10-23 on Claude Code 2.1.309, dark theme, tmux at 62, 100, 110, 130 and 180 columns. Method: drive a real interactive session in tmux, send the same prompts with and without the plugin, and compare the screen text and the ANSI colors (`scripts/ui-capture.sh`).

## 1. The problem

The first build replaced the whole `AssistantMessage` row with its own tree. That dropped the frame the engine draws around every assistant block, so a reply with a diagram looked different from the rest of the session: no `⏺` bullet, no indent, no blank lines, a very dark gray, a toggle sitting flush under the diagram, and tall diagrams.

## 2. What the engine draws around an assistant block (measured)

From a native session (feature off), for a reply with text, a code block and text:

| Part | Native |
|---|---|
| Above a block | one blank line (a top margin) |
| Bullet | `⏺` in a two-cell column, only on the block that opens a reply (`isFirstOfReply`); ANSI fg 231 (theme `text`) |
| Content | starts at column 2, wraps at the terminal width |
| Between parts of one block | one blank line (paragraph, code block, paragraph) |
| Code block | a dim language label line (`mermaid`), then the code in the default color, no border |
| After a tool row | the next block opens a new reply: blank line, bullet |
| Secondary text | fg 246 gray (tool summaries, the footer line); a code block label is SGR dim |

A hook that returns its own tree for `AssistantMessage` replaces all of this (the `AssistantMessage` doc says `isFirstOfReply` is "the block that draws the bullet"), so the hook must reproduce it.

## 3. What changed in the mod

- `buildReply` now draws the frame: `Box row marginTop 1` holding a two-cell column (the bullet in theme color `text`, or a blank cell) and a column with `gap 1` for the content. Verified against native captures: same lines, same blank lines, bullet ANSI identical (38;5;231).
- Diagram lines use the default text color, like a native code block. No fixed dim and no theme key for the lines: the earlier `dimColor` looked bad in the light theme, and `subtle` rendered as a very dark gray (239) on a dark background. The default foreground is correct in both. Only the toggle row is secondary: a dim `Button`, which renders at the engine's own secondary gray (246).
- The toggle moved from below the diagram to a dim row above it, where the native code block puts its label.
- The renderer is called with `paddingY: 1`: a three-node top-down flowchart drops from 25 rows to 17. `boxBorderPadding: 0` would give 11 rows but puts labels against the border, so it was not taken.
- `isSummary` rows are left to the engine (it adds its own faint " · summary" mark).
- Tests: the first block of a reply has the bullet and later blocks do not; a summary row goes to the engine.

## 4. The `/rich-ui` manager: a band, not a Pane

Findings:
- A `Pane` is placed by the engine: docked beside the transcript in a fullscreen terminal of 110+ columns, otherwise inline above the prompt. A plugin cannot choose; `$.ui.open` has no placement option. The dock was a wide, tall strip for a few lines, and in a light-theme session it carried the engine's own dock chrome. Asking for a narrower dock (`columns`) was tried and rejected by the owner.
- The `AbovePrompt` band is always above the prompt (the strip the engine uses for surveys, with its own `[-]` collapse mark), so the manager is a band now: `/rich-ui` sets a `managerOpen` state value, the band's `ui.render` hook draws while it is true (and yields to a survey), and a `close` button clears it.
- Cost: a band cannot be given the keyboard by the plugin (`$.ui.focus` is denied with "that site does not hold the keys"; the band's `requestId` is `above-prompt`). Mouse clicks work; for the keyboard the person presses ctrl+x then Tab, after which Enter toggles the focused row. The band says so on its own line.
- Light theme (reproduced with `claude --settings '{"theme":"light"}'`): the focused row is reverse video and a gray description nested in the button label lost its contrast. The description is on its own dim line, so focus inverts only `[x] Name`. Every color is the engine's theme color (secondary gray 241 in light, 246 in dark); none is fixed.
- Unchanged earlier fixes: the first row has `autoFocus` (it takes the ring when the person focuses the band), and long lines are clipped to the band width.

## 5. Not yet verified

- Light theme: owner confirmed the diagram frame looks right (checks 2 and 3); the pane was fixed as above and re-captured in the light theme, owner re-check pending.
- A reply whose very first block is a diagram, and a diagram inside a numbered list (the fence is not top-level, so it stays code by design).
- Fullscreen versus non-fullscreen (the pane docks only in fullscreen; both were seen in tmux, the diagram frame was only compared in the fullscreen layout).

## 6. Rules for any future feature that replaces a native row

1. Capture the native row first (same prompt, feature off) and match its lines, blank lines and ANSI before adding anything.
2. Use theme keys (`text`, `subtle`, `warning`) or the default color; never a fixed color. Check `subtle` on a dark background before using it.
3. Reproduce the engine's frame (margin, bullet column, indent) or rewrite only the props and let the engine draw.
4. Use `autoFocus` on the primary control of a pane, and pad the body when `placement` is `dock`.
