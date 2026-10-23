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

```
claude-code-rich-ui/
  .claude-plugin/
    plugin.json
  hooks/
    hooks.json                 # lists every feature module, loaded together
    register.tsx               # registers /rich-ui command + loads feature modules
    features/
      mermaid.tsx
      diff-view.tsx             # future
      ...
  docs/
  README.md
```

Every feature module hooks the same events (`ui.render`, `tool.call`, etc.) it
would if it were its own plugin — splitting features into separate plugins
was never required for isolation, since each feature's hooks are already
independent functions. Packaging as one mod means one `plugin.json`, one
`hooks.json`, one install step.

### 3.2 What a feature actually is

A feature is a self-contained hook module (e.g. `hooks/features/mermaid.tsx`)
that exports its `on(event, matcher, hook)` registrations. `register.tsx`
imports every feature module and wires them up. Each feature reads a shared
`$.state`-backed enabled/disabled flag at the top of its handler and
short-circuits (`next(e)` unchanged) when off. Features never reach outside
`$` and never import from each other — one feature's code changing or
breaking cannot affect another's behavior.

### 3.3 The control surface: `/rich-ui` pane

`/rich-ui`, no arguments. Opens a pane (`$.ui.open`) listing every feature
with a toggle next to it — click/select to flip a feature on or off right
there, no subcommands or flags to remember or mistype.

Pane state: one row per feature (name, one-line description, on/off toggle),
backed by the same `$.state` flag per feature name that the hooks check.
Toggling in the pane writes the flag directly; no reload, takes effect at the
next hook invocation.

A disabled feature's module is still loaded (negligible cost) but produces
zero observable behavior change — no rendering, no status line entries,
nothing added to the system prompt.

### 3.4 Install / uninstall UX

- **Install:** `/plugin marketplace add <org>/claude-code-rich-ui` then
  `/plugin install rich-ui@<org>` — two commands, done, all features available
  (default set enabled, see §4 scope).
- **Uninstall:** `/plugin uninstall rich-ui@<org>` — one command, removes
  everything, no residual config/state left for the user to hunt down.
- No per-feature install/uninstall. Users who want fewer features use the
  `/rich-ui` pane, not plugin management.

The GitHub README is the landing page: one sentence of pitch, one GIF/example
of a mermaid diagram rendering inline, one install command, one line on how to
open the toggle pane, one line on how to uninstall. Anything more belongs in
`docs/`.

## 4. v1 Feature: Mermaid Diagram Rendering

**What it does:** When a tool result (e.g. a file write, a `Read`, or model
output) contains a fenced ` ```mermaid ` code block, the feature renders it as
an actual diagram via `ui.render` instead of leaving it as raw text the user
has to mentally parse or copy elsewhere.

**Why this is the anchor feature:** It's the clearest, least controversial
instance of principle #1 — it is strictly additive (raw text is still there
conceptually; we're just presenting it better) and nearly nobody is worse off
seeing a diagram instead of mermaid source.

**Scope for v1:**
- Detect fenced mermaid blocks in relevant tool-call results.
- Render via `ui.render` (pane or inline, inline preferred if the platform
  supports it at the point the block appears, falling back to a pane for
  surfaces that need it).
- Off switch via the `/rich-ui` pane — when off, blocks render as plain text
  exactly as Claude Code would without the mod.
- No persistence, no network calls, no external services — pure local
  rendering of content already present in the transcript.

**Explicit non-goals for v1:** editing diagrams, exporting images, diagram
history/gallery, non-mermaid diagram languages (e.g. PlantUML) — all future
feature candidates, not v1 scope.

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
- Uninstalling the mod leaves no orphaned state/config the user must manually
  clean up.
