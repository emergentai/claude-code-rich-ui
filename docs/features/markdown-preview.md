# Markdown preview

A pane that shows a markdown file rendered (headings, lists, tables, code, links) instead
of the plain numbered text Claude Code prints when Claude writes one. First slice: on
request only, no automatic opening.

- id `markdown-preview`, name "Markdown preview", `defaultEnabled: true`
- Toggle: its own row in `/rich-ui`. Off, `/preview` says so and no pane opens.
- Spike behind it: [`../dev/next-feature-spikes.md`](../dev/next-feature-spikes.md)

## Use

- `/preview <path>` opens the pane with that file. Quotes around the path are fine.
- `/preview` with no path shows the last markdown file Claude wrote or edited this session
  (`Write` or `Edit` on a `.md`, `.markdown` or `.mdx` file), or the file already on show.
- Run `/preview` again to reload a file that changed outside Claude.
- While a file is on show, Claude editing it refreshes the pane.
- Esc closes the pane. The pane scrolls with the wheel, and with the keys while it has
  focus (the engine's own pane behaviour).

## Behavior

- The text is drawn by the engine's `Markdown` element, the same renderer used for Claude's
  replies, so it follows the theme.
- A pane docks beside the transcript in a fullscreen terminal 110 columns or wider, and sits
  above the prompt otherwise; the engine chooses.
- One drawing takes 100000 characters, so a longer file is cut at 99000 and the pane says so.
- A file that cannot be read shows the reason in the pane (missing, over 4 MiB, no access).
- Nothing leaves the machine; files are read with the plugin file API only when asked for
  or when Claude writes a markdown file that is already on show.

## Not in this version

Opening automatically when Claude writes a file (the engine places an unasked pane only from
144 columns), a list of recent files, following links between files, editing, and anything
other than markdown.

## Code

| File | Role |
|---|---|
| `hooks/features/markdown-preview/index.tsx` | metadata, the `tool.call` tracker, `/preview`, the pane hook |
| `hooks/features/markdown-preview/preview.ts` | path, size and error helpers (pure) |
| `hooks/features/markdown-preview/view.tsx` | the pane tree |
| `hooks/manager/index.ts` | registers the `preview` command |
| `hooks/register.tsx` | the three `on(...)` lines |
