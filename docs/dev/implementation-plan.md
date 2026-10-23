# rich-ui v1: Implementation Plan

Builds the v1 described in `PRODUCT_DESIGN.md` and the four dev docs: the `rich-ui` mod with a feature registry, a gate, persisted toggles, the `/rich-ui` pane and the mermaid feature.

How to read this plan:
- Tasks are in dependency order. Each ends with a commit and leaves `main` working.
- Code is complete. Where the early-access mods API may reject a type or a call, the step says which file to adjust; do not change the design to fit a type error.
- Tests run with `claude plugin test .` (the engine's own runner, terminal surface only). Type checks run with `npx tsc -p .`. Manifests are checked with `claude plugin validate .`.
- Exact API shapes used below were read from the engine's types file (Claude Code 2.1.309). Re-check them if the version differs.

## Design deltas this plan makes (sync the docs in Task 14)

1. **Writes cannot happen while drawing.** The engine refuses `$.state` writes inside a `ui.render` hook, and the mermaid note and the gate's error capture both fire from render hooks. All status writes made from hooks therefore go through `$.clock.after(0, ...)` (`reportError`, `reportNote`). Direct writes (`addError`, `addNote`, `clearStatus`) are used from handlers and tests.
2. **`postNote` takes `$`:** `ctx.postNote($, text)`, because the context object cannot know the current `$`.
3. **Effective flag:** the `enabled` state holds only explicit user choices; a feature's flag is `enabled[id] ?? defaultEnabled`. This replaces "hydrate defaults into state" and is equivalent, but survives a missing or unreadable store with no extra code.
4. **Direction flip is flowchart-only** in v1. State diagrams are fitted in their authored direction or left as code.
5. **Version check is a script**, not a test: plugin tests have no filesystem. `scripts/check-version.mjs` compares `hooks/core/version.ts` with `.claude-plugin/plugin.json`.
6. **Plugin height note:** the engine does not redraw on a height-only change, so fit is decided at the last width or props change.

## File map

```
.claude-plugin/plugin.json            manifest: name rich-ui, version, types pointer
.claude-plugin/marketplace.json       marketplace claude-code-rich-ui, one entry
.gitignore
package.json                          dev tooling only (esbuild, beautiful-mermaid, typescript)
tsconfig.json
THIRD_PARTY_NOTICES.md
types/index.d.ts                      PluginState contract and shared types
hooks/hooks.json                      { "modules": ["./register.tsx"] }
hooks/register.tsx                    entry: hydrate, manager, features
hooks/core/feature.ts                 Feature, FeatureContext types
hooks/core/state.ts                   state atoms
hooks/core/errors.ts                  per-feature status (errors, notes)
hooks/core/prefs.ts                   load, read, toggle preferences
hooks/core/gate.ts                    gated `on`
hooks/core/registry.ts                shipped features list
hooks/core/version.ts                 VERSION constant
hooks/core/test-harness.ts            shared test setup (not imported by the plugin)
hooks/manager/index.ts                /rich-ui command and pane hooks
hooks/manager/pane.tsx                the pane tree
hooks/manager/size.ts                 contentRows, clip
hooks/features/mermaid/index.ts       Feature object and hook
hooks/features/mermaid/detect.ts      fence splitter
hooks/features/mermaid/sanity.ts      header check
hooks/features/mermaid/fit.ts         fit and direction flip
hooks/features/mermaid/render.ts      renderDiagram over the vendored bundle
hooks/features/mermaid/view.tsx       reply tree with source toggle
hooks/vendor/beautiful-mermaid.js     committed bundle
hooks/vendor/beautiful-mermaid.d.ts   hand-written types for the bundle
scripts/build-vendor.mjs              reproducible bundle build with size guard
scripts/check-version.mjs             version consistency check
docs/usage.md                         user docs
README.md                             landing page
```
Tests sit beside code as `*.test.ts` / `*.test.tsx`.

---

## Task 0: Scaffold and prove the toolchain

**Files:** create `package.json`, `tsconfig.json`, `.gitignore`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `hooks/register.tsx`, `types/index.d.ts`, `hooks/core/smoke.test.ts` (deleted at the end).

- [ ] **Step 1: Write the tooling files**

`package.json`:
```json
{
  "name": "claude-code-rich-ui",
  "private": true,
  "type": "module",
  "scripts": {
    "build:vendor": "node scripts/build-vendor.mjs",
    "check:version": "node scripts/check-version.mjs",
    "typecheck": "tsc -p .",
    "test": "claude plugin test .",
    "validate": "claude plugin validate ."
  },
  "devDependencies": {
    "beautiful-mermaid": "1.1.3",
    "esbuild": "0.28.2",
    "typescript": "7.0.2"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "types": [],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowJs": false,
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  },
  "include": [".claude-plugin/types", "hooks", "types"]
}
```

`.gitignore`:
```
node_modules/
.claude-plugin/types/
```

- [ ] **Step 2: Write the manifests and the empty module**

`.claude-plugin/plugin.json`:
```json
{
  "name": "rich-ui",
  "version": "0.1.0",
  "description": "Richer Claude Code output, one toggle per feature. Draws mermaid diagrams in your terminal.",
  "types": "./types/index.d.ts"
}
```

`.claude-plugin/marketplace.json`:
```json
{
  "name": "claude-code-rich-ui",
  "owner": { "name": "Emergent AI" },
  "plugins": [
    {
      "name": "rich-ui",
      "source": "./",
      "description": "Richer Claude Code output, one toggle per feature."
    }
  ]
}
```

`hooks/hooks.json`:
```json
{ "modules": ["./register.tsx"] }
```

`hooks/register.tsx`:
```tsx
import type { Register } from 'claude-code'

export const register: Register = () => {}
```

`types/index.d.ts` (placeholder, completed in Task 1):
```ts
export {}
```

- [ ] **Step 3: Install and lay the engine's types**

Run: `npm install`
Expected: installs `beautiful-mermaid`, `esbuild`, `typescript` with no errors.

The engine writes `.claude-plugin/types/` when an interactive session loads the folder. Run `claude --plugin-dir .` once, send any message, then exit. Expected: `.claude-plugin/types/claude-code/index.d.ts` exists. (If you cannot run an interactive session, copy the types file named in the plugin-authoring skill's header to `.claude-plugin/types/claude-code/index.d.ts`.)

- [ ] **Step 4: Validate the manifests**

Run: `claude plugin validate .`
Expected: passes. If it rejects the `marketplace.json` `name`, the message names the rule; fix the name only if the rule is violated, and record the outcome for Task 14.

- [ ] **Step 5: Prove test discovery with a smoke test**

`hooks/core/smoke.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

test('the runner finds tests beside the code', async () => {
  expect(1 + 1).toBe(2)
})
```
Run: `claude plugin test .`
Expected: 1 test passes. If no test is found, move tests to a top-level `tests/` folder for the whole plan (add `"tests"` to the tsconfig `include`) and say so in the commit message.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm hooks/core/smoke.test.ts
git add package.json package-lock.json tsconfig.json .gitignore .claude-plugin/plugin.json .claude-plugin/marketplace.json hooks/hooks.json hooks/register.tsx types/index.d.ts
git commit -m "Scaffold rich-ui plugin, manifests and toolchain"
```

---

## Task 1: Shared types, feature contract and state atoms

**Files:** modify `types/index.d.ts`; create `hooks/core/feature.ts`, `hooks/core/state.ts`, `hooks/core/version.ts`.

- [ ] **Step 1: Write the contract**

`types/index.d.ts`:
```ts
export type EnabledMap = Record<string, boolean>

export type FeatureStatus = {
  error?: { message: string; count: number; at: number }
  notes: string[]
}
export type StatusMap = Record<string, FeatureStatus>

export type ShownMap = Record<string, boolean>

declare module 'claude-code' {
  interface PluginState {
    'rich-ui': {
      enabled: Shaped<EnabledMap>
      status: Shaped<StatusMap>
      saveFailed: Shaped<boolean>
      shown: Shaped<ShownMap>
    }
  }
}
```

- [ ] **Step 2: Write the feature types, atoms and version**

`hooks/core/feature.ts`:
```ts
import type { EngineInterface, On } from 'claude-code'

export type GatedOn = On

export type FeatureContext = {
  id: string
  postNote: ($: EngineInterface, text: string) => void
}

export type Feature = {
  id: string
  name: string
  description: string
  defaultEnabled: boolean
  register: (on: GatedOn, ctx: FeatureContext) => void
}
```

`hooks/core/state.ts`:
```ts
import { atom } from 'claude-code'
import type { EnabledMap, ShownMap, StatusMap } from '../../types'

export const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)

export const statusAtom = atom(
  { plugin: 'rich-ui', key: 'status' } as const,
  {} as StatusMap,
  { shape: 'status-1' },
)

export const saveFailedAtom = atom(
  { plugin: 'rich-ui', key: 'saveFailed' } as const,
  false,
  { shape: 'save-failed-1' },
)

export const shownAtom = atom(
  { plugin: 'rich-ui', key: 'shown' } as const,
  {} as ShownMap,
  { shape: 'shown-1' },
)
```

`hooks/core/version.ts`:
```ts
export const VERSION = '0.1.0'
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p .`
Expected: no errors. If `Shaped` is not found, confirm `.claude-plugin/types/claude-code/index.d.ts` was laid (Task 0, step 3).

- [ ] **Step 4: Commit**

```bash
git add types/index.d.ts hooks/core/feature.ts hooks/core/state.ts hooks/core/version.ts
git commit -m "Add state contract, feature types and state atoms"
```

---

## Task 2: Status (errors and notes)

**Files:** create `hooks/core/errors.ts`, `hooks/core/test-harness.ts`, `hooks/core/errors.test.ts`.

- [ ] **Step 1: Write the shared test harness**

`hooks/core/test-harness.ts`:
```ts
import { mock } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

export async function boot(
  $: EngineInterface,
  on: On,
  store: Record<string, unknown> = {},
) {
  mock.store(on, store)
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'rich-ui' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return clock
}
```
(If `tsc` rejects the `$` type for a test's engine object, loosen the `$` parameter type in this file only.)

- [ ] **Step 2: Write the failing tests**

`hooks/core/errors.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { clearStatus, reportError, reportNote } from './errors'
import { boot } from './test-harness'

const STATUS = { plugin: 'rich-ui', key: 'status' } as const

test('a reported error lands after the clock settles', async ($, on) => {
  const clock = await boot($, on)

  reportError($, 'mermaid', new Error('boom'))
  expect(((await $.state.get(STATUS)).value ?? {})['mermaid']).toBeUndefined()

  await clock.settle()
  const entry = ((await $.state.get(STATUS)).value ?? {})['mermaid']
  expect(entry?.error?.message).toBe('boom')
  expect(entry?.error?.count).toBe(1)
})

test('a repeated error raises the count', async ($, on) => {
  const clock = await boot($, on)

  reportError($, 'mermaid', new Error('boom'))
  await clock.settle()
  reportError($, 'mermaid', new Error('boom again'))
  await clock.settle()

  const entry = ((await $.state.get(STATUS)).value ?? {})['mermaid']
  expect(entry?.error?.count).toBe(2)
  expect(entry?.error?.message).toBe('boom again')
})

test('a note is kept once however often it is posted', async ($, on) => {
  const clock = await boot($, on)

  reportNote($, 'mermaid', 'size unknown')
  reportNote($, 'mermaid', 'size unknown')
  await clock.settle()

  const entry = ((await $.state.get(STATUS)).value ?? {})['mermaid']
  expect(entry?.notes.length).toBe(1)
})

test('clearing a feature removes its entry', async ($, on) => {
  const clock = await boot($, on)

  reportNote($, 'mermaid', 'size unknown')
  await clock.settle()
  await clearStatus($, 'mermaid')

  expect(((await $.state.get(STATUS)).value ?? {})['mermaid']).toBeUndefined()
})
```
Note: a test can read state with `$.state.get` but only the plugin writes it. Tests use static imports only; no file in this plan uses `import()`.

- [ ] **Step 3: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./errors` not found.

- [ ] **Step 4: Write the implementation**

`hooks/core/errors.ts`:
```ts
import { update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FeatureStatus } from '../../types'
import { statusAtom } from './state'

const EMPTY: FeatureStatus = { notes: [] }

export async function addError(
  $: EngineInterface,
  id: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const at = await $.clock.now()
  await update($, statusAtom, map => {
    const previous = map[id] ?? EMPTY

    return {
      ...map,
      [id]: {
        ...previous,
        error: { message, count: (previous.error?.count ?? 0) + 1, at },
      },
    }
  })
}

export async function addNote(
  $: EngineInterface,
  id: string,
  text: string,
): Promise<void> {
  await update($, statusAtom, map => {
    const previous = map[id] ?? EMPTY
    if (previous.notes.includes(text)) return map

    return { ...map, [id]: { ...previous, notes: [...previous.notes, text] } }
  })
}

export async function clearStatus(
  $: EngineInterface,
  id: string,
): Promise<void> {
  await update($, statusAtom, map => {
    if (!(id in map)) return map
    const { [id]: _removed, ...rest } = map

    return rest
  })
}

// The engine refuses state writes while a ui.render hook draws, and errors and
// notes are raised from render hooks, so these hand the write to a timer.
export function reportError(
  $: EngineInterface,
  id: string,
  error: unknown,
): void {
  void $.clock.after(0, () => addError($, id, error))
}

export function reportNote(
  $: EngineInterface,
  id: string,
  text: string,
): void {
  void $.clock.after(0, () => addNote($, id, text))
}
```

- [ ] **Step 5: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass, no type errors. If the deferred write does not land, the timer callback cannot use the captured `$` in this build; stop and report, because the design deltas depend on it.

```bash
git add hooks/core/errors.ts hooks/core/errors.test.ts hooks/core/test-harness.ts
git commit -m "Add per-feature status with deferred writes"
```

---

## Task 3: Preferences (load, read, toggle)

**Files:** create `hooks/core/prefs.ts`, `hooks/core/prefs.test.ts`.

- [ ] **Step 1: Write the failing tests**

`hooks/core/prefs.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { boot } from './test-harness'
import { isEnabled, loadPrefs, parseStored, toggleFeature } from './prefs'

test('parseStored accepts only the current shape', async () => {
  expect(JSON.stringify(parseStored({ v: 1, enabled: { a: true, b: 'x' } }))).toBe(
    JSON.stringify({ a: true }),
  )
  expect(JSON.stringify(parseStored({ v: 2, enabled: { a: true } }))).toBe('{}')
  expect(JSON.stringify(parseStored(null))).toBe('{}')
  expect(JSON.stringify(parseStored('nope'))).toBe('{}')
})

test('a feature with no stored choice uses its default', async ($, on) => {
  await boot($, on)

  expect(await isEnabled($, 'mermaid', true)).toBe(true)
  expect(await isEnabled($, 'other', false)).toBe(false)
})

test('a stored choice wins over the default', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  await loadPrefs($)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
})

test('a toggle flips the flag, saves it and clears the status', async ($, on) => {
  await boot($, on)

  await toggleFeature($, 'mermaid', true)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
  const saved = await $.store.get('prefs')
  expect(JSON.stringify(saved)).toBe(
    JSON.stringify({ v: 1, enabled: { mermaid: false } }),
  )

  await toggleFeature($, 'mermaid', true)
  expect(await isEnabled($, 'mermaid', true)).toBe(true)
})

test('a failed save keeps the toggle and sets saveFailed', async ($, on) => {
  await boot($, on)
  on('store.set', () => {
    throw new Error('disk full')
  })

  await toggleFeature($, 'mermaid', true)

  expect(await isEnabled($, 'mermaid', true)).toBe(false)
  const failed = await $.state.get({ plugin: 'rich-ui', key: 'saveFailed' } as const)
  expect(failed.value).toBe(true)
})
```
If `store.set` is not the event name that `mock.store` answers, find the store write event name in the types (search `'store.set'`) and use it; the assertion stays the same. If a throwing hook cannot be placed above `mock.store`, drop only the last test and cover the failure by hand in Task 13.

- [ ] **Step 2: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./prefs` not found.

- [ ] **Step 3: Write the implementation**

`hooks/core/prefs.ts`:
```ts
import { read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EnabledMap } from '../../types'
import { clearStatus } from './errors'
import { enabledAtom, saveFailedAtom } from './state'

const STORE_KEY = 'prefs'

export function parseStored(raw: unknown): EnabledMap {
  if (typeof raw !== 'object' || raw === null) return {}
  const stored = raw as { v?: unknown; enabled?: unknown }
  if (stored.v !== 1) return {}
  if (typeof stored.enabled !== 'object' || stored.enabled === null) return {}

  const out: EnabledMap = {}
  for (const [id, value] of Object.entries(stored.enabled)) {
    if (typeof value === 'boolean') out[id] = value
  }

  return out
}

export async function loadPrefs($: EngineInterface): Promise<void> {
  const enabled = parseStored(await $.store.get(STORE_KEY))
  await update($, enabledAtom, () => enabled)
}

export async function isEnabled(
  $: EngineInterface,
  id: string,
  defaultEnabled: boolean,
): Promise<boolean> {
  const map = await read($, enabledAtom)

  return map[id] ?? defaultEnabled
}

export async function toggleFeature(
  $: EngineInterface,
  id: string,
  defaultEnabled: boolean,
): Promise<void> {
  const next = !(await isEnabled($, id, defaultEnabled))
  await update($, enabledAtom, map => ({ ...map, [id]: next }))
  await clearStatus($, id)

  const enabled = await read($, enabledAtom)
  try {
    await $.store.set(STORE_KEY, { v: 1, enabled })
    await update($, saveFailedAtom, () => false)
  } catch {
    await update($, saveFailedAtom, () => true)
  }
}
```

- [ ] **Step 4: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass.

```bash
git add hooks/core/prefs.ts hooks/core/prefs.test.ts
git commit -m "Add persisted feature preferences with save-failure flag"
```

---

## Task 4: The gate

**Files:** create `hooks/core/gate.ts`, `hooks/core/gate.test.ts`.

- [ ] **Step 1: Write the failing tests**

`hooks/core/gate.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { boot } from './test-harness'
import { gateOn } from './gate'
import { toggleFeature } from './prefs'

const STATUS = { plugin: 'rich-ui', key: 'status' } as const

function setup($: any, on: any) {
  // `gateOn` wraps the registration function it is given.
  return gateOn(((...args: unknown[]) => (on as any)(...args)) as any, {
    id: 'demo',
    defaultEnabled: true,
  })
}

test('an enabled feature runs its hook', async ($, on) => {
  await boot($, on)
  const gated = setup($, on)
  gated('prompt.submit', ($: any, e: any) => ({ ...e, text: 'changed' }))

  const result = await $.prompt.submit({ text: 'original' } as any)
  expect(JSON.stringify(result)).toContain('changed')
})

test('a disabled feature passes the event through', async ($, on) => {
  await boot($, on)
  const gated = setup($, on)
  gated('prompt.submit', ($: any, e: any) => ({ ...e, text: 'changed' }))
  await toggleFeature($, 'demo', true)

  const result = await $.prompt.submit({ text: 'original' } as any)
  expect(JSON.stringify(result)).toContain('original')
})

test('a throwing hook is recorded and the event continues', async ($, on) => {
  const clock = await boot($, on)
  const gated = setup($, on)
  gated('prompt.submit', () => {
    throw new Error('hook broke')
  })

  const result = await $.prompt.submit({ text: 'original' } as any)
  await clock.settle()

  expect(JSON.stringify(result)).toContain('original')
  const entry = ((await $.state.get(STATUS)).value ?? {})['demo']
  expect(entry?.error?.message).toBe('hook broke')
})
```
These tests use `prompt.submit` only as a convenient event. If the kit's `$.prompt.submit` shape differs, use any event that returns an object the hook can rewrite (for example `session.start`) and keep the three assertions: runs when on, passes through when off, records and continues on a throw.

- [ ] **Step 2: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./gate` not found.

- [ ] **Step 3: Write the implementation**

`hooks/core/gate.ts`:
```ts
import type { EngineInterface, On } from 'claude-code'

import { reportError } from './errors'
import { isEnabled } from './prefs'

type Next = (e: unknown) => unknown
type Hook = ($: EngineInterface, e: unknown, next: Next) => unknown
type Loose = (...args: unknown[]) => unknown

// Streaming (generator) hooks are not supported; v1 features do not use them.
export function gateOn(
  on: On,
  feature: { id: string; defaultEnabled: boolean },
): On {
  const gated = (...args: unknown[]) => {
    const hook = args[args.length - 1] as Hook
    const head = args.slice(0, -1)

    const wrapped: Hook = async ($, e, next) => {
      if (!(await isEnabled($, feature.id, feature.defaultEnabled))) {
        return next(e)
      }
      try {
        return await hook($, e, next)
      } catch (error) {
        reportError($, feature.id, error)

        return next(e)
      }
    }

    return (on as unknown as Loose)(...head, wrapped)
  }

  return gated as unknown as On
}
```
(`next(e)` after a hook that already called `next` replays that call's result, so nothing runs twice.)

- [ ] **Step 4: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass.

```bash
git add hooks/core/gate.ts hooks/core/gate.test.ts
git commit -m "Add feature gate with error capture"
```

---

## Task 5: Vendored renderer and notices

**Files:** create `scripts/build-vendor.mjs`, `hooks/vendor/beautiful-mermaid.js` (generated), `hooks/vendor/beautiful-mermaid.d.ts`, `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 1: Write the build script**

`scripts/build-vendor.mjs`:
```js
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'hooks/vendor/beautiful-mermaid.js')
const LIMIT = 800 * 1024

const elkStub = `export default class ELK {
  constructor() {}
  layout() { throw new Error('elk stubbed') }
}`

await build({
  stdin: {
    contents: `export { renderMermaidASCII } from 'beautiful-mermaid'`,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  outfile,
  plugins: [
    {
      name: 'stub-elk',
      setup(b) {
        b.onResolve({ filter: /^elkjs/ }, () => ({
          path: 'elk-stub',
          namespace: 'stub',
        }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: elkStub,
          loader: 'js',
        }))
      },
    },
  ],
})

const size = statSync(outfile).size
if (size > LIMIT) {
  throw new Error(`bundle is ${size} bytes, over the ${LIMIT} byte budget`)
}
const code = readFileSync(outfile, 'utf8')
if (/\brequire\(|\bprocess\./.test(code)) {
  throw new Error('bundle uses require() or process, which the mod sandbox lacks')
}
console.log(`built ${outfile} (${size} bytes)`)
```

`hooks/vendor/beautiful-mermaid.d.ts`:
```ts
export interface AsciiRenderOptions {
  useAscii?: boolean
  paddingX?: number
  paddingY?: number
  boxBorderPadding?: number
  colorMode?: 'none' | 'ansi16' | 'ansi256' | 'truecolor' | 'html' | 'auto'
}

export function renderMermaidASCII(
  text: string,
  options?: AsciiRenderOptions,
): string
```

- [ ] **Step 2: Build and check**

Run: `npm run build:vendor`
Expected: `built .../hooks/vendor/beautiful-mermaid.js (<about 84000> bytes)` and no error. (The spike's bundle was 84,067 bytes; anything under 800 KB passes the guard.)

- [ ] **Step 3: Write the third-party notice**

Run:
```bash
{
  echo "# Third-party notices"
  echo
  echo "rich-ui bundles beautiful-mermaid 1.1.3 (MIT) in hooks/vendor/beautiful-mermaid.js, built by scripts/build-vendor.mjs."
  echo
  cat node_modules/beautiful-mermaid/LICENSE
} > THIRD_PARTY_NOTICES.md
```
Expected: the file ends with the MIT license text. If `node_modules/beautiful-mermaid/LICENSE` does not exist, copy the license text from the package's repository and name its source in the file.

- [ ] **Step 4: Validate and commit**

Run: `claude plugin validate .`
Expected: passes (the module does not import the bundle yet).

```bash
git add scripts/build-vendor.mjs hooks/vendor/beautiful-mermaid.js hooks/vendor/beautiful-mermaid.d.ts THIRD_PARTY_NOTICES.md
git commit -m "Vendor beautiful-mermaid with ELK stubbed and a size guard"
```

---

## Task 6: Mermaid detection

**Files:** create `hooks/features/mermaid/detect.ts`, `hooks/features/mermaid/detect.test.ts`.

- [ ] **Step 1: Write the failing tests**

`hooks/features/mermaid/detect.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { splitReply } from './detect'

const FLOW = 'graph TD\n  A --> B'

function same(actual: unknown, expected: unknown) {
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected))
}

