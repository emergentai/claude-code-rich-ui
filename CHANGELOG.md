# Changelog

Versions follow [`docs/dev/release-process.md`](docs/dev/release-process.md).

## Unreleased

### Added
- Attachment peek (experimental, on by default): a small tile above the prompt for each image you
  drop, showing the picture.

### Fixed
- `/rich-ui` pane: a click anywhere on a feature's row, its description included, toggles it (it was
  only the pill and name). In a pane that scrolls, such as the one above the prompt in a short window,
  the up and down arrows now move between features instead of scrolling the pane.

## 0.5.1 - 2026-10-26

### Fixed
- Welcome greeting: it no longer plays again when a session returns from the agents panel in a
  new process. ([#30](https://github.com/emergentai/claude-code-rich-ui/pull/30), closes
  [#26](https://github.com/emergentai/claude-code-rich-ui/issues/26))
- Preferences: a toggle or greeting edit no longer overwrites changes another session saved,
  and the markdown preview no longer jumps back to an earlier link when a slow read finishes
  late. ([#29](https://github.com/emergentai/claude-code-rich-ui/pull/29))
- Mermaid: a diagram too big for the window now shows its source with a dim
  "rich-ui: couldn't render, window too small" line instead of a bare code block.
  ([#31](https://github.com/emergentai/claude-code-rich-ui/pull/31))

## 0.5.0 - 2026-10-25

### Added
- Markdown preview: Claude is now told the preview is on, so it links the markdown files it
  writes and you can click to open them. Follows the feature's toggle in `/rich-ui`.
  ([#24](https://github.com/emergentai/claude-code-rich-ui/pull/24))

## 0.4.1 - 2026-10-25

### Fixed
- Welcome greeting: it now plays once, when the session opens, and no longer replays after
  `/clear` or a plugin reload. ([#22](https://github.com/emergentai/claude-code-rich-ui/pull/22))

## 0.4.0 - 2026-10-25

### Added
- Welcome greeting (experimental, on by default): a big orange "welcome" sweeps in above
  the prompt once per session and ends when you send a message. The word can be changed in
  `/rich-ui`. ([#16](https://github.com/emergentai/claude-code-rich-ui/pull/16))
- Zen spinner (experimental, on by default): the working row becomes one quiet line with a
  gliding highlight, the mode and the seconds, and the turn-end line a dim `3s`. ([#19](https://github.com/emergentai/claude-code-rich-ui/pull/19))
- Zen footer (experimental, off by default): a random zen saying replaces the hint line
  under the prompt, and the dim notices under the logo are hidden. ([#19](https://github.com/emergentai/claude-code-rich-ui/pull/19))
- `/rich-ui` lists experimental features under their own header. ([#16](https://github.com/emergentai/claude-code-rich-ui/pull/16))

### Changed
- `/rich-ui` is redrawn: a block-letter banner, `● on` / `○ off` switches, rows that
  lighten under the mouse, `error` / `note` tags and a footer pinned to the bottom of a
  docked pane. Keys are unchanged. ([#14](https://github.com/emergentai/claude-code-rich-ui/pull/14))
- `/rich-ui` descriptions are shorter and wrap to at most two lines instead of being cut off,
  Markdown preview is listed above Status band, the Welcome greeting text box no longer
  shows a "Text" label, and the Experimental header says "may be removed in a future version".

### Fixed
- Zen footer: the saying now changes only when a turn finishes, not on every redraw.

### Internal
- Docs: feature ideas note, calm mode spike and design, feature pages and manual tests.
  ([#14](https://github.com/emergentai/claude-code-rich-ui/pull/14), [#16](https://github.com/emergentai/claude-code-rich-ui/pull/16), [#19](https://github.com/emergentai/claude-code-rich-ui/pull/19))

## 0.3.0 - 2026-10-24

### Added
- Markdown preview: click a link to a markdown file in one of Claude's replies and the file
  opens, rendered, in a pane. Tables are fitted to the pane, images show as `[image: name]`,
  a long file is cut with a note, and the pane refreshes when Claude edits the file. Its own
  row in `/rich-ui`. ([#10](https://github.com/emergentai/claude-code-rich-ui/pull/10))

### Internal
- Docs: spikes for rendered tables, edit diffs, status band round two and the markdown
  preview, a feature page and a manual test fixture. ([#8](https://github.com/emergentai/claude-code-rich-ui/pull/8), [#9](https://github.com/emergentai/claude-code-rich-ui/pull/9), [#10](https://github.com/emergentai/claude-code-rich-ui/pull/10))

## 0.2.1 - 2026-10-24

### Fixed
- Mermaid: a very large flowchart no longer freezes the session. It is no longer drawn a
  second time sideways when it already overflows the window both ways, and drawn results
  are kept per window size instead of being recomputed on every redraw. ([#6](https://github.com/emergentai/claude-code-rich-ui/pull/6))

## 0.2.0 - 2026-10-24

### Added
- Status band: one line under the prompt showing context fullness and plan usage (5h, 7d,
  spend) only when they run high; cleared by `/clear`, switchable in `/rich-ui`. ([#1](https://github.com/emergentai/claude-code-rich-ui/pull/1))
- Mermaid: XY chart, pie, C4 and architecture diagrams are now drawn as text. ([#2](https://github.com/emergentai/claude-code-rich-ui/pull/2))

### Changed
- Mermaid: the diagram renderer is now `@zombie-mermaid/ascii-renderer` 5.9.1 instead of
  `beautiful-mermaid` 1.1.3, with better ER, class, sequence and subgraph layout. ([#2](https://github.com/emergentai/claude-code-rich-ui/pull/2))

### Fixed
- Mermaid: a `pie`, C4 or architecture fence with a header but no content stays a code
  block instead of drawing an empty diagram. ([#5](https://github.com/emergentai/claude-code-rich-ui/pull/5))

### Internal
- Docs: feature reference folder, release process, mermaid type research and manual test
  scripts for both features. ([#1](https://github.com/emergentai/claude-code-rich-ui/pull/1), [#2](https://github.com/emergentai/claude-code-rich-ui/pull/2))

## 0.1.0

Mermaid diagrams (flowchart, sequence, class, state, ER) drawn as text in replies, and the
`/rich-ui` pane to switch features on and off.
