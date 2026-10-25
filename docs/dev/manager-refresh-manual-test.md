# Manager pane refresh: manual test

Run in a real terminal: `claude --plugin-dir <this worktree>`, then `/rich-ui`. The
automated tests cannot see colour, hover or the real placement. Note that toggling saves to
your real plugin store; turn everything back on at the end.

1. **Inline, 100 columns, 40+ rows.** Banner reads "rich-ui" with a gradient, `3 of 3 on`
   at the right, a divider, three rows with `● on`, the footer is visible as the last line.
2. **Keys.** The first row is highlighted (reverse video) on open. Enter turns it off: pill
   becomes `○ off`, summary `2 of 3 on`. Tab moves to the next row; Enter toggles; Esc closes.
3. **Mouse.** Click a row to toggle. Hover a row: its background lifts and the description
   brightens; moving away restores it. (Box hover with `subtle` background is unconfirmed:
   if nothing lifts, note it.)
4. **Narrow.** Resize to about 50 columns: banner still there, descriptions cut with `…`.
   Under about 35 columns: a bold `rich-ui` replaces the banner, rows are still pressable.
5. **Docked.** Fullscreen terminal 110+ columns: the pane docks, gutters look even on both
   sides, no row touches the dock edge, and the footer line is pinned to the bottom of the
   dock (blank space between the options and it). Shrink the terminal until the content no
   longer fits: the footer should then follow the options and the pane scroll, not clip.
6. **Light theme.** `claude --settings '{"theme":"light"}' --plugin-dir <worktree>`: banner
   legible on the light background, `○ off` readable, hover lift visible, text not washed out.
7. **Chip.** Ask Claude for a mermaid diagram in a terminal where it is left as code (or
   narrow the window): a `note` chip appears on the Mermaid row with its line below;
   toggling the row off and on clears it.
8. **Short terminal.** At 24 rows, check which line is cut (the footer is expected to go
   first) and that Enter/Esc still work.
9. **Feature off.** Turn each feature off then on: effects as before the refresh (diagram
   code only, band cleared, links stock).
10. Turn everything back on.
