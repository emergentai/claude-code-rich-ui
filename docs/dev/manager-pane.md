# rich-ui: Manager Pane

Status: draft for review. Depends on `architecture.md` (state, persistence, feature status) and the feature metadata defined there.

## 1. What it is

`/rich-ui` opens a small dialog listing every feature with a checkbox. Pressing a row turns that feature on or off immediately. Esc closes the dialog. It is the only control surface for the plugin: there are no subcommands, flags or settings rows elsewhere.

The manager is core, not a feature. It has no toggle of its own and is always present while the plugin is installed.

## 2. Scope

In v1:
- Terminal surface only. On any other surface the pane hook passes through to the engine.
- One row per feature in the registry, in registry order.
- Per-row status lines (errors and notes) from the shared feature status described in `architecture.md` 4.5.
- A footer line with key hints and the plugin version.

Out of v1: reset to defaults, number hotkeys, per-feature settings, a docked sidebar layout, and any way to open the pane other than the slash command.

## 3. Layout

```
rich-ui features

 [x] Mermaid diagrams   Draw mermaid diagrams as text diagrams
     Diagrams left as code: terminal size unknown
 [ ] Rendered tables    Draw markdown tables as aligned grids

 Enter toggles · Esc closes · rich-ui 0.1.0
```

(The second feature is shown only to illustrate a longer list; v1 ships one feature.)

Elements, top to bottom:
1. Header: the text "rich-ui features" in bold.
2. One feature row each: a plain `Button` whose children are the checkbox glyph (`[x]` on, `[ ]` off), the feature name, and the description in a dim `Text`. The whole row is one press target and keeps its own `key` equal to the feature id.
3. Under a row, zero or more status lines, indented to align with the name. Notes are dim. Errors use the theme's `warning` color. Status lines are plain text and not pressable.
4. A dim footer: "Enter toggles · Esc closes · rich-ui <version>".

Rules:
- Descriptions are one line and at most 60 characters. A row wider than the pane's body width is cut at the edge with an ellipsis; the name and checkbox always remain visible.
- A status line is shown only while its entry stands (cleared on the feature's off/on toggle or on session restart, see `architecture.md` 4.5). The text of an error entry is the feature name plus a short message, for example "Mermaid diagrams: failed 2 times, last error: <message>"; messages longer than the pane width are cut with an ellipsis.
- The pane never shows anything for a feature that is healthy and has no note.

## 4. Behavior

### 4.1 Opening

- The plugin registers the command `rich-ui` at `session.start`.
- `command.run` for `rich-ui` calls `$.ui.open` with id `rich-ui`, title "rich-ui", `focus: true`, `closeOnEscape: true` and `rows` set to the content height (header, spacer, feature rows, their status lines, spacer, footer). It answers `{}`: the command's `text` is optional, so nothing extra is added to the transcript.
- `holdToasts` is left off so the pane does not suppress other plugins' notifications.
- Opening an already open pane re-sends the title and size; it does not create a second pane.
- `focus` is only a request. If the user has text in the composer when they run the command it cannot be: the pane then opens without the keyboard and can be focused by click or the engine's focus chord.

### 4.2 Interaction

- Tab and the arrow keys move between rows; Enter or a click presses the focused row; Esc closes the pane. No other keys are bound.
- Pressing a row calls the shared toggle function from `prefs.ts`: it flips the feature's flag in `$.state`, writes `$.store`, and clears that feature's status entry. Because `$.state` changed, the pane redraws and every hook sees the new flag at its next event.
- Toggling affects new output only; nothing already on screen is redrawn.
- The pane stays open after a toggle so several features can be changed in one visit.

### 4.3 Rendering

The pane is drawn by a `ui.render` hook on component `Pane` with `requestId` `rich-ui`. It reads the `enabled` and `status` atoms through the state library, so a toggle or a newly posted note redraws it with no manual invalidation. The render hook only reads state; presses write it from their handlers, as the engine requires. On a surface other than the terminal the hook returns `next(e)`.

## 5. Components

```
hooks/manager/
  index.ts          # registers the command and the pane hooks
  pane.tsx          # builds the tree (header, rows, status lines, footer)
  row.tsx           # one feature row and its status lines
  size.ts           # content height for `rows`
  *.test.ts(x)      # tests beside each file
hooks/core/
  version.ts        # the plugin version shown in the footer
```

The footer's version cannot be read from `plugin.json` at run time (the module may import only `.ts`/`.tsx`/`.js` family files, not JSON), so `version.ts` holds the string and a test fails if it differs from `.claude-plugin/plugin.json`.

## 6. Failure handling

- The manager is not behind the feature gate, so its own errors are not recorded as feature failures. If the pane's render hook throws, the engine skips it and the pane is empty; the failure appears in the debug log and, while hot-reloading, as the engine's dim transcript line.
- If writing `$.store` fails after the state flag flipped, the toggle still holds for the current session and `saveFailed` is set (see `architecture.md` 4.4). The footer line shows "Couldn't save your choice" in the `warning` color until the next successful save.

## 7. Testing

Automated (`claude plugin test`, terminal surface):
- Rows: one per registry feature, checkbox matches the flag, description dim and cut when narrow.
- Press: toggles the flag in `$.state` and writes `$.store`; clears that feature's status; other features unchanged.
- Status: a note renders dim under its row, an error renders in the warning color, a healthy feature shows none.
- Footer: version equals the value in `.claude-plugin/plugin.json`.
- Command: `rich-ui` is registered, running it opens the pane with the expected arguments and answers with no text.
- Non-terminal surface: the hook returns the engine's drawing unchanged.
- Store failure: the toggle holds in state and the save-failure line appears.

Manual before release:
- Open the pane in 80-column and wide terminals; tab and arrow navigation; Esc returns the keyboard.
- Light and dark themes: dim notes and the warning color remain readable.
- Run `/rich-ui` with text in the composer to see the unfocused case.

## 8. Open items to verify during implementation

1. The slash name users type is exactly `/rich-ui` (not prefixed by a plugin namespace).
2. A `Button` holding a checkbox string plus a dim `Text` stays on one line and truncates as expected on narrow panes.
3. Whether `rows` taken from the content height is honored inline, and what happens when a status line is posted while the pane is open (the pane may need to scroll).
4. Whether `claude plugin test` can set `$.store` to fail, to test the save-failure line.