test('a reply with no fence is one text segment', async () => {
  same(splitReply('just words'), [{ kind: 'text', text: 'just words' }])
})

test('text is split around a backtick fence', async () => {
  const raw = ['```mermaid', FLOW, '```'].join('\n')
  same(splitReply(['before', raw, 'after'].join('\n')), [
    { kind: 'text', text: 'before' },
    { kind: 'mermaid', source: FLOW, raw },
    { kind: 'text', text: 'after' },
  ])
})

test('a tilde fence and any letter case are matched', async () => {
  const raw = ['~~~Mermaid', FLOW, '~~~'].join('\n')
  const segments = splitReply(raw)
  same(segments, [{ kind: 'mermaid', source: FLOW, raw }])
})

test('several fences are handled in order', async () => {
  const one = ['```mermaid', 'graph LR', '  A --> B', '```'].join('\n')
  const two = ['```mermaid', 'sequenceDiagram', '  A->>B: hi', '```'].join('\n')
  const kinds = splitReply([one, 'between', two].join('\n')).map(s => s.kind)
  same(kinds, ['mermaid', 'text', 'mermaid'])
})

test('an unclosed fence stays text', async () => {
  const text = 'intro\n```mermaid\ngraph TD'
  same(splitReply(text), [{ kind: 'text', text }])
})

