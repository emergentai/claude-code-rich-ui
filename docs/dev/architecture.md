# rich-ui: Plugin Architecture

Status: draft for review. Companion docs: `PRODUCT_CHARTER.md` (what and why) and `FEATURES.md` (what ships and what is planned), and, to follow, the mermaid feature, manager pane and README docs.

## 1. Goals and non-goals

Goals:
- One Claude Code mod (`rich-ui`) containing many independently toggleable features.
- Toggling is instant, persists across sessions, and one feature can never break another.
- A new feature is added by dropping a folder in and listing it in one place.

Non-goals for v1: runtime extension by third parties, non-terminal surfaces (desktop, VS Code, mobile), telemetry, CI (decided later).

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Surfaces | Terminal only |
| Toggle storage | Persisted in `$.store`, mirrored into `$.state` for drawing |
| Toggle UI | `/rich-ui` pane only (no `/config` rows) |
| Defaults | Each feature declares its own `defaultEnabled` |
| Gating | Every feature hook checks its feature's flag on each call, inline (see 4.3) |
| Failures and notes | A failing feature is skipped; its error, and any note a feature posts about itself, is shown only inside the `/rich-ui` pane |
| Language | TypeScript, tested with `claude plugin test`, type-checked with `tsc` |
| Repo root | The repo root is the plugin |
| Feature set | Closed: features live in this repo |
| API drift | State a minimum tested Claude Code version in the README; no runtime check |
| Name | Plugin `rich-ui`, repo `claude-code-rich-ui`, org `emergentai` |
| Distribution | The repo is its own marketplace, named `claude-code-rich-ui` (see section 8) |

## 3. Repository layout

```
claude-code-rich-ui/
  .claude-plugin/
    plugin.json              # name "rich-ui", version, "types" pointer
    marketplace.json         # name "claude-code-rich-ui", one entry, source "./"
  hooks/
    hooks.json               # { "modules": ["./register.tsx"] }
    register.tsx             # entry: one literal on(...) line per hook
    core/
      feature.ts             # Feature metadata type
      registry.ts            # the list of shipped features (for the pane)
      gate.ts                # isOn (effective flag) and guard (contain a throw)
      prefs.ts               # parse/serialize/toggle the saved choices (pure)
      errors.ts              # pure helpers over the per-feature status map
      version.ts             # plugin version string (checked by tools/check-version.mjs)
    manager/                 # the /rich-ui command and pane (always on, not a feature)
    features/
      mermaid/               # first feature (see its own doc)
    vendor/                  # committed third-party bundles
  tools/                     # dev tooling only; never needed by an installed plugin
    package.json             # devDependencies (esbuild, typescript, beautiful-mermaid)
    build-vendor.mjs         # reproducible rebuild of hooks/vendor/*
    check-version.mjs        # version.ts must match plugin.json
    ui-capture.sh            # captures native vs mod rendering in tmux
  types/
    index.d.ts               # PluginState contract
  docs/
  tsconfig.json
  README.md
```

Rules:
- Tests sit beside the code they cover (`*.test.ts` / `*.test.tsx`).
- The engine writes `.claude-plugin/types/` for editors; it is ignored by git.
- The module imports only its own files by relative path and `claude-code`. Third-party code reaches the plugin only through `hooks/vendor/`, one bundle per file and under 1,048,576 bytes each (an engine limit found during the mermaid spike).

## 4. Core pieces

### 4.0 What the engine's module scan forces

`claude plugin validate` and the loader scan the hooks module and every file it imports, and refuse the module when:
- `on` is anything but a literal `on("<event>", [matcher,] hook)` call, with the hook a function literal or the name of an exported `const` arrow. `on` cannot be wrapped, passed to a function, or called in a loop.
- `$` is passed as an argument anywhere (the `read`/`update`/`atom` library functions from `claude-code` are the exception). So no helper takes `$`; `$.noun.event(...)` is written where it is used.
- A state source is not written in the file that reads or writes it (`read($, atom)` needs the `atom(...)` const in that same file), so atoms are declared per file.
- An event has two unmatched `on` hooks (so one `session.start` handler does all start-up work).

Everything below follows from these rules. This replaces the earlier design, in which `register(on, ctx)` handed each feature a gated `on`.

### 4.1 Feature contract

```ts
type Feature = {
  id: string                 // stable, kebab-case, the storage key
  name: string               // shown in the pane
  description: string        // one line, shown in the pane
  defaultEnabled: boolean
}
```

