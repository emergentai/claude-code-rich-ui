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

## Behavior and limits

- **Fullscreen terminal only.** The engine reports a link click to a plugin only where it
  reports clicks, which is the fullscreen terminal. On the main screen a click does nothing
  new and the link is whatever the terminal makes of it.
- The text is drawn by the engine's `Markdown` element, the renderer used for Claude's
  replies, so it follows the theme.
- A pane docks beside the transcript in a fullscreen terminal 110 columns wide or more; the
  engine chooses the layout.
- A reply that links to a markdown file is drawn by the plugin (the same renderer, the
  engine's frame around it). A reply that also holds a mermaid diagram is left to the
  mermaid feature, so its links are not clickable yet.
- One drawing takes 100000 characters, so a longer file is cut at 99000 and the pane says so.
- A file that cannot be read shows the reason in the pane (missing, over 4 MiB, no access).
- Files are read only when a link is clicked, and re-read when Claude writes the file on show.
  Nothing leaves the machine.

## Not in this version

Links in replies that also hold a mermaid diagram, links inside tool output, bare paths in
backticks, a list of recent files, following links between previewed files, and editing.

## Code

| File | Role |
|---|---|
| `hooks/features/markdown-preview/index.tsx` | metadata, the reply hook that answers links, the refresh on write, the pane hook |
| `hooks/features/markdown-preview/preview.ts` | link detection, path resolution, size and error helpers (pure) |
| `hooks/features/markdown-preview/view.tsx` | the pane tree and the linked reply tree |
| `hooks/register.tsx` | the three `on(...)` lines |
