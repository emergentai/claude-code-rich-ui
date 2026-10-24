// SPIKE, NOT A FEATURE. Throwaway experiments for docs/dev/enhance-links-spike.md.
//
// Nothing here is imported by hooks/register.tsx and nothing ships. The prototype
// functions below (candidate finding, rewriting, the exists cache, the editor argv)
// are written in this file on purpose: when the feature is built they are rewritten
// under hooks/features/enhance-links/ with their own tests, and this file is deleted.
// What each test proves is named in the spike doc by its test title.
import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'

import { boot } from '../core/test-harness'
import { MAX_CHARS } from '../features/markdown-preview/preview'

// ---- prototype: find path references --------------------------------------

const EXT =
  'ts|tsx|js|jsx|mjs|cjs|json|md|mdx|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|zsh|bash|yml|yaml|toml|css|scss|html|vue|svelte|sql|lua|ex|exs|txt|conf|ini|lock|env|xml|gradle|tf'
// optional ./ ../ ~/ or /, directories, a file name with a known extension, then an
// optional :line, :line:col, :line-line or #Lline.
const REF = new RegExp(
  String.raw`^((?:~\/|\.{1,2}\/|\/)?(?:[\w@.+-]+\/)*[\w@+-][\w@.+-]*\.(?:${EXT}))(?::(\d+)(?::(\d+))?(?:-(\d+))?|#L(\d+)(?:-L?(\d+))?)?$`,
)

type Ref = { path: string; line?: number; col?: number; hasSlash: boolean }

export function parseRef(token: string): Ref | undefined {
  const m = REF.exec(token)
  if (!m) return undefined
  if (/^https?:|:\/\//.test(token)) return undefined
  const line = m[2] ?? m[5]
  return {
    path: m[1]!,
    line: line === undefined ? undefined : Number(line),
    col: m[3] === undefined ? undefined : Number(m[3]),
    hasSlash: m[1]!.includes('/'),
  }
}

// Inline-code spans and prose, outside fences and outside existing links.
type Piece = { kind: 'code' | 'prose'; text: string; start: number }

function pieces(text: string): Piece[] {
  const out: Piece[] = []
  let inFence = false
  let offset = 0
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    else if (!inFence) {
      // existing links [x](y) and autolinks are blanked, so they are never rewritten
      const blanked = line.replace(/!?\[[^\]]*\]\([^)]*\)|<[^>]+>/g, m => ' '.repeat(m.length))
      let last = 0
      for (const m of blanked.matchAll(/`([^`\n]+)`/g)) {
        if (m.index! > last) out.push({ kind: 'prose', text: blanked.slice(last, m.index), start: offset + last })
        out.push({ kind: 'code', text: m[1]!, start: offset + m.index! + 1 })
        last = m.index! + m[0].length
      }
      if (last < blanked.length) out.push({ kind: 'prose', text: blanked.slice(last), start: offset + last })
    }
    offset += line.length + 1
  }
  return out
}

type Hit = { token: string; start: number; end: number; ref: Ref; inCode: boolean }

// `mode`: 'code' = only inline-code spans (the author marked it as a name);
//         'any' = also bare tokens in prose.
export function findRefs(text: string, mode: 'code' | 'any'): Hit[] {
  const hits: Hit[] = []
  for (const p of pieces(text)) {
    if (p.kind === 'code') {
      const ref = parseRef(p.text.trim())
      if (ref) hits.push({ token: p.text.trim(), start: p.start, end: p.start + p.text.length, ref, inCode: true })
    } else if (mode === 'any') {
      for (const m of p.text.matchAll(/[^\s()[\]{}<>"',;!?]+/g)) {
        // trailing sentence punctuation is not part of the token
        const token = m[0].replace(/[.:]+$/, '')
        const ref = parseRef(token)
        if (ref) hits.push({ token, start: p.start + m.index!, end: p.start + m.index! + token.length, ref, inCode: false })
      }
    }
  }
  return hits
}

// href: the label itself when it has a directory and the engine accepts it as written;
// `./name` for a bare file name (a name:42 with no slash reads as a URL scheme).
export function hrefFor(ref: Ref, token: string): string {
  if (token.includes('/') || ref.line === undefined) return token
  return `./${token}`
}

export function linkify(text: string, hits: Hit[], keep: (h: Hit) => boolean = () => true): string {
  let out = ''
  let at = 0
  for (const h of [...hits].filter(keep).sort((a, b) => a.start - b.start)) {
    // for code spans the backticks around the token are part of the replaced range
    const s = h.inCode ? h.start - 1 : h.start
    const e = h.inCode ? h.end + 1 : h.end
    out += text.slice(at, s) + `[${h.inCode ? '`' + h.token + '`' : h.token}](${hrefFor(h.ref, h.token)})`
    at = e
  }
  return out + text.slice(at)
}

// ---- Q1/Q3: what counts, with and without the existence check ---------------

test('SPIKE which tokens are path references (strict: inline code only)', () => {
  const text = [
    'See `src/foo.ts:42` and `foo.test.ts:12:5` and `./a/b.py#L9-L12` and `../up/x.go:3-9`.',
    'Also `package.json`, `README.md` and `~/notes.txt`.',
  ].join('\n')
  const tokens = findRefs(text, 'code').map(h => h.token)
  expect(tokens).toEqual([
    'src/foo.ts:42',
    'foo.test.ts:12:5',
    './a/b.py#L9-L12',
    '../up/x.go:3-9',
    'package.json',
    'README.md',
    '~/notes.txt',
  ])
})

