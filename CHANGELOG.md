# Changelog

Versions follow [`docs/dev/release-process.md`](docs/dev/release-process.md).

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
