# Attachment peek (experimental)

When you drop or paste an image into the prompt Claude Code shows only a tag, `[Image #3]`. This feature
shows what it is: a small **tile** for each, above the prompt, with the picture and one line of caption.
Nothing to press. Long text pastes (`[Pasted text #4 +12 lines]`) are not covered. Experimental: it may be
removed in any future version.

- id `attachment-peek`, name "Attachment peek", `defaultEnabled: true`, `isExperimental: true`
- Toggle: its own row in `/rich-ui`, under **Experimental**. Off, nothing is drawn, read or run.
- Terminal surface only. macOS and Linux; Windows is left alone.

## What you see

```
╭──────────────────────────────╮ ╭────────────────────╮
│ (the picture, drawn)         │ │ (the picture)      │
│ #1                           │ │ #2                 │
╰──────────────────────────────╯ ╰────────────────────╯
❯ [Image #1] [Image #2]
```

- A tile per tag in the draft, in draft order, a quarter of a second after the drop at most, top-aligned,
  each as wide as its picture or caption. Delete the tag, send the prompt, or clear the box and its tile
  goes. A `+N` counts the tiles that do not fit across.
- The tiles go the moment the prompt is sent (a `prompt.submit` hook), not at the next read of the draft.
  They just disappear: shrinking them a row at a time, and fading them in place, were both tried and
  looked worse (the first pulled the transcript down row by row, the second only drew the jump out).
- A tile is captioned with its tag's number (the original file's name is not known before the prompt is sent).
- The picture is drawn where Claude Code draws pictures: kitty, Ghostty (so cmux), and iTerm2 3.5+ under
  fullscreen rendering. Anywhere else (tmux, screen, Terminal.app) there is no tile: the tag in the prompt is all you get.
  Claude Code does not say whether a terminal draws pictures, so the mod guesses from the terminal's name;
  `RICH_UI_PEEK_IMAGES=1` (or `0`), set where you start Claude Code, overrides the guess.

## How it finds things

Claude Code does not hand a mod the bytes of a drop, and a drop raises no edit event; this leans
on three of its habits, none of which is an API:

1. **The draft is read every 250 ms** (`$.prompt.read`), and the tags are taken out of it:
   `[Image #N]`.
2. **An image** is saved by Claude Code, before you send, as
   `<tmp>/claude-<uid>/<project>/<session>/images/<N>.<ext>`, `<tmp>` being `/tmp` on macOS and `$TMPDIR`
   or `/tmp` on Linux, or `CLAUDE_CODE_TMPDIR`. The mod finds that file by number (the project folder is
   the working directory with every other character made a dash; failing that every folder of the root is
   looked in). The terminal draws PNG alone, so on macOS `sips` makes a 400 px PNG of it, written beside
   the images as `rich-ui-peek-<N>.png` in the session's own folder under the temp directory (a folder
   only you can read, which the system clears). The picture goes to the terminal as bytes (a path would
   not draw in tmux or iTerm2). Elsewhere a PNG is drawn as it is when small enough.

What it reads and runs, all of it local: the prompt draft; Claude Code's temp folder to find the session's
pictures (and each one's size, through `sips`); `uname -s` and
`id -u` once; and a few variables (`TERM`, `TERM_PROGRAM`, `LC_TERMINAL`, `TMUX`, `STY`, `KITTY_WINDOW_ID`,
`GHOSTTY_RESOURCES_DIR`, `CLAUDE_CODE_FORCE_TERMINAL_IMAGES`, `CLAUDE_CODE_SESSION_KIND`,
`RICH_UI_PEEK_IMAGES`, `CLAUDE_CODE_TMPDIR`, `TMPDIR`, `OS`). `claude plugin validate .`
lists every call.

## What was tried and dropped

Hover cards (a card cannot leave the band, so it cost a round trip and a band that jumped, and did nothing
without fullscreen rendering) and a preview button (Quick Look): more than a picture needs.

Text pastes: a tile with the first lines, and the first line painted after the tag in the prompt box. Both
needed the clipboard, which only matches the paste if nothing else was copied in between, so a wrong
snippet was possible. Dropped.

## Limits

- A tag recalled from the history, or one an earlier session left, is read as an image of this session
  if the number exists here. Claude Code reuses numbers only within a session, so this is rare.
- A band collapsed with `[-]` (or ctrl+x ctrl+a) shows no tiles, as for any mod.

## Code

`hooks/features/attachment-peek/`: `index.tsx` (the timer, finding and reading, the band), `peek.ts` (tags,
sizes, captions, pure), `platform.ts` (what differs per system, pure). The one `session.start`
hook, in `hooks/manager/index.ts`, starts the timer. State: `rich-ui.peek-view`. Tested by
`claude plugin test .` and, for the real thing, in tmux: paste a file path (which is what a drop is) with
`tmux paste-buffer -p` and read the screen.