test('SPIKE false positives: what the grammar alone cannot rule out', () => {
  const prose = [
    'Node.js and Next.js and vue.js are frameworks.', // known extension, not files
    'Use version v1.2.3 or 2.0.1; ratio 3:4; time 10:30; and a:b in prose.',
    'Visit https://example.com/a.ts:42 or http://localhost:3000/x.js now.',
    'It cost 3.5 and e.g. i.e. etc. were used; and/or TCP/IP; w/o.',
    'Email me@host.com or see foo.bar.baz.',
    'Read the file c:\\dir\\x.ts on Windows.',
  ].join('\n')
  const bare = findRefs(prose, 'any').map(h => h.token)
  // Without a check, the bare scan catches names that merely end in a known extension.
  expect(bare).toContain('Node.js')
  expect(bare).toContain('Next.js')
  expect(bare).toContain('vue.js')
  // Everything else in the list above is rejected by the grammar alone.
  for (const nope of ['v1.2.3', '2.0.1', '3:4', '10:30', 'a:b', 'e.g', 'i.e', 'and/or', 'TCP/IP', 'w/o', 'foo.bar.baz', 'me@host.com']) {
    expect(bare).not.toContain(nope)
  }
  // URLs never match, so neither does their trailing :42.
  expect(bare.some(t => t.includes('example.com') || t.includes('localhost'))).toBe(false)
  // Only inline code is clean of them.
  expect(findRefs(prose, 'code')).toEqual([])
})

test('SPIKE fences, existing links and autolinks are never rewritten', () => {
  const text = [
    'Run `src/a.ts:1` now.',
    '```ts',
    '// see src/inside.ts:9 and `src/fenced.ts:3`',
    '```',
    'Already linked [the file](src/b.ts:2) and [`src/c.ts:3`](src/c.ts:3) and <https://x.com/d.ts>.',
    'Image ![alt](pics/e.png) stays.',
    '~~~',
    '`src/tilde.ts:4`',
    '~~~',
    'After the fences: `src/z.ts:26`.',
  ].join('\n')
  expect(findRefs(text, 'any').map(h => h.token)).toEqual(['src/a.ts:1', 'src/z.ts:26'])
})