A feature is its metadata plus the hook handlers it exports (for example `mermaid` and `renderAssistantMessage` in `hooks/features/mermaid/index.ts`). Handlers are `const` arrow functions typed with `Hook` or `MatchedHook`. They never see `on`.

### 4.2 Registry and wiring

`register.tsx` has one literal `on(...)` line per hook, naming the exported handler. `registry.ts` is the ordered list of `Feature` metadata that the pane draws. Adding a feature means: a folder under `hooks/features/`, an entry in `registry.ts`, and one `on` line per hook in `register.tsx`. A handler cannot fail at load time (it is just a function), so the earlier load-failure recording is not needed; a handler that throws is contained by `guard` (4.3).

### 4.3 The gate

There is no wrapper, because `on` cannot be wrapped. Each feature handler starts with the same inline pattern:
1. `if (!isOn(await read($, enabledAtom), feature)) return next(e)` where `isOn` is `enabled[id] ?? defaultEnabled`.
2. Do the work inside `guard(run, () => next(e), reportError)`. `guard` is pure: it runs `run`, and on a throw calls `reportError` and returns the fallback, so the rest of Claude Code behaves as if the feature were absent. (`next(e)` after a hook that already called `next` replays that call's result.)
3. `reportError` and `postNote` are small closures written in the handler: they call `$.clock.after(0, ...)` and then `update($, statusAtom, map => withError(...))`. The write is deferred because the engine refuses state writes while a `ui.render` hook draws.

View code never receives `$`: the handler resolves the elements (`$.ui.resolve(e)`), reads the state it needs, and passes plain data plus callbacks to a pure `buildReply` / `buildPane` function.

v1 features use non-streaming hooks (`ui.render`, `session.start`). Streaming hooks are out of scope until a feature needs them.

### 4.4 State and persistence

Two layers, one rule: `$.store` is the source of truth across sessions, `$.state` is what hooks and the pane read.
- `$.store` key `prefs` holds `{ enabled: Record<featureId, boolean> }`.
- `$.state` holds an `enabled` atom (the same map) and a `status` atom (errors and notes, 4.5).
- On `session.start` the plugin loads `$.store` into the `enabled` atom, which holds only explicit choices. A feature's flag is `enabled[id] ?? defaultEnabled`, so adding a feature later never flips anyone's existing choices and a missing or unreadable store simply means defaults.
- A toggle (the pane row's `onPress`, written inline in the manager's render handler) writes `$.state`, clears the feature's status entry and writes `$.store`. Writing `$.state` redraws the pane and every reader automatically.
- If the `$.store` write fails, `$.state` stays as toggled so the choice holds for the session, and a `saveFailed` flag in `$.state` is set for the manager's footer (cleared by the next successful save).
- Stored shapes use `Shaped` tags (`prefs-1`) so a future change of shape is declined and re-defaulted rather than misread after a reload.
- Per the official docs, uninstalling from the last scope deletes the plugin's data folder and stored options unless `--keep-data` is passed (shell form only). Whether `$.store` lives there is unverified (section 9); we do not rely on preferences surviving uninstall, and a missing store simply hydrates every feature to its `defaultEnabled`.

### 4.5 Feature status: errors and notes

`errors.ts` keeps, per feature id, a status entry in the session-scoped `status` atom. An entry is either an error (the last message, a count and a timestamp, recorded by the gate when a hook throws) or a note (a short text a feature posts about itself, for example the mermaid feature's "Diagrams left as code: terminal size unknown").

Both are shown only in the `/rich-ui` pane: a dim line under the affected feature's row while the entry stands. Nothing is toasted, logged to the transcript, or put in the status line. An entry is cleared when the user toggles that feature off and on, or when the session restarts. The engine's debug log still receives failures as usual.

Consequence to accept: a user who never opens the pane will not see that a feature failed or fell back; the feature simply behaves as if off or as the engine would.

### 4.6 Manager

`hooks/manager/` registers the `/rich-ui` command and draws the pane. It is core, not a feature: it has no toggle and is always present. Pane behavior and layout are specified in the manager pane doc.

### 4.7 Diagram renderer seam (reserved for the mermaid feature)

The mermaid feature talks to rendering through one small interface returning either text lines or an image with its size and `alt`, with the text renderer as the default backend and results cached by source hash. This lets image and raster backends be added later without touching detection or layout code. Detail belongs in the mermaid doc.

## 5. Data and event flow

Session start: `register` lists every hook; the single `session.start` handler loads the saved choices from `$.store` and registers `/rich-ui`.

Normal event: engine event, then the feature's handler, which checks its flag: off passes the event through, on runs the work; a throw is recorded and the event continues.

Toggle: user presses a row in the pane, then `$.store` and `$.state` are written, the pane redraws, and the next event sees the new flag. Output already on screen is not redrawn.

## 6. Testing strategy

- `claude plugin validate .` and `tsc -p .` must pass before any commit.
- Core (pure helpers, unit-tested): `isOn` and `guard`; status helpers; saved-choice parse, serialize and toggle. Wired plugin (tests boot it under the kit with an in-memory store and clock): flag off passes through; flag on runs; a posted note is recorded and cleared by a toggle; defaults hydrate for unknown ids; a stored value of an older shape is declined; a failed `$.store` write keeps the toggle and sets `saveFailed`.
- Tests: the kit's `$` has no `clock`, `store` or `state`, so stateful behavior is tested through the mounted plugin, and the harness (`hooks/core/test-harness.ts`) answers the clock, the store and the engine's drawing beneath it.
- Every UI test mounts on the terminal surface only (the supported surface).
- Each feature owns its own tests; the mermaid feature's are specified in its doc.

## 7. Development workflow

- Run the working copy with `claude --plugin-dir .`; the engine hot-reloads it at turn boundaries.
- Dev tooling lives in `tools/`, not at the repo root: when Claude Code installs a plugin it runs `npm install` if the plugin's root has a `package.json` with dependencies, which put 51 MB of esbuild, TypeScript and the renderer source on every user's machine (measured: 57 MB installed against 5.4 MB). Run `npm install` once in `tools/`, then `npm run build:vendor`, `check:version`, `typecheck`, `test` and `validate` from there. Never add a `package.json` to the repo root.
- Rebuild vendored bundles with `npm run build:vendor` in `tools/`; the script pins exact versions and its output is committed so installs from GitHub need no build.
- Re-run validate, type-check and tests after every Claude Code upgrade, since the mods API is early access.

## 8. Distribution and compatibility

- Distribution model: the repo is its own marketplace (decided after comparing a shared org-wide marketplace repo, direct `--plugin-dir` use and the official directory). `.claude-plugin/plugin.json` names the plugin `rich-ui`; `.claude-plugin/marketplace.json` has marketplace `name` `claude-code-rich-ui` and one entry, `rich-ui`, with source `./`.
- Why the marketplace is named `claude-code-rich-ui` and not `emergentai`: if an org-wide `emergentai` marketplace is ever created, a second marketplace with the same name from a different source would clash. The one-step install never shows the name, so a longer one costs users nothing.
- Install: `/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui` (official docs: valid in a session from Claude Code 2.1.275; the shell form `claude plugin install ... --marketplace ...` from 2.1.292). The documented two-step alternative is `/plugin marketplace add emergentai/claude-code-rich-ui` then `/plugin install rich-ui@claude-code-rich-ui`.
- Auto-update is per marketplace and off by default for non-official ones. The README and `docs/usage.md` tell users how to turn it on (`/plugin`, Marketplaces tab). Every release sets or bumps `version` in `plugin.json`; if it is omitted the commit SHA is the version and every commit becomes an update.
- Marketplace names are limited to letters, digits, `.`, `_`, `-`, and some names are reserved; `claude-code-rich-ui` is expected to be valid, confirmed with `claude plugin validate` (use `--strict` when CI exists).
- Later options, not v1: list the plugin in Anthropic's official directory (needs a paid claude.ai plan and a review per version), or move to an org-wide marketplace repo if a second plugin appears.
- Uninstall: `/plugin uninstall rich-ui`. The marketplace stays added until removed separately.
- Official docs: mods are on by default from Claude Code 2.1.287 in the terminal. The README states that as the minimum and the exact version we tested against, recorded at release.

## 9. Open items

1. Mostly closed: `$.store` is `~/.claude/plugins/store/rich-ui_<source>-<hash>.json`, outside the plugin data folder the docs say an uninstall deletes, so saved choices likely survive uninstall (unproven; see `verification-notes.md` item 8). The README and usage page say so.
2. Closed: the `claude plugin test` kit has no `$.store`, `$.state` or `$.clock` on the test's `$`; stateful behavior is tested through the mounted plugin with an in-memory store and clock supplied by the harness (section 6).
3. Closed: a wrapper is impossible, see 4.0.
4. Closed: `plugin.json` names `"types": "./types/index.d.ts"` (the contract must export only types), and `hooks/hooks.json` is `{ "modules": ["./register.tsx"] }`; `claude plugin validate` accepts both. No minimum-version field is used; the README states the minimum.
5. Closed: `/rich-ui` opens the pane at any width when run explicitly (the narrow inline and the wide docked layouts were both seen).
