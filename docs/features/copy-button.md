# Copy code

A quiet `copy code` line under a reply that holds a fenced code block. Press it and the
block's source goes to the clipboard, with a short toast. Selecting code with the mouse in
a terminal is clumsy, and nearly every session has code blocks.

- id `copy-button`, name "Copy code", `defaultEnabled: true`
- Toggle: its own row in `/rich-ui`. Off, replies are drawn exactly as Claude Code draws them.

## Use

Under a reply with one copyable block the row reads `copy code`. With several, each block
has its own button in order, labelled by number and language: `copy 1 (ts)  copy 2 (bash)`.
Pressing one copies that block and shows a toast, `Copied 12 lines`, or
`Could not copy: <reason>` if the terminal took nothing. The row is dim, one line (it wraps
in a narrow window), and sits under the reply, indented past the bullet.

## Which blocks get a button

- Complete fenced blocks, with backticks or tildes, at the top level of the reply or
  indented under a list item.
- Skipped: a **one-line block** shorter than 61 characters (`npm install`; a triple click
  selects it), an **empty block**, any **mermaid** block, and a block inside a quote.
- An **unfinished fence** (the reply is still streaming, or the model never closed it)
  gets nothing, and neither does anything after it. Earlier finished blocks keep theirs.
- A **summary** row (`isSummary`) is left alone; it stands for text the model wrote, not the
  code.
- At most 12 buttons per reply row; later blocks have none.
- A longer fence holds shorter fences as source: a ````markdown block that contains a
  ```ts block is one block, and copies with the inner fence lines.

## What is copied

The text between the fence lines, as the model wrote it, with the fence's own indent taken
off every line (a block under a list item pastes flush left). Blank lines at the start and
end are dropped, inner blank lines and trailing spaces are kept, Windows line endings become
`\n`, and there is **no trailing newline**, so pasting into a shell never runs the command by
itself.

## How it composes (design)

The reply is one `Markdown` element drawn by the engine, so the button cannot sit between
the code and the next paragraph without splitting the text into segments, which changes the
engine's frame (spacing, wrapping). Instead the hook wraps `next(e)` and puts one row after
the result:

```
<Box column>
  {await next(e)}        whatever the plugins beneath and the engine drew
  <row marginLeft=2>…</row>
</Box>
```

Order matters. Hooks run first-registered outermost, and mermaid and the markdown preview
answer without calling `next` when they draw a reply. So `renderCopyRow` is registered
**before** them in `hooks/register.tsx`; it sees their tree as the result and adds its row
to it. Registered after them, it would never run on those replies (tests for both pairings
fail in that order, checked).

- **Mermaid:** the diagram, its `show source` / `show diagram` toggle and its fallback code
  are untouched. Mermaid fences are never given a button (so their source is never offered
  twice); other blocks in the same reply are.
- **Markdown preview:** links in the reply keep answering a click; the row is added below.
  (A reply with both a mermaid fence and a preview link is left to mermaid, as before, and
  its non-mermaid blocks still get buttons.)
- **Engine:** the engine's reply is the unchanged inner child.

## Surface

Terminal only. Other surfaces (desktop, VS Code, mobile) return `next(e)` unchanged; they
draw their own code blocks. `$.ui.copy` is called with the surface of the press, which is
the terminal; OSC 52 does not report back, so a terminal that drops the write still reports
success.

## Not in this version

A `copy all` button, per-block hover buttons beside the code, blocks inside quotes, copying
tool output or file contents, and a threshold setting.

## Code

| File | Role |
|---|---|
| `hooks/features/copy-button/blocks.ts` | finds the fenced blocks, builds the copied text, labels (pure) |
| `hooks/features/copy-button/view.tsx` | the wrapper and the copy row |
| `hooks/features/copy-button/index.tsx` | metadata, the gate, the press that copies and toasts |
| `hooks/register.tsx` | one `on(...)` line, before mermaid's |