test('SPIKE the rewrite keeps the text and uses a label equal to the href', () => {
  const text = 'Look at `src/foo.ts:42` then `foo.ts:7` and `package.json`.'
  const out = linkify(text, findRefs(text, 'code'))
  expect(out).toBe(
    'Look at [`src/foo.ts:42`](src/foo.ts:42) then [`foo.ts:7`](./foo.ts:7) and [`package.json`](package.json).',
  )
  // Stripping the markup gives back the original words.
  expect(out.replace(/\[`?([^\]`]*)`?\]\([^)]*\)/g, '`$1`')).toBe(text)
})

test('SPIKE a name with a line but no directory needs ./ in the href (it reads as a URL scheme)', () => {
  const ref = parseRef('foo.ts:42')!
  expect(hrefFor(ref, 'foo.ts:42')).toBe('./foo.ts:42')
  expect(hrefFor(parseRef('src/foo.ts:42')!, 'src/foo.ts:42')).toBe('src/foo.ts:42')
  expect(hrefFor(parseRef('foo.ts')!, 'foo.ts')).toBe('foo.ts')
})

test('SPIKE line, column and range forms parse', () => {
  expect(parseRef('a/b.ts:42')).toMatchObject({ path: 'a/b.ts', line: 42 })
  expect(parseRef('a/b.ts:42:7')).toMatchObject({ line: 42, col: 7 })
  expect(parseRef('a/b.ts:42-50')).toMatchObject({ line: 42 })
  expect(parseRef('a/b.ts#L42')).toMatchObject({ line: 42 })
  expect(parseRef('a/b.ts#L42-L50')).toMatchObject({ line: 42 })
  expect(parseRef('a/b.ts:')).toBeUndefined()
  expect(parseRef('a/b.ts:x')).toBeUndefined()
  expect(parseRef('a/b')).toBeUndefined() // no extension
  expect(parseRef('a/b.unknownext')).toBeUndefined()
  expect(parseRef('')).toBeUndefined()
  expect(parseRef('https://x.com/a.ts')).toBeUndefined()
})

test('SPIKE a path with a space is not a link the engine will draw, so it is skipped', () => {
  // Observed in a real terminal: [x](<with space.ts:3>) and [x](with%20space.ts:3)
  // are drawn as "x (target)" and are not clickable. The grammar has no space, so
  // such a path is never offered.
  expect(parseRef('dir/with space.ts:3')).toBeUndefined()
})

// ---- Q3: existence check and its cache ---------------------------------------

type Existence = Map<string, Promise<boolean>>

// Prototype of the per-session cache: one entry per resolved path, a promise so that
// concurrent replies share one call. Entries live for the session and are dropped
// for a path Claude writes (tool.call Write/Edit) so a new file is picked up.
function makeResolver(exists: (p: string) => Promise<boolean>, cwd: string) {
  const cache: Existence = new Map()
  const calls = { n: 0 }
  const resolve = (path: string) => {
    const abs = path.startsWith('/') ? path : `${cwd}/${path.replace(/^\.\//, '')}`
    let hit = cache.get(abs)
    if (!hit) {
      calls.n++
      hit = exists(abs).catch(() => false)
      cache.set(abs, hit)
    }
    return hit
  }
  return { resolve, cache, calls }
}

test('SPIKE bare names are kept only if they exist; the cache answers repeats', async () => {
  const real = new Set(['/repo/package.json', '/repo/src/foo.ts'])
  const r = makeResolver(async p => real.has(p), '/repo')
  const text = 'Node.js loads `package.json` and `src/foo.ts:42` and Node.js again, plus `nope.ts`.'
  const hits = findRefs(text, 'any')
  const kept: string[] = []
  for (const h of hits) if (await r.resolve(h.ref.path)) kept.push(h.token)
  expect(kept).toEqual(['package.json', 'src/foo.ts:42'])
  // Node.js twice and nope.ts once were checked once each: 4 distinct paths, not 5 hits.
  expect(r.calls.n).toBe(4)
  // A second reply naming the same files costs no engine call at all.
  for (const h of hits) await r.resolve(h.ref.path)
  expect(r.calls.n).toBe(4)
})

test('SPIKE a rejecting exists (a network location) counts as not there', async () => {
  const r = makeResolver(async () => {
    throw new Error('network location')
  }, '/repo')
  expect(await r.resolve('a/b.ts')).toBe(false)
})

test('SPIKE a long reply with many candidates stays within a bounded number of checks', async () => {
  const r = makeResolver(async () => false, '/repo')
  const text = Array.from({ length: 500 }, (_, i) => `\`dir/file${i}.ts:${i + 1}\``).join(' ')
  const hits = findRefs(text, 'code')
  expect(hits.length).toBe(500)
  // The prototype caps what it checks per reply (the engine takes at most 256 links in
  // pressableLinks anyway), so a pathological reply costs at most that many calls.
  const CAP = 256
  await Promise.all(hits.slice(0, CAP).map(h => r.resolve(h.ref.path)))
  expect(r.calls.n).toBe(CAP)
})

// ---- Q4: the editor command --------------------------------------------------

const GUI: Record<string, (path: string, line?: number) => string[]> = {
  code: (p, l) => ['code', '-g', l ? `${p}:${l}` : p],
  'code-insiders': (p, l) => ['code-insiders', '-g', l ? `${p}:${l}` : p],
  cursor: (p, l) => ['cursor', '-g', l ? `${p}:${l}` : p],
  windsurf: (p, l) => ['windsurf', '-g', l ? `${p}:${l}` : p],
  zed: (p, l) => ['zed', l ? `${p}:${l}` : p],
  subl: (p, l) => ['subl', l ? `${p}:${l}` : p],
  mate: (p, l) => (l ? ['mate', '-l', String(l), p] : ['mate', p]),
}
const TERMINAL_EDITORS = new Set(['vi', 'vim', 'nvim', 'nano', 'emacs', 'hx', 'micro', 'pico', 'ed'])

// $EDITOR may hold arguments ("code --wait") or a full path. Only the first word's
// base name is looked up in the allow-list; the rest of the variable is never used.
export function editorArgv(editorVar: string | undefined, absPath: string, line?: number): string[] | undefined {
  const first = editorVar?.trim().split(/\s+/)[0]
  if (!first) return undefined
  const name = first.split('/').pop()!
  if (TERMINAL_EDITORS.has(name)) return undefined // needs a terminal; a child with no tty cannot use it
  const build = GUI[name]
  if (!build || !absPath.startsWith('/')) return undefined
  const argv = build(absPath, line)
  // a full path in the variable is kept as argv[0] so a GUI editor outside PATH works
  return first.includes('/') ? [first, ...argv.slice(1)] : argv
}

test('SPIKE editor argv: GUI editors by name, never through a shell', () => {
  expect(editorArgv('code', '/r/a b.ts', 42)).toEqual(['code', '-g', '/r/a b.ts:42'])
  expect(editorArgv('code --wait', '/r/a.ts', 3)).toEqual(['code', '-g', '/r/a.ts:3'])
  expect(editorArgv('/usr/local/bin/cursor', '/r/a.ts', 3)).toEqual(['/usr/local/bin/cursor', '-g', '/r/a.ts:3'])
  expect(editorArgv('zed', '/r/a.ts', 3)).toEqual(['zed', '/r/a.ts:3'])
  expect(editorArgv('subl', '/r/a.ts')).toEqual(['subl', '/r/a.ts'])
  expect(editorArgv('mate', '/r/a.ts', 9)).toEqual(['mate', '-l', '9', '/r/a.ts'])
})

test('SPIKE editor argv: terminal editors, unset and unknown names get no command', () => {
  for (const v of ['vim', 'nvim', 'nano', '/usr/bin/vi', 'emacs -nw', 'hx']) expect(editorArgv(v, '/r/a.ts', 1)).toBeUndefined()
  expect(editorArgv(undefined, '/r/a.ts', 1)).toBeUndefined()
  expect(editorArgv('', '/r/a.ts', 1)).toBeUndefined()
  expect(editorArgv('   ', '/r/a.ts', 1)).toBeUndefined()
  expect(editorArgv('rm', '/r/a.ts', 1)).toBeUndefined()
  expect(editorArgv('code; rm -rf ~', '/r/a.ts', 1)).toBeUndefined() // first word "code;" is not in the list
  expect(editorArgv('$(whoami)', '/r/a.ts', 1)).toBeUndefined()
})

test('SPIKE editor argv: a relative or option-looking path is refused (argv[0] stays the allow-listed editor)', () => {
  expect(editorArgv('code', '-g', 1)).toBeUndefined()
  expect(editorArgv('code', '--help', 1)).toBeUndefined()
  expect(editorArgv('code', 'relative.ts', 1)).toBeUndefined()
})

// ---- Q1/Q2/Q4/Q6: the engine harness -------------------------------------------

// `plugin` is whose elements the test presses: 'test' for the hooks written in a test
// (they stand for the feature), 'rich-ui' for the real plugin's own.
const REPLY = (text: string, plugin = 'test') =>
  ({
    plugin,
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text, isFirstOfReply: true },
  }) as never

const PANE = {
  plugin: 'rich-ui',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'spike-code',
  props: { title: 'Code', placement: 'dock', bodyColumns: 80, view: {} },
} as never

// The windowing rule the doc proposes: a file over the drawing limit is cut to the
// lines around the one asked for, within a character budget, and says so.
export function windowAround(text: string, line: number | undefined, budget = MAX_CHARS - 2_000) {
  const lines = text.split('\n')
  if (text.length <= budget) return { first: 1, text, before: 0, after: 0 }
  const at = Math.min(Math.max((line ?? 1) - 1, 0), lines.length - 1)
  let from = Math.max(0, at - 20)
  let to = at
  let size = 0
  for (let i = from; i < at; i++) size += lines[i]!.length + 1
  while (to < lines.length && size + lines[to]!.length + 1 <= budget) size += lines[to++]!.length + 1
  if (to === at) to = at + 1 // one line wider than the budget is still shown, cut
  const body = lines.slice(from, to).join('\n')
  return { first: from + 1, text: body.length > budget ? body.slice(0, budget) : body, before: from, after: lines.length - to }
}

test('SPIKE a prototype hook rewrites a reply, keeps the href in pressableLinks, and the press reaches it', async ($, on) => {
  const seen: string[] = []
  // This hook stands for the whole feature: it sits where the engine's drawing sits.
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const hits = findRefs(e.props.text, 'code')
    const links = hits.map(h => hrefFor(h.ref, h.token))
    return (
      <Box>
        <Markdown
          key="reply"
          text={linkify(e.props.text, hits)}
          pressableLinks={links}
          onLinkPress={link => {
            seen.push(link.href)
          }}
        />
      </Box>
    ) as RenderElement
  })
  await boot($, on)
  const ui = await $.ui.mount(REPLY('Edit `src/foo.ts:42` and `bar.ts:7`.'))

  const md = await ui.find({ type: 'Markdown', key: 'reply' })
  expect(md?.text).toBe('Edit [`src/foo.ts:42`](src/foo.ts:42) and [`bar.ts:7`](./bar.ts:7).')
  await ui.press({ key: 'reply', link: { href: 'src/foo.ts:42' } } as never)
  await ui.press({ key: 'reply', link: { href: './bar.ts:7' } } as never)
  expect(seen).toEqual(['src/foo.ts:42', './bar.ts:7'])
  await ui.unmount()
})