test('an indented fence is not matched', async () => {
  const text = ['  ```mermaid', FLOW, '  ```'].join('\n')
  same(splitReply(text), [{ kind: 'text', text }])
})

test('a fence in a blockquote is not matched', async () => {
  const text = ['> ```mermaid', `> ${FLOW}`, '> ```'].join('\n')
  same(splitReply(text), [{ kind: 'text', text }])
})

test('a mermaid fence inside another fence is not matched', async () => {
  const text = ['````markdown', '```mermaid', FLOW, '```', '````'].join('\n')
  same(splitReply(text), [{ kind: 'text', text }])
})

test('a non-mermaid fence is left alone', async () => {
  const text = ['```ts', 'const a = 1', '```'].join('\n')
  same(splitReply(text), [{ kind: 'text', text }])
})

test('a closing fence must be at least as long as the opening one', async () => {
  const text = ['````mermaid', FLOW, '```', 'still inside', '````'].join('\n')
  const segments = splitReply(text)
  same(segments.length, 1)
  same(segments[0]?.kind, 'mermaid')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./detect` not found.

- [ ] **Step 3: Write the implementation**

`hooks/features/mermaid/detect.ts`:
```ts
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mermaid'; source: string; raw: string }

type OpenFence = {
  char: string
  length: number
  at: number
  isMermaid: boolean
}

const OPEN = /^(`{3,}|~{3,})(.*)$/

function pushText(out: Segment[], lines: string[], from: number, to: number) {
  const text = lines.slice(from, to).join('\n')
  if (text.trim() !== '') out.push({ kind: 'text', text })
}

export function splitReply(text: string): Segment[] {
  const lines = text.split('\n')
  const out: Segment[] = []
  let textStart = 0
  let open: OpenFence | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (open === null) {
      const match = OPEN.exec(line)
      if (match) {
        const fence = match[1] ?? ''
        open = {
          char: fence.charAt(0),
          length: fence.length,
          at: i,
          isMermaid: (match[2] ?? '').trim().toLowerCase() === 'mermaid',
        }
      }
      continue
    }

    const closing = new RegExp(`^${open.char}{${open.length},}[ \\t]*$`)
    if (!closing.test(line)) continue

    if (open.isMermaid) {
      pushText(out, lines, textStart, open.at)
      out.push({
        kind: 'mermaid',
        source: lines.slice(open.at + 1, i).join('\n'),
        raw: lines.slice(open.at, i + 1).join('\n'),
      })
      textStart = i + 1
    }
    open = null
  }
  pushText(out, lines, textStart, lines.length)

  return out
}
```
The unclosed-fence test passes because `textStart` never advances past an unclosed fence, so the whole reply comes back as one text segment (`pushText` keeps the original text when it is not blank).

- [ ] **Step 4: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass.

```bash
git add hooks/features/mermaid/detect.ts hooks/features/mermaid/detect.test.ts
git commit -m "Add mermaid fence detection"
```

---

## Task 7: Header sanity check

**Files:** create `hooks/features/mermaid/sanity.ts`, `hooks/features/mermaid/sanity.test.ts`.

- [ ] **Step 1: Write the failing tests**

`hooks/features/mermaid/sanity.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { diagramKind } from './sanity'

test('each supported header is recognised', async () => {
  expect(diagramKind('graph TD\n A-->B')).toBe('flowchart')
  expect(diagramKind('flowchart LR\n A-->B')).toBe('flowchart')
  expect(diagramKind('sequenceDiagram\n A->>B: hi')).toBe('sequence')
  expect(diagramKind('stateDiagram-v2\n [*] --> A')).toBe('state')
  expect(diagramKind('stateDiagram\n [*] --> A')).toBe('state')
  expect(diagramKind('classDiagram\n class A')).toBe('class')
  expect(diagramKind('erDiagram\n A ||--o{ B : has')).toBe('er')
})

test('unsupported and unknown headers are rejected', async () => {
  expect(diagramKind('gantt\n title x')).toBe(null)
  expect(diagramKind('pie\n "a": 1')).toBe(null)
  expect(diagramKind('hello world')).toBe(null)
  expect(diagramKind('')).toBe(null)
})

test('front matter, comments and directives are skipped', async () => {
  const withFrontMatter = '---\ntitle: x\n---\ngraph TD\n A-->B'
  expect(diagramKind(withFrontMatter)).toBe('flowchart')

  const withDirective = '%% note\n%%{init: {"theme": "dark"}}%%\nsequenceDiagram\n A->>B: hi'
  expect(diagramKind(withDirective)).toBe('sequence')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./sanity` not found.

- [ ] **Step 3: Write the implementation**

`hooks/features/mermaid/sanity.ts`:
```ts
export type DiagramKind = 'flowchart' | 'sequence' | 'state' | 'class' | 'er'

const HEADERS: Array<[RegExp, DiagramKind]> = [
  [/^(?:graph|flowchart)\b/, 'flowchart'],
  [/^sequenceDiagram\b/, 'sequence'],
  [/^stateDiagram(?:-v2)?\b/, 'state'],
  [/^classDiagram\b/, 'class'],
  [/^erDiagram\b/, 'er'],
]

export function diagramKind(source: string): DiagramKind | null {
  const lines = source.split('\n')
  let i = 0

  while (i < lines.length && (lines[i] ?? '').trim() === '') i++
  if ((lines[i] ?? '').trim() === '---') {
    i++
    while (i < lines.length && (lines[i] ?? '').trim() !== '---') i++
    i++
  }

  for (; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (line === '' || line.startsWith('%%')) continue
    for (const [pattern, kind] of HEADERS) {
      if (pattern.test(line)) return kind
    }

    return null
  }

  return null
}
```

- [ ] **Step 4: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass.

```bash
git add hooks/features/mermaid/sanity.ts hooks/features/mermaid/sanity.test.ts
git commit -m "Add mermaid header sanity check"
```

---

## Task 8: Renderer wrapper and fitting

**Files:** create `hooks/features/mermaid/render.ts`, `hooks/features/mermaid/render.test.ts`, `hooks/features/mermaid/fit.ts`, `hooks/features/mermaid/fit.test.ts`.

- [ ] **Step 1: Write the failing render tests**

`hooks/features/mermaid/render.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { renderDiagram } from './render'

test('a flowchart renders as box-drawing text', async () => {
  const result = renderDiagram('graph TD\n  A[Start] --> B[Done]')
  expect(result?.kind).toBe('text')
  expect(result?.lines.join('\n')).toContain('Start')
  expect(/[┌─│]/.test(result?.lines.join('\n') ?? '')).toBe(true)
  expect((result?.width ?? 0) > 0).toBe(true)
  expect(result?.height).toBe(result?.lines.length)
})

test('a sequence diagram renders', async () => {
  const result = renderDiagram('sequenceDiagram\n  A->>B: hi\n  B-->>A: yo')
  expect(result?.lines.join('\n')).toContain('hi')
})

test('an unsupported header yields nothing', async () => {
  expect(renderDiagram('gantt\n  title x')).toBe(null)
})

test('blank source yields nothing', async () => {
  expect(renderDiagram('   ')).toBe(null)
})
```

- [ ] **Step 2: Write the failing fit tests**

`hooks/features/mermaid/fit.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { fitDiagram, flipDirection } from './fit'
import type { DiagramResult } from './render'

function fake(width: number, height: number): DiagramResult {
  return {
    kind: 'text',
    lines: Array.from({ length: height }, () => 'x'.repeat(width)),
    width,
    height,
  }
}

const VIEWPORT = { columns: 80, rows: 30 }

test('the authored direction is used when it fits', async () => {
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(20, 10))
  expect(lines?.length).toBe(10)
})

test('the other direction is tried when the first does not fit', async () => {
  const render = (source: string) =>
    /^graph LR/m.test(source) ? fake(60, 8) : fake(30, 50)
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, render)
  expect(lines?.length).toBe(8)
})

test('nothing is returned when neither direction fits', async () => {
  const lines = fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(200, 100))
  expect(lines).toBe(null)
})

test('non-flowcharts are rendered once and never flipped', async () => {
  let calls = 0
  const lines = fitDiagram('sequenceDiagram\n A->>B: hi', VIEWPORT, () => {
    calls++

    return fake(200, 100)
  })
  expect(lines).toBe(null)
  expect(calls).toBe(1)
})

test('an unsupported header is never rendered', async () => {
  let calls = 0
  const lines = fitDiagram('gantt\n title x', VIEWPORT, () => {
    calls++

    return fake(10, 5)
  })
  expect(lines).toBe(null)
  expect(calls).toBe(0)
})

test('the viewport margins are respected', async () => {
  // columns 80 minus 4 = 76 wide, rows 30 minus 6 = 24 tall
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(76, 24))?.length).toBe(24)
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(77, 24))).toBe(null)
  expect(fitDiagram('graph TD\n A-->B', VIEWPORT, () => fake(76, 25))).toBe(null)
})

test('flipDirection swaps top-down and left-right', async () => {
  expect(flipDirection('graph TD\nA-->B')).toBe('graph LR\nA-->B')
  expect(flipDirection('flowchart LR\nA-->B')).toBe('flowchart TD\nA-->B')
  expect(flipDirection('flowchart BT\nA-->B')).toBe('flowchart LR\nA-->B')
  expect(flipDirection('graph\nA-->B')).toBe('graph LR\nA-->B')
  expect(flipDirection('sequenceDiagram\nA->>B: hi')).toBe(null)
})
```

- [ ] **Step 3: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./render` and `./fit` not found.

- [ ] **Step 4: Write the renderer wrapper**

`hooks/features/mermaid/render.ts`:
```ts
import { renderMermaidASCII } from '../../vendor/beautiful-mermaid.js'

export type DiagramResult = {
  kind: 'text'
  lines: string[]
  width: number
  height: number
}

// Image output would be a second variant of DiagramResult; the rest of the
// feature only reads lines, width and height from the text variant.
export function renderDiagram(source: string): DiagramResult | null {
  try {
    const raw = renderMermaidASCII(source, { useAscii: false, colorMode: 'none' })
    const lines = raw.split('\n').map(line => line.replace(/\s+$/, ''))
    while (lines.length > 0 && lines[0] === '') lines.shift()
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    if (!lines.some(line => line.trim() !== '')) return null

    return {
      kind: 'text',
      lines,
      width: Math.max(...lines.map(line => line.length)),
      height: lines.length,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Write the fitting logic**

`hooks/features/mermaid/fit.ts`:
```ts
import { renderDiagram } from './render'
import type { DiagramResult } from './render'
import { diagramKind } from './sanity'

export const ROW_MARGIN = 6
export const COLUMN_MARGIN = 4

export type Viewport = { columns: number; rows: number }

function fitsViewport(diagram: DiagramResult, viewport: Viewport): boolean {
  return (
    diagram.width <= viewport.columns - COLUMN_MARGIN &&
    diagram.height <= viewport.rows - ROW_MARGIN
  )
}

const FLOW_HEADER =
  /^(\s*(?:graph|flowchart))(?:[ \t]+(TD|TB|BT|LR|RL))?(?=[ \t]*(?:;|$))/m

export function flipDirection(source: string): string | null {
  const match = FLOW_HEADER.exec(source)
  if (!match) return null
  const direction = match[2]
  const next = direction === 'LR' || direction === 'RL' ? 'TD' : 'LR'

  return source.replace(FLOW_HEADER, `${match[1]} ${next}`)
}

export function fitDiagram(
  source: string,
  viewport: Viewport,
  render: (source: string) => DiagramResult | null = renderDiagram,
): string[] | null {
  const kind = diagramKind(source)
  if (kind === null) return null

  const first = render(source)
  if (first && fitsViewport(first, viewport)) return first.lines
  if (kind !== 'flowchart') return null

  const flipped = flipDirection(source)
  const second = flipped ? render(flipped) : null

  return second && fitsViewport(second, viewport) ? second.lines : null
}
```

- [ ] **Step 6: Run to verify pass, type-check, commit**

Run: `claude plugin test .` then `npx tsc -p .`
Expected: all pass. If a real rendering assertion in `render.test.ts` fails on a character class or text, look at the actual output once (`node -e` against `node_modules/beautiful-mermaid`) and fix the assertion, not the code.

```bash
git add hooks/features/mermaid/render.ts hooks/features/mermaid/render.test.ts hooks/features/mermaid/fit.ts hooks/features/mermaid/fit.test.ts
git commit -m "Add diagram renderer wrapper and viewport fitting"
```

---

## Task 9: Mermaid view and feature

**Files:** create `hooks/features/mermaid/view.tsx`, `hooks/features/mermaid/index.ts`, `hooks/features/mermaid/index.test.tsx`.

- [ ] **Step 1: Write the failing tests**

`hooks/features/mermaid/index.test.tsx`:
```tsx
import { expect, test } from 'claude-code/testing'

import { loadPrefs } from '../../core/prefs'
import { boot } from '../../core/test-harness'

const FLOW = ['graph TD', '  A[Start] --> B{Valid?}', '  B -->|yes| C[Done]'].join('\n')

function reply(source: string) {
  return ['Here is the flow:', '', '```mermaid', source, '```', '', 'Does that match?'].join('\n')
}

function message(text: string, viewport?: { columns: number; rows: number }) {
  return {
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text, isFirstOfReply: true },
    ...(viewport ? { viewport } : {}),
  } as const
}

const ROOMY = { columns: 120, rows: 60 }

test('a diagram replaces the fence and text around it is kept', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  expect(await ui.find({ type: 'Markdown', text: /Here is the flow/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /Does that match/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeUndefined()
  await ui.unmount()
})

test('the toggle swaps the diagram for the source and back', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  await ui.press({ key: 'toggle1' })
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeUndefined()
  expect((await ui.find({ key: 'toggle1' }))?.text).toContain('show diagram')

  await ui.press({ key: 'toggle1' })
  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Start/ })).toBeDefined()
  await ui.unmount()
})

test('an unsupported diagram type stays a code block', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply('gantt\n  title Plan'), ROOMY))

  expect(await ui.find({ type: 'Markdown', text: /gantt/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('a diagram too big for the window stays a code block', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW), { columns: 20, rows: 12 }))

  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('an unknown window size leaves the code and posts a note', async ($, on) => {
  const clock = await boot($, on)
  const ui = await $.ui.mount(message(reply(FLOW)))
  await clock.settle()

  expect(await ui.find({ type: 'Markdown', text: /graph TD/ })).toBeDefined()
  const status = await $.state.get({ plugin: 'rich-ui', key: 'status' } as const)
  expect(status.value?.['mermaid']?.notes[0]).toBe(
    'Diagrams left as code: terminal size unknown',
  )
  await ui.unmount()
})

test('a reply with no mermaid is left to the engine', async ($, on) => {
  await boot($, on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  const ui = await $.ui.mount(message('plain words only', ROOMY))

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('a disabled feature is left to the engine', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  await loadPrefs($)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  const ui = await $.ui.mount(message(reply(FLOW), ROOMY))

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(await ui.find({ key: 'toggle1' })).toBeUndefined()
  await ui.unmount()
})

test('desktop is left to the engine', async ($, on) => {
  await boot($, on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...message(reply(FLOW), ROOMY), surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})
```
These tests mount through the full plugin, so they need the feature registered: Task 10 wires the registry. Run them after Task 10 step 3; the steps below build the pieces first.

- [ ] **Step 2: Write the view**

`hooks/features/mermaid/view.tsx`:
```tsx
import { read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FeatureContext } from '../../core/feature'
import { shownAtom } from '../../core/state'
import type { Segment } from './detect'
import { fitDiagram } from './fit'

const LINE_CHARS = /[─-╿■-◿←-⇿]/

type Run = { text: string; isLine: boolean }

function runsOf(line: string): Run[] {
  const runs: Run[] = []
  for (const ch of line) {
    const isLine = LINE_CHARS.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.isLine === isLine) last.text += ch
    else runs.push({ text: ch, isLine })
  }

  return runs
}

type Props = {
  surface: string
  requestId: string
  viewport?: { columns: number; rows: number }
  [key: string]: unknown
}

export async function drawReply(
  $: EngineInterface,
  e: any,
  segments: Segment[],
  ctx: FeatureContext,
) {
  const viewport = (e as Props).viewport
  if (!viewport) {
    ctx.postNote($, 'Diagrams left as code: terminal size unknown')

    return null
  }

  const { Box, Text, Markdown, Button } = $.ui.resolve(e)
  const shown = await read($, shownAtom)

  const nodes = segments.map((segment, i) => {
    if (segment.kind === 'text') {
      return <Markdown key={`t${i}`} text={segment.text} />
    }

    const lines = fitDiagram(segment.source, viewport)
    if (lines === null) {
      return <Markdown key={`r${i}`} text={segment.raw} />
    }

    const id = `${e.requestId}:${i}`
    const isSource = shown[id] === true

    return (
      <Box key={`d${i}`} flexDirection="column">
        {isSource ? (
          <Markdown text={segment.raw} />
        ) : (
          lines.map(line => (
            <Text>
              {runsOf(line).map(run => (
                <Text dimColor={run.isLine}>{run.text}</Text>
              ))}
            </Text>
          ))
        )}
        <Button
          key={`toggle${i}`}
          plain
          onPress={() => update($, shownAtom, map => ({ ...map, [id]: !map[id] }))}
        >
          {isSource ? 'show diagram' : 'show source'}
        </Button>
      </Box>
    )
  })

  return <Box flexDirection="column">{nodes}</Box>
}
```
`drawReply` returns `null` for "leave to the engine"; the hook turns that into `next(e)`.

- [ ] **Step 3: Write the feature**

`hooks/features/mermaid/index.ts`:
```ts
import type { Feature } from '../../core/feature'
import { splitReply } from './detect'
import { drawReply } from './view'

const QUICK_CHECK = /^(?:`{3,}|~{3,})[ \t]*mermaid/im

export const mermaid: Feature = {
  id: 'mermaid',
  name: 'Mermaid diagrams',
  description: 'Draw mermaid diagrams as text diagrams',
  defaultEnabled: true,
  register(on, ctx) {
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
      if (e.surface !== 'terminal') return next(e)
      const text = e.props.text
      if (!QUICK_CHECK.test(text)) return next(e)

      const segments = splitReply(text)
      if (!segments.some(segment => segment.kind === 'mermaid')) return next(e)

      const tree = await drawReply($, e, segments, ctx)

      return tree ?? next(e)
    })
  },
}
```
`index.ts` has no JSX; `view.tsx` holds it.

- [ ] **Step 4: Type-check**

Run: `npx tsc -p .`
Expected: no errors. If `drawReply`'s `e: any` or the `Props` cast is rejected, narrow `e` to the matched event type exported by `claude-code` for the `ui.render` hook; keep the behavior.

- [ ] **Step 5: Commit (tests run after Task 10)**

```bash
git add hooks/features/mermaid/view.tsx hooks/features/mermaid/index.ts hooks/features/mermaid/index.test.tsx
git commit -m "Add mermaid feature view and tests"
```

---

## Task 10: Registry and entry module

**Files:** create `hooks/core/registry.ts`, `hooks/manager/index.ts` (stub, filled in Task 11); modify `hooks/register.tsx`; create `hooks/register.test.tsx`.

- [ ] **Step 1: Write the registry and a manager stub**

`hooks/core/registry.ts`:
```ts
import { mermaid } from '../features/mermaid'
import type { Feature } from './feature'

export const features: Feature[] = [mermaid]
```

`hooks/manager/index.ts` (stub):
```ts
import type { On } from 'claude-code'

export function registerManager(_on: On): void {}
```

- [ ] **Step 2: Write the entry module**

`hooks/register.tsx`:
```tsx
import type { Register } from 'claude-code'

import { addError, reportNote } from './core/errors'
import { gateOn } from './core/gate'
import { loadPrefs } from './core/prefs'
import { features } from './core/registry'
import { registerManager } from './manager'

export const register: Register = on => {
  const loadFailures: Array<{ id: string; error: unknown }> = []

  on('session.start', async ($, e, next) => {
    try {
      await loadPrefs($)
    } catch {
      // An unreadable store means every feature uses its default.
    }
    for (const failure of loadFailures) {
      await addError($, failure.id, failure.error)
    }

    return next(e)
  })

  registerManager(on)

  for (const feature of features) {
    try {
      feature.register(gateOn(on, feature), {
        id: feature.id,
        postNote: ($, text) => reportNote($, feature.id, text),
      })
    } catch (error) {
      loadFailures.push({ id: feature.id, error })
    }
  }
}
```

- [ ] **Step 3: Write the entry tests**

`hooks/register.test.tsx`:
```tsx
import { expect, test } from 'claude-code/testing'

import { boot } from './core/test-harness'

test('stored choices are loaded at session start', async ($, on) => {
  await boot($, on, { prefs: { v: 1, enabled: { mermaid: false } } })
  const state = await $.state.get({ plugin: 'rich-ui', key: 'enabled' } as const)

  expect(state.value?.['mermaid']).toBe(false)
})

test('an unreadable store falls back to defaults', async ($, on) => {
  await boot($, on, { prefs: 'garbage' })
  const state = await $.state.get({ plugin: 'rich-ui', key: 'enabled' } as const)

  expect(JSON.stringify(state.value ?? {})).toBe('{}')
})
```

- [ ] **Step 4: Run everything**

Run: `claude plugin test .` then `npx tsc -p .` then `claude plugin validate .`
Expected: all pass, including the Task 9 mermaid tests. `claude plugin validate` should now list the `ui.render` hook on `AssistantMessage`, the `session.start` hook and the `$.clock.after` call.

If a Task 9 test fails, fix the code in `view.tsx` or `index.ts`; use the failing assertion to decide whether the cause is the hook, the viewport handling or the deferred note.

Two tests (`an unknown window size...` and the note test in Task 11) assume `ui.mount` leaves `viewport` unset when none is passed. If the kit supplies a default viewport, those two cannot be reproduced there: delete only them and cover the unknown-size path by hand in Task 13, step 3, adding an item to that list.

- [ ] **Step 5: Commit**

```bash
git add hooks/core/registry.ts hooks/manager/index.ts hooks/register.tsx hooks/register.test.tsx
git commit -m "Wire the registry, gate and mermaid feature into the entry module"
```

---

## Task 11: Manager pane

**Files:** create `hooks/manager/size.ts`, `hooks/manager/size.test.ts`, `hooks/manager/pane.tsx`, `hooks/manager/pane.test.tsx`; replace `hooks/manager/index.ts`.

- [ ] **Step 1: Write the failing size tests**

`hooks/manager/size.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import { clip, contentRows } from './size'

test('content rows cover header, rows, status, spacers and footer', async () => {
  expect(contentRows(1, 0, false)).toBe(5)
  expect(contentRows(2, 3, false)).toBe(9)
  expect(contentRows(1, 0, true)).toBe(6)
})

test('clip leaves short text alone and cuts long text with an ellipsis', async () => {
  expect(clip('short', 10)).toBe('short')
  expect(clip('a long description here', 10)).toBe('a long de…')
  expect(clip('anything', 0)).toBe('')
  expect(clip('anything', 1)).toBe('…')
})
```

- [ ] **Step 2: Write the failing pane tests**

`hooks/manager/pane.test.tsx`:
```tsx
import { expect, test } from 'claude-code/testing'

import { boot } from '../core/test-harness'

const PANE = {
  plugin: 'rich-ui',
  component: 'Pane',
  requestId: 'rich-ui',
  props: {
    title: 'rich-ui',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane lists each feature with a checkbox and a footer', async ($, on) => {
  await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const row = await ui.find({ key: 'mermaid' })
  expect(row?.text).toContain('[x]')
  expect(row?.text).toContain('Mermaid diagrams')
  expect(await ui.find({ type: 'Text', text: /Enter toggles/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /rich-ui 0\.1\.0/ })).toBeDefined()
  await ui.unmount()
})

test('pressing a row toggles the feature and saves the choice', async ($, on) => {
  const clock = await boot($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mermaid' })
  await clock.settle()

  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[ ]')
  const saved = await $.store.get('prefs')
  expect(JSON.stringify(saved)).toBe(
    JSON.stringify({ v: 1, enabled: { mermaid: false } }),
  )

  await ui.press({ key: 'mermaid' })
  expect((await ui.find({ key: 'mermaid' }))?.text).toContain('[x]')
  await ui.unmount()
})

test('a note and an error appear under the feature row', async ($, on) => {
  const clock = await boot($, on)
  const diagram = await $.ui.mount({
    plugin: 'rich-ui',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text: '```mermaid\ngraph TD\n A-->B\n```', isFirstOfReply: true },
  })
  await clock.settle()
  await diagram.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /terminal size unknown/ })).toBeDefined()
  await ui.unmount()
})

