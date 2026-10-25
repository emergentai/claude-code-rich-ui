# Manager pane refresh

A visual pass on `/rich-ui`, the pane that turns features on and off. It is not a feature
with a switch: the manager is always present. Behaviour and keys are unchanged.

## What you see

```
 ▀     █           ▀
 █▀▀ █ █▀▀ █▀▄ ▄▄▄ █ █ █
 █   █ █▄▄ █ █     █▄█ █                                    3 of 3 on
 ──────────────────────────────────────────────────────────────────

 ● on   Mermaid diagrams                                       note
        Draw mermaid diagrams as text diagrams
        Diagrams left as code: terminal size unknown

 ○ off  Status band
        Show context and plan usage under the prompt when they run high

 ● on   Markdown preview
        Open a markdown file Claude links to, rendered, in a pane

 Enter toggles · Esc closes · rich-ui 0.4.0
```

- **Banner.** "rich-ui" in half-block type with an orange-to-violet gradient, three rows,
  drawn once as a `Raster` (terminal only). In a pane under about 35 columns it is a bold
  title in the same three rows. On the right, a dim `N of M on`.
- **Switches.** `● on ` (green, bold) and `○ off` (dim). The shape carries the state, so
  it reads without colour.
- **Hover.** The row under the mouse lightens and its description brightens. The focused
  row keeps the engine's reverse video.
- **Chip.** `error` (red) or `note` (amber) beside a feature's name only when it has a
  status entry; the detail lines stay under the description. A healthy feature has none.
- **Experimental.** A feature with `isExperimental` is listed after the regular ones under an
  `Experimental · may be removed in any version` header (today: the welcome greeting, whose text field sits
  under its row).
- **Layout.** One divider under the header, a blank row above each option and above the
  footer, a one-cell gutter everywhere (two when docked), no border of our own because the
  engine frames the pane.
- **Footer pinned (docked).** When the dock is taller than the content, the footer sits at
  the bottom of the dock. If the content is taller, or the pane is inline, nothing is pinned.

## Not done, and why

Tabs, a "what's new" strip, a border, animation: see "Outcome" in
[`../dev/feature-ideas.md`](../dev/feature-ideas.md).

## Limits

The pane opens with a fixed number of rows (`contentRows`). An inline pane is capped by
the terminal's height: at 40 terminal rows about 12 content rows fit, and the pane is 15
(a blank row above each feature and one above the footer), so on a terminal under about 50 rows
the footer, and under about 45 the last feature, is cut. A taller terminal, or the docked layout, shows it all.

## Code

| File | Role |
|---|---|
| `hooks/manager/banner.ts` | the banner's Raster cells and gradient (pure) |
| `hooks/manager/pane.tsx` | the pane tree: header, pills, chips, hover, footer |
| `hooks/manager/size.ts` | `contentRows`, `clip` |
| `hooks/manager/index.ts` | unchanged: state, toggle, `$.ui.open` |