test('SPIKE the pane draws any text file with Code: language from the path, gutter from startLine', async ($, on) => {
  const file = Array.from({ length: 12 }, (_, i) => `const v${i + 1} = ${i + 1}`).join('\n')
  on('ui.render', { component: 'Pane', requestId: 'spike-code' }, ($, e) => {
    const { Box, Text, Code } = $.ui.resolve(e)
    const w = windowAround(file, 6, 80)
    return (
      <Box flexDirection="column">
        <Text dimColor>/repo/x.ts</Text>
        {w.before > 0 && <Text dimColor>{`${w.before} lines above`}</Text>}
        <Code source={w.text} path="/repo/x.ts" startLine={w.first} />
        {w.after > 0 && <Text dimColor>{`${w.after} lines below`}</Text>}
      </Box>
    ) as RenderElement
  })
  await boot($, on)
  const pane = await $.ui.mount(PANE)

  const code = await pane.find({ type: 'Code' })
  expect(code).toBeDefined()
  expect(code?.props).toMatchObject({ path: '/repo/x.ts' })
  expect(typeof (code?.props as { startLine: number }).startLine).toBe('number')
  await pane.unmount()
})

test('SPIKE windowAround: small file whole; large file cut around the line, within budget', () => {
  const small = windowAround('a\nb\nc', 2)
  expect(small).toEqual({ first: 1, text: 'a\nb\nc', before: 0, after: 0 })

  const big = Array.from({ length: 5000 }, (_, i) => `line ${i + 1} ${'x'.repeat(40)}`).join('\n')
  expect(big.length).toBeGreaterThan(MAX_CHARS)
  const w = windowAround(big, 2500)
  expect(w.text.length).toBeLessThanOrEqual(MAX_CHARS)
  expect(w.first).toBe(2500 - 20) // 20 lines of context above the line asked for
  expect(w.text.split('\n')[20]).toContain('line 2500 ')
  expect(w.before).toBe(w.first - 1)
  expect(w.before + w.text.split('\n').length + w.after).toBe(5000)

  // Line past the end, line 0, negative and undefined all land inside the file.
  for (const l of [999_999, 0, -4, undefined]) {
    const x = windowAround(big, l as number | undefined)
    expect(x.first).toBeGreaterThanOrEqual(1)
    expect(x.text.length).toBeGreaterThan(0)
  }
  // One line wider than the budget is cut, not dropped.
  const huge = windowAround('x'.repeat(200_000) + '\nnext', 1, 1_000)
  expect(huge.text.length).toBe(1_000)
})

