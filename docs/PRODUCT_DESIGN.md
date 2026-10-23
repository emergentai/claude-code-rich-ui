# claude-code-rich-ui — Product Design

## 1. Summary

`claude-code-rich-ui` is a **mod** (a Claude Code plugin) that ships a curated
collection of **features** — small, independently-toggleable enhancements
built on Claude Code's native mods/hooks system — that make Claude Code's
output richer and easier to read, without adding noise.

The mod itself does not render anything by its mere presence. It is a
**distribution and control layer**: it bundles a set of features, lets the
user turn each one on or off, and makes install/uninstall trivial. It is built
the way Claude Code's own mod system expects (`.claude-plugin/plugin.json`,
`hooks/hooks.json`, a `register.tsx` hooks module, and an optional
`$.state` contract).

## 2. Guiding Principles

1. **UX-positive only.** A feature ships only if it improves the experience in
   the large majority of sessions. Rendering a mermaid diagram clears this bar
   easily. A feature that adds detail/clutter "sometimes useful" (e.g. verbose
   Bash command inspection) does not — users are already fighting AI noise;
   we should not add to it by default.
2. **Modularity.** Every feature is independently on/off. Disabling one
   feature must never affect another. No feature may silently depend on
   another being enabled.
3. **Ease of use.** From the GitHub README, to docs, to
   `/plugin install`, to toggling a feature, to uninstalling — every step
   should be a single obvious action with no configuration file editing
   required for the common case.

## 3. Architecture

### 3.1 One mod, many features

`claude-code-rich-ui` is a single Claude Code plugin (mod). One install, one
uninstall. Features live inside it as separate hook modules, each
independently toggleable at runtime — no per-feature plugin management for
the user.

The full directory layout, feature contract and state design are in
`docs/dev/architecture.md`; where this document and the dev docs under
`docs/dev/` differ, the dev docs win. In short: one `hooks.json`, one entry
module that registers every feature from a registry, and one folder per
feature under `hooks/features/`.

Every feature module hooks the same events (`ui.render`, `tool.call`, etc.) it
would if it were its own plugin — splitting features into separate plugins
was never required for isolation, since each feature's hooks are already
independent functions. Packaging as one mod means one `plugin.json`, one
`hooks.json`, one install step.

### 3.2 What a feature actually is

A feature is a self-contained folder (e.g. `hooks/features/mermaid/`) that
exports a feature object with its metadata and a `register` function adding
its `on(event, matcher, hook)` hooks. The entry module registers every feature
from a registry. Every hook a feature adds goes through a shared gate that
checks the feature's enabled/disabled flag and short-circuits (`next(e)`
unchanged) when off. Features never reach outside `$` and never import from
each other — one feature's code changing or breaking cannot affect another's
behavior.

### 3.3 The control surface: `/rich-ui` pane

`/rich-ui`, no arguments. Opens a pane (`$.ui.open`) listing every feature
with a toggle next to it — click/select to flip a feature on or off right
there, no subcommands or flags to remember or mistype.

Pane state: one row per feature (name, one-line description, on/off toggle),
backed by the same per-feature flag that the hooks check. Toggling in the pane
writes the flag, remembers it across sessions, and needs no reload: it takes
effect at the next hook invocation, for new output only. Details are in
`docs/dev/manager-pane.md`.

A disabled feature's module is still loaded (negligible cost) but produces
zero observable behavior change — no rendering, no status line entries,
nothing added to the system prompt.

### 3.4 Install / uninstall UX

- **Install:** `/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui`
  — one command (confirm adding the marketplace, then pick a scope). All
  features are available; each starts on or off according to its own default.
- **Uninstall:** `/plugin uninstall rich-ui` — one command that removes the
  plugin. Claude Code deletes a plugin's saved data on uninstall by default
  (the shell form accepts `--keep-data`), so the remembered on/off choices are
  expected to go with it; this is verified before release (see
  `docs/dev/readme.md`).
- No per-feature install/uninstall. Users who want fewer features use the
  `/rich-ui` pane, not plugin management.

The GitHub README is the landing page: one sentence of pitch, one GIF/example
of a mermaid diagram rendering inline, one install command, one line on how to
open the toggle pane, one line on how to uninstall. Anything more belongs in
`docs/`.

## 4. v1 Feature: Mermaid Diagram Rendering

**What it does:** When Claude's reply contains a complete fenced
` ```mermaid ` code block, the feature draws it as a text diagram (box-drawing
characters) via `ui.render` instead of leaving it as raw code the user has to
mentally parse or copy elsewhere. One press under the diagram swaps it for the
original source and back.

**Why this is the anchor feature:** It's the clearest, least controversial
instance of principle #1 — it is strictly additive (raw text is still there
conceptually; we're just presenting it better) and nearly nobody is worse off
seeing a diagram instead of mermaid source.

**Scope for v1:**
- Detect complete top-level mermaid fences in assistant replies, on the
  terminal surface only.
- Draw flowchart, sequence, state, class and ER diagrams as text; anything
  else, anything that does not fit the window, and any unfinished fence stays
  a normal code block.
- Off switch via the `/rich-ui` pane — when off, blocks render as plain text
  exactly as Claude Code would without the mod.
- No network calls, no external services, no stored diagrams — pure local
  rendering of content already present in the transcript.

**Explicit non-goals for v1:** image-quality diagrams (planned as a follow-up),
mermaid in files Claude writes or reads, editing diagrams, exporting,
diagram history/gallery, non-mermaid diagram languages (e.g. PlantUML) — all
future work. Full design: `docs/dev/mermaid-feature.md`.

## 5. Backlog of Future Feature Candidates

(Not committed, listed to validate the architecture generalizes; each would
be its own feature module, each independently toggleable)

- **Rendered tables.** Render markdown/JSON/CSV tables as aligned grids
  instead of wrapped text.
- **Markdown preview pane.** Specs, plans and READMEs Claude writes render as
  formatted docs in a pane beside the chat.
- **Context bar.** Thin stacked bar above the prompt showing how full the
  context window is.
- **Inline edit diffs.** Compact colored diff shown after each `Edit`/`Write`,
  complementing the built-in `/diff` pane.

Each candidate must pass principle #1 before being added — "does this improve
UX in the large majority of sessions, not just some."

## 6. Success Criteria

- A new user can go from README to a rendered mermaid diagram in under two
  minutes, copying at most two commands.
- Disabling any single feature produces zero change in any other feature's
  behavior.
- Uninstalling the mod leaves no files or config the user must manually clean
  up.
