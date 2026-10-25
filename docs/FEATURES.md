# rich-ui: Features and backlog

What ships, what is planned and what was turned down. The rules every entry has to
pass are in [`PRODUCT_CHARTER.md`](PRODUCT_CHARTER.md): above all, a feature ships only
if it improves the experience in the large majority of sessions, adds no clutter, and
can be switched off on its own.

## Shipped

### Mermaid diagrams (v0.1.0; more types in v0.2.0)

When Claude's reply contains a complete fenced `mermaid` code block, the feature draws
it as a text diagram (box-drawing characters) instead of leaving raw code the reader
has to parse in their head. One press on the row above the diagram swaps it for the
original source and back.

**Why it is the anchor feature.** It is the clearest instance of the first principle:
strictly additive, and nearly nobody is worse off seeing a diagram instead of mermaid
source.

**Scope.**
- Complete, top-level mermaid fences in assistant replies, on the terminal surface only.
- Flowchart (including subgraphs), sequence, class, state, entity relationship, XY chart,
  pie, C4 and architecture diagrams (v0.2.0 added the last four with the renderer swap
  to zombie-mermaid). Everything else (gantt, journey, mindmap, timeline, gitGraph)
  stays a normal code block until the renderer draws it.
- A diagram that does not fit the window (a flowchart is tried sideways first), and any
  unfinished fence, stays a normal code block.
- Off in `/rich-ui` and every diagram in the chat goes back to plain code, exactly as
  Claude Code draws it without the mod.
- No network calls, no external services, no stored diagrams: pure local rendering of
  what is already in the transcript.

**Not in v1.** Image-quality diagrams (the stated end goal; a spike ranks the path),
mermaid in files Claude writes or reads, editing, exporting, a diagram gallery,
other diagram languages such as PlantUML.

Design: [`dev/mermaid-feature.md`](dev/mermaid-feature.md).

### Status band (v0.2.0)

A single line under the prompt showing context fullness and plan usage (5h, 7d, spend)
only when they run high; a healthy session shows nothing. Off in `/rich-ui` clears it.
Not yet: model and cache segments, per-segment switches, colors.

Reference: [`features/status-band.md`](features/status-band.md). Research:
[`dev/status-band-research.md`](dev/status-band-research.md).

### Markdown preview (v0.3.0)

Click a link to a markdown file in one of Claude's replies and the file opens, rendered,
in a pane beside the chat (or above the prompt in a narrow window). No command and
nothing opens by itself. The pane follows the file when Claude edits it.

- Tables are drawn fitted to the pane, images show as `[image: name]`, and a long file is
  cut with a note.
- Links in a reply that also holds a mermaid diagram are not clickable (rare, not planned).
- Off in `/rich-ui` and links go back to stock.

Reference: [`features/markdown-preview.md`](features/markdown-preview.md). Spike:
[`dev/next-feature-spikes.md`](dev/next-feature-spikes.md).

### Zen spinner and Zen footer (experimental, v0.4.0)

Two switches under Experimental in `/rich-ui`, the spinner on by default and the footer off. The Zen spinner makes the
working row one line with a gliding highlight on a short track, the mode and the seconds, in
the theme's spinner colour; the turn-end line becomes a dim `3s`, and the background-task
hint goes. The Zen footer replaces the hint line under the prompt with a random zen saying
that changes each turn (the permission-mode pill stays, so it reads `⏵⏵ auto mode on ·
Chop wood, carry water.`), and hides the dim notices under the logo.

Not here on purpose: hiding tool rows and mid-turn narration. Claude Code's `/focus` view
does that, so this does not repeat it. No preset ties the two together.

Not yet: the name of the running tool on the spinner line.

Reference: [`features/zen.md`](features/zen.md). Spike, design and the `/focus` notes:
[`dev/calm-mode-spike.md`](dev/calm-mode-spike.md), [`dev/calm-mode-design.md`](dev/calm-mode-design.md),
[`dev/calm-mode-focus-research.md`](dev/calm-mode-focus-research.md).

### Manager pane refresh (v0.4.0)

`/rich-ui` looks finished: a block-letter banner with a gradient (terminal only), real
`● on` / `○ off` switches, rows that lighten under the mouse, a small `error` or `note`
tag on a feature that has something to say, a divider and consistent gutters. The keys
are as before (Enter toggles, Tab walks the rows, Esc closes). Polish of the one screen
every user opens, not a toggleable feature: the manager has no switch of its own.

Reference: [`features/manager-refresh.md`](features/manager-refresh.md). Manual check:
[`dev/manager-refresh-manual-test.md`](dev/manager-refresh-manual-test.md).

## Experimental

Features here are tried out and may be removed in any future version. Each has its own switch in
`/rich-ui`, under an **Experimental** header.

### Welcome greeting (v0.4.0)

A big orange "welcome" sweeps in from the left above the prompt, holds a moment and sweeps out, once per
session, and ends at once when you send a message. On by default. The word can be changed in
`/rich-ui` (20 characters, saved as you type). Pure delight, so it is experimental and terminal-only.

Reference: [`features/welcome-greeting.md`](features/welcome-greeting.md). Manual check:
[`dev/welcome-greeting-manual-test.md`](dev/welcome-greeting-manual-test.md).

## Backlog

Not committed. Each would be its own feature, independently toggleable, and each must
first pass the first principle: does it improve the experience in the large majority of
sessions, not just some?

- **Rendered tables (JSON and CSV only).** Stock Claude Code already draws markdown
  tables as grids and falls back to per-row records in narrow windows, so only JSON arrays
  and CSV in code fences remain, and those look rare. Low priority; spike:
  [`dev/tables-spike.md`](dev/tables-spike.md).
- **More mermaid types.** XY chart, pie, C4 and architecture shipped in 0.2.0. Gantt,
  mindmap, timeline, gitGraph and journey wait for a text renderer that draws them; we do
  not write our own. Research: [`dev/mermaid-diagram-types-research.md`](dev/mermaid-diagram-types-research.md).

## Turned down

- **Inline edit diffs.** Stock Claude Code already prints a coloured diff with context
  after each `Edit` and `Write` (checked 2.1.310), so there is nothing to add. Spike:
  [`dev/next-feature-spikes.md`](dev/next-feature-spikes.md).
- **Image-quality diagrams.** Pictures instead of text diagrams (by a bundled rasterizer,
  the `Raster` element or a headless browser) are not wanted: text diagrams work in every
  terminal and need nothing installed.
- **Detailed view of Bash tool commands.** Sometimes useful, not usually, and people
  prefer less clutter in a world of AI noise. This is the example that defines the first
  principle.

## Adding a feature

1. Write the case for it against the first principle in a few lines here, under Backlog.
2. Give it a design doc in `docs/dev/`, like the mermaid one.
3. Build it as a folder under `hooks/features/` with its metadata and its handlers,
   list it in the registry and add one `on(...)` line per hook in `hooks/register.tsx`
   (see `dev/architecture.md` sections 4.0 to 4.3).
4. Move it from Backlog to Shipped, and add it to the README's feature table.