// ---- Q2: what Code refuses --------------------------------------------------

// The drawing takes tab and newline as its only control characters, so a file read as
// text is cleaned first: CRLF and lone CR become newlines, a NUL (or a run of other
// control characters) marks a binary file, a stray control character (an ANSI escape in
// a log) is shown as U+FFFD.
export function codeSafe(text: string): { text: string } | { binary: true } {
  const lf = text.replace(/\r\n?/g, '\n')
  if (lf.includes('\0')) return { binary: true }
  // eslint-disable-next-line no-control-regex
  const controls = lf.match(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g)?.length ?? 0
  if (controls > 8 && controls > lf.length / 50) return { binary: true }
  // eslint-disable-next-line no-control-regex
  return { text: lf.replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '\ufffd') }
}

test('SPIKE codeSafe: CRLF, a stray control character, and binary files', () => {
  expect(codeSafe('a\r\nb\rc')).toEqual({ text: 'a\nb\nc' })
  expect(codeSafe('tab\there')).toEqual({ text: 'tab\there' })
  expect(codeSafe('x\x1by')).toEqual({ text: 'x\ufffdy' }) // an ANSI escape in a log file
  expect(codeSafe('PNG\0\0data')).toEqual({ binary: true })
  expect(codeSafe('\x01\x02\x03\x04\x05\x06\x07\x08\x0e')).toEqual({ binary: true })
  expect(codeSafe('')).toEqual({ text: '' })
})

