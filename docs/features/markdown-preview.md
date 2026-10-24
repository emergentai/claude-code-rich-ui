# Markdown preview

Click a link to a markdown file in one of Claude's replies and the file opens, rendered
(headings, lists, tables, code, links), in a pane. There is no command and nothing opens
by itself.

- id `markdown-preview`, name "Markdown preview", `defaultEnabled: true`
- Toggle: its own row in `/rich-ui`. Off, links behave as Claude Code draws them.
- Spike behind it: [`../dev/next-feature-spikes.md`](../dev/next-feature-spikes.md)

## Use

When Claude's reply links to a local markdown file, for example `[the plan](docs/plan.md)`,
`[spec](/Users/me/repo/spec.md)` or `[notes](file:///tmp/notes.md)`, a plain click on the
link opens that file in the pane. Esc closes it. The pane scrolls with the wheel, and with
the keys while it has focus. Clicking another link replaces the file on show, and when Claude
edits the file on show the pane refreshes.

## What counts as a preview link

- A markdown link `[text](target)` whose target has no scheme (or `file:`) and ends in `.md`,
  `.markdown` or `.mdx`, with an optional `#fragment` or `?query` (ignored).
- Relative targets are placed under the session's working directory.
- Not links: web links, images, other file types, and paths written as plain text or in
  backticks (`docs/plan.md`).

## What the pane shows

The text is drawn by the engine's `Markdown` element, the renderer used for Claude's
replies, so it follows the theme. Three things are prepared first, because the engine
draws them badly in a pane:

- **Tables** are drawn as box-drawn tables fitted to the pane width: wide columns shrink and
  their text wraps, and CJK and emoji count as two cells. The engine sizes tables to the
  terminal, not the pane, so in a narrow pane its own tables wrap and break. The cost is
  that bold, links and other markup inside a cell show as plain text. Tables inside code
  fences are left alone.
- **Images** are text only: `<img>` and `![alt](src)` become `[image: alt]` (the file name
  when there is no alt). In a heading an image is dropped, as it is decoration.
- **Entities** such as `&nbsp;` and `&amp;` are decoded. Code fences and inline code are shown
  as written.

## Behavior and limits

- The pane opens inside the click. A pane opened after an await is not tied to the click and
  is placed only from 144 columns, so it is asked for first and the file loads after. If it
  cannot be drawn, a toast says why.
- A pane docks beside the transcript in a fullscreen terminal 110 columns wide or more,
  otherwise it opens above the prompt; the engine chooses.
- The path on the first line and any error wrap to the pane width.
- A reply that links to a markdown file is drawn by the plugin (the same renderer, the
  engine's frame around it). A reply that also holds a mermaid diagram is left to the
  mermaid feature, so its links are not clickable. This is rare and not planned.
- A link is drawn as the engine draws any link, so in a terminal that does not report
  hyperlink support it shows its target in parentheses after the label. A plugin cannot
  change that.
- One drawing takes 100000 characters, so a longer file is cut at 99000 (after tables are
  drawn, which can make them longer) and the pane says so.
- A file that cannot be read shows the reason in the pane (missing, over 4 MiB, no access).
- Files are read only when a link is clicked, and re-read when Claude writes the file on show.
  Nothing leaves the machine. A link can name any readable path, including outside the
  working directory.

## Not in this version

Links in replies that also hold a mermaid diagram, rendering images, links inside tool output, bare paths in
backticks, a list of recent files, following links between previewed files, and editing.

## Code

| File | Role |
|---|---|
| `hooks/features/markdown-preview/index.tsx` | metadata, the reply hook that answers links, the refresh on write, the pane hook |
| `hooks/features/markdown-preview/preview.ts` | link detection, path resolution, image and entity text, size and error helpers (pure) |
| `hooks/features/markdown-preview/tables.ts` | draws tables to the pane width (pure) |
| `hooks/features/markdown-preview/view.tsx` | the pane tree and the linked reply tree |
| `hooks/register.tsx` | the three `on(...)` lines |
