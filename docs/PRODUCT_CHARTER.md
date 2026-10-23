# claude-code-rich-ui — Product Charter

This is the document that guides every future decision about rich-ui: what it is
(summary), what it will and will not do (principles), how it is shaped
(architecture) and how we know it works (success criteria). What ships and what
is planned lives in [`FEATURES.md`](FEATURES.md); how it is built lives in
`docs/dev/`.

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
exports its metadata and the hook handlers it needs. The entry module lists
every feature's hooks in one place and a registry lists the metadata the pane
shows. Every handler a feature exports checks the feature's enabled/disabled
flag first and short-circuits (`next(e)` unchanged) when off, and contains its
own failures. Features never import from each other — one feature's code
changing or breaking cannot affect another's behavior. (The exact wiring is
dictated by the engine's module rules; see `docs/dev/architecture.md` 4.0.)

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

## 4. Features and backlog

What ships today, what is planned and what was rejected lives in
[`FEATURES.md`](FEATURES.md). It changes often; this document does not. Every
entry there has to pass the principles above, principle 1 first.

## 5. Success Criteria

- A new user can go from README to a rendered mermaid diagram in under two
  minutes, copying at most two commands.
- Disabling any single feature produces zero change in any other feature's
  behavior.
- Uninstalling the mod leaves no files or config the user must manually clean
  up.