// Seen in a real terminal (the probe in the spike doc), not here: the test engine does
// not check a Code's text. A file with CRLF line ends drew fine (3 numbered lines); a file
// holding an ESC (0x1b) made the engine drop the whole pane tree (blank pane, and
// $.ui.scroll answered "no element drawn under that key"). So control characters are
// replaced before drawing, which codeSafe does.

// Not testable from here, and found by trying: a hook written in a test file cannot call
// `$.env.get` or `$.process.run`. The engine refuses with "its hooks module does not call
// it (host rule; the scan lists no calls)", because it lists the calls a plugin's module
// makes by scanning that module, and a test's hooks are not in it. The feature itself
// (in the plugin's module) is covered by the real-terminal probe in the spike doc, and
// when built its press handler is tested through the plugin with `process.run` answered
// by a hook beneath it, as markdown preview does for `fs.read`.

// ---- Q6: markdown preview and mermaid share the reply ----------------------

test('SPIKE a reply with a markdown link is answered by markdown preview, so a second hook beneath never sees it', async ($, on) => {
  let beneath = 0
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    beneath++
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text> as RenderElement
  })
  await boot($, on)

  const md = await $.ui.mount(REPLY('Plan in [plan](/repo/plan.md) and code at `src/foo.ts:42`.', 'rich-ui'))
  expect(await md.find({ type: 'Markdown', key: 'reply' })).toBeDefined()
  expect(beneath).toBe(0)
  await md.unmount()

  const code = await $.ui.mount(REPLY('Code at `src/foo.ts:42` only.'))
  expect(await code.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  expect(beneath).toBe(1)
  await code.unmount()
})

test('SPIKE a reply with a mermaid fence is answered by the mermaid feature, so a second hook beneath never sees it', async ($, on) => {
  let beneath = 0
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    beneath++
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text> as RenderElement
  })
  await boot($, on)
  const ui = await $.ui.mount({
    ...(REPLY('See `src/foo.ts:42`.\n\n```mermaid\ngraph TD; A-->B\n```') as object),
    props: { text: 'See `src/foo.ts:42`.\n\n```mermaid\ngraph TD; A-->B\n```', isFirstOfReply: true },
    viewport: { columns: 100, rows: 40 },
  } as never)
  // The mermaid feature drew it (beneath not called). The prose around the diagram is its own
  // Markdown element with no link answered, so a path there needs the shared pass.
  expect(beneath).toBe(0)
  expect(await ui.find({ type: 'Markdown', text: /src\/foo\.ts:42/ })).toBeDefined()
  await ui.unmount()
})