test('the pane is left to the engine on other surfaces', async ($, on) => {
  await boot($, on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('running /rich-ui opens the pane without transcript text', async ($, on) => {
  await boot($, on)
  let opened: unknown = null
  on('ui.open', (_, e) => {
    opened = e

    return { value: { isPlaced: true } }
  })

  const result = await $.command.run({ command: 'rich-ui' })

  expect(result.text).toBeUndefined()
  const args = opened as { id?: string; focus?: boolean; closeOnEscape?: boolean; rows?: number }
  expect(args.id).toBe('rich-ui')
  expect(args.focus).toBe(true)
  expect(args.closeOnEscape).toBe(true)
  expect((args.rows ?? 0) >= 5).toBe(true)
})
```

- [ ] **Step 3: Run to verify failure**

Run: `claude plugin test .`
Expected: FAIL, `./size` and the pane are missing (manager is a stub).

- [ ] **Step 4: Write size helpers**

`hooks/manager/size.ts`:
```ts
// header + blank + feature rows + status lines + blank + footer (+ save notice)
export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
): number {
  return featureCount + statusLines + 4 + (saveFailed ? 1 : 0)
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}
```

- [ ] **Step 5: Write the pane**

`hooks/manager/pane.tsx`:
```tsx
import { read } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Feature } from '../core/feature'
import { toggleFeature } from '../core/prefs'
import { enabledAtom, saveFailedAtom, statusAtom } from '../core/state'
import { VERSION } from '../core/version'
import { clip } from './size'

export async function drawPane(
  $: EngineInterface,
  e: any,
  features: Feature[],
) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const enabled = await read($, enabledAtom)
  const status = await read($, statusAtom)
  const saveFailed = await read($, saveFailedAtom)
  const width: number = e.props.bodyColumns ?? 80

  return (
    <Box flexDirection="column">
      <Text bold>rich-ui features</Text>
      <Text> </Text>
      {features.map(feature => {
        const isOn = enabled[feature.id] ?? feature.defaultEnabled
        const mark = isOn ? '[x]' : '[ ]'
        const room = width - mark.length - feature.name.length - 4
        const entry = status[feature.id]

        return (
          <Box key={`row-${feature.id}`} flexDirection="column">
            <Button
              key={feature.id}
              plain
              onPress={() => toggleFeature($, feature.id, feature.defaultEnabled)}
            >
              {mark} {feature.name} <Text dimColor>{clip(feature.description, room)}</Text>
            </Button>
            {entry?.error && (
              <Text color="warning">
                {clip(
                  `    ${feature.name}: failed ${entry.error.count} time${
                    entry.error.count === 1 ? '' : 's'
                  }, last error: ${entry.error.message}`,
                  width,
                )}
              </Text>
            )}
            {entry?.notes.map(note => (
              <Text dimColor>{clip(`    ${note}`, width)}</Text>
            ))}
          </Box>
        )
      })}
      <Text> </Text>
      {saveFailed && <Text color="warning">Couldn't save your choice</Text>}
      <Text dimColor>Enter toggles · Esc closes · rich-ui {VERSION}</Text>
    </Box>
  )
}
```

- [ ] **Step 6: Write the manager hooks**

`hooks/manager/index.ts` (replace the stub):
```ts
import { read } from 'claude-code'
import type { On } from 'claude-code'

import { features } from '../core/registry'
import { saveFailedAtom, statusAtom } from '../core/state'
import { drawPane } from './pane'
import { contentRows } from './size'

const PANE_ID = 'rich-ui'

export function registerManager(on: On): void {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rich-ui',
      description: 'Choose which rich-ui features are on',
    })

    return next(e)
  })

  on('command.run', { command: 'rich-ui' }, async $ => {
    const status = await read($, statusAtom)
    const saveFailed = await read($, saveFailedAtom)
    const statusLines = Object.values(status).reduce(
      (total, entry) => total + (entry.error ? 1 : 0) + entry.notes.length,
      0,
    )

    await $.ui.open({
      id: PANE_ID,
      title: 'rich-ui',
      focus: true,
      closeOnEscape: true,
      rows: contentRows(features.length, statusLines, saveFailed),
    })

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    return drawPane($, e, features)
  })
}
```

- [ ] **Step 7: Run to verify pass, type-check, validate, commit**

Run: `claude plugin test .` then `npx tsc -p .` then `claude plugin validate .`
Expected: all pass. If the button-text assertions fail because nested `Text` children are flattened differently, adjust only the `toContain` matchers to the text the kit reports.

```bash
git add hooks/manager
git commit -m "Add the /rich-ui manager pane"
```

---

## Task 12: Version check script

**Files:** create `scripts/check-version.mjs`.

- [ ] **Step 1: Write the script**

`scripts/check-version.mjs`:
```js
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(
  readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'),
)
const source = readFileSync(join(root, 'hooks/core/version.ts'), 'utf8')
const match = /VERSION\s*=\s*'([^']+)'/.exec(source)

