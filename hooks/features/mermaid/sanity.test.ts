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
  expect(diagramKind('xychart-beta\n bar [1]')).toBe('xychart')
  expect(diagramKind('xychart\n bar [1]')).toBe('xychart')
  expect(diagramKind('pie title Pets\n "a": 1')).toBe('pie')
  expect(diagramKind('pie showData\n "a": 1')).toBe('pie')
  expect(diagramKind('C4Context\n Person(a, "A")')).toBe('c4')
  expect(diagramKind('C4Container\n Person(a, "A")')).toBe('c4')
  expect(diagramKind('architecture-beta\n service s(server)[S]')).toBe('architecture')
})

test('unsupported and unknown headers are rejected', async () => {
  expect(diagramKind('gantt\n title x')).toBe(null)
  expect(diagramKind('mindmap\n root')).toBe(null)
  expect(diagramKind('timeline\n 2020 : a')).toBe(null)
  expect(diagramKind('pieces of eight')).toBe(null)
  expect(diagramKind('hello world')).toBe(null)
  expect(diagramKind('')).toBe(null)
})

test('front matter, comments and directives are skipped', async () => {
  const withFrontMatter = '---\ntitle: x\n---\ngraph TD\n A-->B'
  expect(diagramKind(withFrontMatter)).toBe('flowchart')

  const withDirective = '%% note\n%%{init: {"theme": "dark"}}%%\nsequenceDiagram\n A->>B: hi'
  expect(diagramKind(withDirective)).toBe('sequence')
})
