# rich-ui: Plugin Architecture

Status: draft for review. Companion docs: `PRODUCT_DESIGN.md` (what and why), and, to follow, the mermaid feature, manager pane and README docs.

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
| Gating | Every hook checks its feature's flag on each call |
| Failures | A failing feature is skipped; the error is shown only inside the `/rich-ui` pane |
| Language | TypeScript, tested with `claude plugin test`, type-checked with `tsc` |
| Repo root | The repo root is the plugin |
| Feature set | Closed: features live in this repo |
| API drift | State a minimum tested Claude Code version in the README; no runtime check |
| Name | Plugin `rich-ui`, repo `claude-code-rich-ui`, org `emergentai` |

## 3. Repository layout

```
claude-code-rich-ui/
  .claude-plugin/
    plugin.json              # name "rich-ui", version, "types" pointer
    marketplace.json         # one entry, source "./"
  hooks/
    hooks.json               # { "modules": ["./register.tsx"] }
    register.tsx             # entry: builds the registry, registers all features
    core/
      feature.ts             # Feature and FeatureContext types
      registry.ts            # the list of shipped features
      gate.ts                # gated `on` wrapper (flag check, error capture)
      prefs.ts               # load/save toggle state ($.store <-> $.state)
      errors.ts              # per-feature status: errors and notes (session scoped)
    manager/                 # the /rich-ui command and pane (always on, not a feature)
    features/
      mermaid/               # first feature (see its own doc)
    vendor/                  # committed third-party bundles
  scripts/
    build-vendor.mjs         # reproducible rebuild of hooks/vendor/*
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

### 4.1 Feature contract

```ts
type Feature = {
  id: string                 // stable, kebab-case, the storage key
  name: string               // shown in the pane
  description: string        // one line, shown in the pane
  defaultEnabled: boolean
  register: (on: GatedOn, ctx: FeatureContext) => void
}
```

`register` receives a gated version of `on`, so a feature author cannot forget the flag check. `FeatureContext` carries the feature's own `id` and a `postNote(text)` function that records a status note for the pane (4.5); it exists so later needs (shared helpers, logging) do not change the signature.

### 4.2 Registry

`registry.ts` exports the ordered array of shipped features. `register.tsx` loops over it and calls each `feature.register` inside its own try/catch, so a feature that throws at load time cannot stop the others or the manager from loading. A load-time throw is recorded exactly like a hook failure (4.5).

### 4.3 Gated `on`

`gate.ts` wraps each hook a feature adds:
1. Read the feature's flag from `$.state`. If off, return `next(e)` unchanged.
2. If on, run the hook.
3. Attach the engine's `.catch` handler: record the error against the feature id (4.5), then continue with `next(e)` so the rest of Claude Code behaves as if the feature were absent.

v1 features use non-streaming hooks (`ui.render`, `session.start`). Streaming hooks (`turn.step`, `process.spawn`) need a generator form of the wrapper; it is out of scope until a feature needs it.

### 4.4 State and persistence

Two layers, one rule: `$.store` is the source of truth across sessions, `$.state` is what hooks and the pane read.
- `$.store` key `prefs` holds `{ enabled: Record<featureId, boolean> }`.
- `$.state` holds an `enabled` atom (the same map) and a `status` atom (errors and notes, 4.5).
- On `session.start` the plugin hydrates `$.state` from `$.store`. A feature id missing from the store gets its `defaultEnabled`, so adding a feature later never flips anyone's existing choices.
- A toggle writes `$.store` and `$.state` together. Writing `$.state` redraws the pane and every reader automatically.
- Stored shapes use `Shaped` tags (`prefs-1`) so a future change of shape is declined and re-defaulted rather than misread after a reload.
- Preferences remain after `/plugin uninstall`. To be verified (section 9) and then stated in the README.

### 4.5 Feature status: errors and notes

`errors.ts` keeps, per feature id, a status entry in the session-scoped `status` atom. An entry is either an error (the last message, a count and a timestamp, recorded by the gate when a hook throws) or a note (a short text a feature posts about itself through `FeatureContext`, for example the mermaid feature's "Diagrams left as code: terminal size unknown").

Both are shown only in the `/rich-ui` pane: a dim line under the affected feature's row while the entry stands. Nothing is toasted, logged to the transcript, or put in the status line. An entry is cleared when the user toggles that feature off and on, or when the session restarts. The engine's debug log still receives failures as usual.

Consequence to accept: a user who never opens the pane will not see that a feature failed or fell back; the feature simply behaves as if off or as the engine would.

### 4.6 Manager

`hooks/manager/` registers the `/rich-ui` command and draws the pane. It is core, not a feature: it has no toggle and is always present. Pane behavior and layout are specified in the manager pane doc.

### 4.7 Diagram renderer seam (reserved for the mermaid feature)

The mermaid feature talks to rendering through one small interface returning either text lines or an image with its size and `alt`, with the text renderer as the default backend and results cached by source hash. This lets image and raster backends be added later without touching detection or layout code. Detail belongs in the mermaid doc.

## 5. Data and event flow

Session start: `register` runs, features register gated hooks, the manager registers `/rich-ui`; `session.start` hydrates state from `$.store`.

Normal event: engine event, then gated hook, then flag on and hook runs, or flag off and it passes through; a throw is recorded and the event continues.

Toggle: user presses a row in the pane, then `$.store` and `$.state` are written, the pane redraws, and the next event sees the new flag. Output already on screen is not redrawn.

## 6. Testing strategy

- `claude plugin validate .` and `tsc -p .` must pass before any commit.
- Core: flag off passes through; flag on runs; a throwing hook is recorded and the event continues; defaults hydrate for unknown ids; a stored value of an older shape is declined.
- Registry: a feature that throws in `register` leaves other features and the manager working.
- Every UI test mounts on the terminal surface only (the supported surface).
- Each feature owns its own tests; the mermaid feature's are specified in its doc.

## 7. Development workflow

- Run the working copy with `claude --plugin-dir .`; the engine hot-reloads it at turn boundaries.
- Rebuild vendored bundles with `node scripts/build-vendor.mjs`; the script pins exact versions and its output is committed so installs from GitHub need no build.
- Re-run validate, type-check and tests after every Claude Code upgrade, since the mods API is early access.

## 8. Distribution and compatibility

- `.claude-plugin/plugin.json` names the plugin `rich-ui`; `.claude-plugin/marketplace.json` lists it with source `./`.
- Install: `/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui`.
- Uninstall: `/plugin uninstall rich-ui`.
- The README states the minimum Claude Code version we tested against. Mods are on by default from Claude Code 2.1.287; we will record the exact tested version at release.

## 9. Open items to verify before implementation

1. What `$.store` keeps after `/plugin uninstall`, and what a reinstall sees.
2. Whether the `claude plugin test` kit supports `$.store` and `$.state` as the core tests need.
3. That a gated wrapper type-checks cleanly across the overloads of `on` with matchers.
4. The exact `plugin.json` fields for the `types` contract and any minimum-version field.
5. Whether `/rich-ui` can open the pane at any terminal width when run explicitly (the reference says explicit opens seat at any width).