if (!match) throw new Error('no VERSION found in hooks/core/version.ts')
if (match[1] !== manifest.version) {
  throw new Error(
    `version mismatch: version.ts says ${match[1]}, plugin.json says ${manifest.version}`,
  )
}
console.log(`version ${manifest.version} is consistent`)
```

- [ ] **Step 2: Run and commit**

Run: `npm run check:version`
Expected: `version 0.1.0 is consistent`.

```bash
git add scripts/check-version.mjs
git commit -m "Add version consistency check"
```

---

## Task 13: Live verification in a real terminal

No new files unless a fix is needed. Run `claude --plugin-dir .` in an interactive session in a real terminal (not `-p`). Record each result; fix failures with a test first.

- [ ] **Step 1: Load and open the pane**

Type `/rich-ui`. Expected: the pane opens with `[x] Mermaid diagrams`, the dim description and the footer; no extra transcript line; Esc closes it. Run it with text in the composer: it opens unfocused (click to focus).

- [ ] **Step 2: Render a diagram**

Ask Claude: "Reply with a small mermaid flowchart of login steps and a sequence diagram of a request." Expected: both draw as box-drawing text with dim lines; "show source" swaps to the code and back; surrounding text is normal.

- [ ] **Step 3: Check the open items from the docs**

Record the observed result for each, in `docs/dev/verification-notes.md`:
1. Streaming: during a reply, does an unclosed fence stay raw and swap once closed, with no flicker?
2. Is `viewport` present in the transcript, and does 6 rows feel right? Try a narrow and a short window.
3. Light and dark themes: is the dim tone readable?
4. Does toggling a diagram redraw only that message and keep the scroll position?
5. Do subgraphs and other ELK-dependent syntax fall back to code?
6. Toggle Mermaid off in the pane, then ask for another diagram: raw code, as the engine draws it. Earlier diagrams stay as drawn.
7. Quit and reopen: is the toggle remembered?
8. `/plugin uninstall` and reinstall (from a marketplace install, Task 15): what survives? Where does `$.store` live?

- [ ] **Step 4: Fix and commit**

For each failure: write a failing test that reproduces it where the kit allows, fix, rerun `claude plugin test .`, commit with a message naming the symptom. Commit the notes file:

```bash
git add docs/dev/verification-notes.md
git commit -m "Record live verification results"
```

---

## Task 14: Sync the design docs with what was built

**Files:** modify `docs/dev/architecture.md`, `docs/dev/mermaid-feature.md`, `docs/dev/manager-pane.md`, `docs/dev/readme.md`.

- [ ] **Step 1: Apply the design deltas listed at the top of this plan**

- `architecture.md`: 4.3/4.5 (status writes are deferred through `$.clock.after`; `postNote($, text)`), 4.4 (effective flag is `enabled[id] ?? defaultEnabled`), section 9 (close the items Task 13 answered).
- `mermaid-feature.md`: 3.3 (direction flip is flowchart-only), 9 (close answered items), and note that fit is decided at the last width or props change.
- `manager-pane.md`: 5 (version check is `scripts/check-version.mjs`), 8 (close answered items).
- `readme.md`: put the verified uninstall behavior (Task 13, step 3, item 8) into the working copy and the usage outline.

- [ ] **Step 2: Commit**

```bash
git add docs
git commit -m "Sync design docs with the v1 implementation"
```

---

## Task 15: User docs, README and release

**Files:** create `docs/usage.md`, `README.md`.

- [ ] **Step 1: Write `docs/usage.md`**

Follow the outline in `docs/dev/readme.md` section 5, using the verified behavior from Task 13. Every command in it must have been run.

- [ ] **Step 2: Write `README.md`**

Use the working copy in `docs/dev/readme.md` section 4 with the final pitch the owner chooses and the verified uninstall wording. Leave a clearly marked placeholder image path `docs/assets/demo.gif` until the owner records it; do not publish the repository with the placeholder.

- [ ] **Step 3: Clean-profile install check**

On a clean Claude Code profile run the README's install line exactly, then `/rich-ui`, a diagram, the toggle, and the uninstall line. Fix any mismatch in the docs or the code. Run `claude plugin validate --strict .`.

- [ ] **Step 4: Release**

```bash
npm run check:version
claude plugin validate --strict .
git add README.md docs/usage.md
git commit -m "Add README and user docs for v1"
git tag v0.1.0
```
Push only when the owner says so. After the owner records the demo GIF, add it and commit.

---

## Self-review against the design docs

- Product design (features toggle, one plugin, pane, mermaid, install/uninstall): Tasks 0, 3, 4, 9, 11, 15.
- Architecture (layout, feature contract, gate, state, status, registry, tests, distribution, version note): Tasks 0 to 5, 10, 12, 14.
- Mermaid doc (detection, sanity, fit with direction flip, text presentation, source toggle, unknown-size note, vendored bundle with a 800 KB guard, notices, renderer seam): Tasks 5 to 9.
- Manager doc (pane layout, press toggles, status styles, footer with version, `saveFailed`, command answers with no text, terminal only): Tasks 3, 11, 12.
- README doc (README, usage page, clean-profile verification): Task 15.
- Open items from the docs are closed in Task 13 and recorded in Task 14.

Out of scope and not planned here: CI, the other backlog features, image diagrams, non-terminal surfaces.
