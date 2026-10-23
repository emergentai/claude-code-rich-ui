# rich-ui: Manager Pane

Status: implemented in v0.1.0 and checked in a real terminal (`verification-notes.md`, `ui-style-study.md`). Depends on `architecture.md` (state, persistence, feature status) and the feature metadata defined there.

## 1. What it is

`/rich-ui` opens a small pane listing every feature with a checkbox. Pressing a row turns that feature on or off immediately. Esc closes the dialog. It is the only control surface for the plugin: there are no subcommands, flags or settings rows elsewhere.

The manager is core, not a feature. It has no toggle of its own and is always present while the plugin is installed.

## 2. Scope

In v1:
- Terminal surface only. On any other surface the pane hook passes through to the engine.
- One row per feature in the registry, in registry order.
- Per-row status lines (errors and notes) from the shared feature status described in `architecture.md` 4.5.
- A footer line with key hints and the plugin version.

Out of v1: reset to defaults, number hotkeys, per-feature settings, and any way to open the pane other than the slash command. Where the pane sits is the engine's call: inline above the prompt (a framed box sized to the content) below 110 columns or outside fullscreen, docked beside the transcript in a fullscreen terminal of 110+ columns. A plugin cannot choose, and the manager adapts to both (padding when docked).

## 3. Layout

```
rich-ui features

 [x] Mermaid diagrams
     Draw mermaid diagrams as text diagrams
     Diagrams left as code: terminal size unknown
 [ ] Rendered tables
     Draw markdown tables as aligned grids

 Enter toggles · Esc closes · rich-ui 0.1.0
```

(The second feature is shown only to illustrate a longer list; v1 ships one feature.)

Elements, top to bottom:
1. Header: "rich-ui features" in bold, in the theme's `text` color, then a blank line.
2. Per feature, a plain `Button` whose label is the checkbox glyph (`[x]` on, `[ ]` off) and the feature name, in the theme's `text` color. The whole row is one press target and keeps its own `key` equal to the feature id; the first row has `autoFocus` so Enter works as soon as the pane opens. Under it, the description on its own line, indented four cells, in a dim `Text`. The description is not part of the button because focus draws the button in reverse video, and a gray description inside it lost its contrast in the light theme.
3. Under that, zero or more status lines, indented to align with the description. Notes are dim. Errors use the theme's `warning` color. Status lines are plain text and not pressable.
4. A blank line, the save-failure line when set, and a dim footer: "Enter toggles · Esc closes · rich-ui <version>".

Rules:
- Every line of text has an explicit theme color (`text`, `warning`, or `dimColor`). The engine paints the pane background from Claude's theme but draws uncolored text in the terminal's own default, which is wrong when the two disagree (found in the light-theme check).
- When `placement` is `dock` the body adds one cell of side padding (the dock supplies none) and lines are clipped to the narrower width. Inline, the frame supplies the padding.
- Descriptions are one line. Any line wider than the pane's body width is cut at the edge with an ellipsis; the checkbox and name always remain visible.
- A status line is shown only while its entry stands (cleared on the feature's off/on toggle or on session restart, see `architecture.md` 4.5). The text of an error entry is the feature name plus a short message, for example "Mermaid diagrams: failed 2 times, last error: <message>".
- The pane never shows anything for a feature that is healthy and has no note.

## 4. Behavior

### 4.1 Opening

- The plugin registers the command `rich-ui` at `session.start`.
- `command.run` for `rich-ui` calls `$.ui.open` with id `rich-ui`, title "rich-ui", `focus: true`, `closeOnEscape: true` and `rows` set to the content height (header, spacer, two rows per feature, their status lines, spacer, footer, plus one when the save-failure line shows). It answers `{}`: the command's `text` is optional, so nothing extra is added to the transcript.
- `holdToasts` is left off so the pane does not suppress other plugins' notifications.
- Opening an already open pane re-sends the title and size; it does not create a second pane.
- `focus` is only a request. If the user has text in the composer when they run the command it cannot be: the pane then opens without the keyboard and can be focused by click or the engine's focus chord.

### 4.2 Interaction

- Tab and the arrow keys move between rows; Enter or a click presses the focused row; Esc closes the pane. No other keys are bound.
- Pressing a row runs the toggle written inline in the manager's render handler (the engine's module scan forbids passing `$` to helpers; `prefs.ts` supplies the pure `toggled` and `serialize`): it flips the feature's flag in `$.state`, clears that feature's status entry, and writes `$.store`. Because `$.state` changed, the pane redraws and every hook sees the new flag at its next event.
- Toggling affects new output only; nothing already on screen is redrawn.
- The pane stays open after a toggle so several features can be changed in one visit.

