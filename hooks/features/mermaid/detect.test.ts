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
  same(splitReply(raw), [{ kind: 'mermaid', source: FLOW, raw }])
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
