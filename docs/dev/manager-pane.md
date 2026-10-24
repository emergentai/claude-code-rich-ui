# rich-ui: Manager Pane

Status: implemented in v0.1.0, refreshed after 0.3.0 (section 3, and [`../features/manager-refresh.md`](../features/manager-refresh.md)) and checked in a real terminal (`verification-notes.md`, `ui-style-study.md`). Depends on `architecture.md` (state, persistence, feature status) and the feature metadata defined there.

## 1. What it is

`/rich-ui` opens a small pane listing every feature with an on/off switch. Pressing a row turns that feature on or off immediately. Esc closes the dialog. It is the only control surface for the plugin: there are no subcommands, flags or settings rows elsewhere.

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
 ▀     █           ▀
 █▀▀ █ █▀▀ █▀▄ ▄▄▄ █ █ █          (banner: 3 rows of half blocks)
 █   █ █▄▄ █ █     █▄█ █                        3 of 3 on
 ────────────────────────────────────────
 ● on   Mermaid diagrams            note
        Draw mermaid diagrams as text diagrams
        Diagrams left as code: terminal size unknown
 ○ off  Status band
        Show context and plan usage under the prompt when they run high
 Enter toggles · Esc closes · rich-ui 0.3.0
```

Elements, top to bottom, all inside a one-cell gutter (plus one more when docked, because the dock supplies none):
1. Header, 3 rows: a `Raster` banner of "rich-ui" in half-block pixel type with a left-to-right orange-to-violet gradient (`banner.ts`), and on the right a dim `N of M on` summary. The Raster's colours are raw (it is the one place the pane leaves the theme keys; both ends are mid-tone so they read on light and dark). When the pane is too narrow for banner and summary (under about 35 columns) the header is a bold `rich-ui` on the middle row of the same 3 rows, so `contentRows` does not change with width.
2. A divider: a row of `─` in the theme's `text` colour, dimmed.
3. Per feature, a keyed `Box` (`row-<id>`, a hover scope with `backgroundColor: subtle`) holding: a plain `Button` (key = feature id, so tests and presses are unchanged) whose children are a fixed-width pill and the name; a status chip beside it only when the feature has an error (`error`, theme `error`) or a note (`note`, theme `warning`); the description on its own dim line indented under the name, which brightens on hover (`hover={{ dimColor: false }}`); then the status lines as before. The pill is `● on ` in `success` (bold) or `○ off` in `inactive`: the glyph carries the state without colour. Focus still draws the button in reverse video; the description stays outside the button for the contrast reason in the old design.
4. The save-failure line when set, and the dim footer `Enter toggles · Esc closes · rich-ui <version>`.

Rules:
- Every text colour is a theme key or `dimColor`; only the banner is raw.
- Any line wider than the body is cut with an ellipsis; the pill and name always remain visible.
- No border of our own: the engine frames the pane (inline and docked), and a second frame would spend two rows and columns. A healthy feature has no chip and no status line.
- No tabs and no "what's new" strip (see the PR for why). No timers, no `$.ui.blit`: the banner is static, so nothing redraws on its own.
- The pane is as tall as `contentRows`: 3 + 1 + 2 per feature + status lines + save line + 1. An inline pane is capped by the terminal height (seen: 11 content rows at 40 terminal rows), so the layout spends no row on decoration below the list; with more features than fit, the footer is what is cut first.

## 4. Behavior

### 4.1 Opening

- The plugin registers the command `rich-ui` at `session.start`.
- `command.run` for `rich-ui` calls `$.ui.open` with id `rich-ui`, title "rich-ui", `focus: true`, `closeOnEscape: true` and `rows` set to the content height (`contentRows`: banner, divider, two rows per feature, their status lines, footer, plus one when the save-failure line shows). It answers `{}`: the command's `text` is optional, so nothing extra is added to the transcript.
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
  banner.ts         # the banner's Raster cells (pure)
  size.ts           # contentRows (for `rows`) and clip
  *.test.ts(x)      # tests beside each file
hooks/core/
  version.ts        # the plugin version shown in the footer
tools/check-version.mjs     # fails if version.ts and plugin.json disagree
```

The footer's version cannot be read from `plugin.json` at run time (the module may import only `.ts`/`.tsx`/`.js` family files, not JSON), and plugin tests have no filesystem, so `version.ts` holds the string and `npm run check:version` (in `tools/`) (a script, run before a release) fails if it differs from `.claude-plugin/plugin.json`.

`startSession` is the plugin's one `session.start` handler: it loads the saved choices from `$.store` into state and registers the command (the engine allows one unmatched hook per event).

## 6. Failure handling

- The manager is not behind the feature gate, so its own errors are not recorded as feature failures. If the pane's render hook throws, the engine skips it and the pane is empty; the failure appears in the debug log and, while hot-reloading, as the engine's dim transcript line.
- If writing `$.store` fails after the state flag flipped, the toggle still holds for the current session and `saveFailed` is set (see `architecture.md` 4.4). The footer line shows "Couldn't save your choice" in the `warning` color until the next successful save.

## 7. Testing

Automated (`claude plugin test`, terminal surface):
- Rows: one per registry feature, pill matches the flag (`● on` / `○ off`), description dim and cut when narrow; banner Raster present, replaced by a plain title when narrow; `N of M on` summary; `error`/`note` chip only with a status entry; first row autofocus; row maths (`contentRows`).
- Press: toggles the flag in `$.state` and writes `$.store`; clears that feature's status; other features unchanged.
- Status: a note renders dim under its row, an error renders in the warning color, a healthy feature shows none.
- Footer: shows the version; equality with `.claude-plugin/plugin.json` is checked by `tools/check-version.mjs`.
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