### 4.3 Rendering

The pane is drawn by a `ui.render` hook on component `Pane` with `requestId` `rich-ui`. It reads the `enabled`, `status` and `saveFailed` atoms through the state library, so a toggle or a newly posted note redraws it with no manual invalidation. The render hook only reads state; presses write it from their handlers, as the engine requires. On a surface other than the terminal the hook returns `next(e)`.

## 5. Components

```
hooks/manager/
  index.ts          # exported handlers: startSession, runCommand, renderPane
  pane.tsx          # buildPane: the tree from plain data and callbacks
  size.ts           # contentRows (for `rows`) and clip
  *.test.ts(x)      # tests beside each file
hooks/core/
  version.ts        # the plugin version shown in the footer
scripts/check-version.mjs   # fails if version.ts and plugin.json disagree
```

The footer's version cannot be read from `plugin.json` at run time (the module may import only `.ts`/`.tsx`/`.js` family files, not JSON), and plugin tests have no filesystem, so `version.ts` holds the string and `npm run check:version` (a script, run before a release) fails if it differs from `.claude-plugin/plugin.json`.

`startSession` is the plugin's one `session.start` handler: it loads the saved choices from `$.store` into state and registers the command (the engine allows one unmatched hook per event).

## 6. Failure handling

- The manager is not behind the feature gate, so its own errors are not recorded as feature failures. If the pane's render hook throws, the engine skips it and the pane is empty; the failure appears in the debug log and, while hot-reloading, as the engine's dim transcript line.
- If writing `$.store` fails after the state flag flipped, the toggle still holds for the current session and `saveFailed` is set (see `architecture.md` 4.4). The footer line shows "Couldn't save your choice" in the `warning` color until the next successful save.

## 7. Testing

Automated (`claude plugin test`, terminal surface):
- Rows: one per registry feature, checkbox matches the flag, description dim and cut when narrow.
- Press: toggles the flag in `$.state` and writes `$.store`; clears that feature's status; other features unchanged.
- Status: a note renders dim under its row, an error renders in the warning color, a healthy feature shows none.
- Footer: shows the version; equality with `.claude-plugin/plugin.json` is checked by `scripts/check-version.mjs`.
- Command: running `rich-ui` answers with no text. (The arguments passed to `$.ui.open` are not asserted: the kit's `ui.open` stand-in is registered once, by the harness.)
- Non-terminal surface: the hook returns the engine's drawing unchanged.
- Note lifecycle: a note posted while a message draws appears under the row, and a toggle clears it.
- Store failure: the toggle holds in state and the save-failure line appears.

Manual before release:
- Open the pane in 80-column and wide terminals; tab and arrow navigation; Esc returns the keyboard.
- Light and dark themes: dim notes and the warning color remain readable.
- Run `/rich-ui` with text in the composer to see the unfocused case.

## 8. Open items (closed unless noted)

1. The slash name is `/rich-ui` (confirmed in the live check).
2. A button holding only the checkbox and name stays on one line; the description moved to its own line (section 3).
3. `rows` is honored inline; the dock ignores it. Status lines posted while the pane is open redraw it.
4. Store failure is testable: the harness's store stand-in can be made to throw, and the save-failure line test passes.
5. Still open: the owner's light-theme check of the explicit theme colors in section 3.
