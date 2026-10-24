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

test('a pie chart renders with its legend', async () => {
  const result = renderDiagram('pie title Pets\n  "Dogs": 386\n  "Cats": 85')
  expect(result?.lines.join('\n')).toContain('Dogs')
  expect(result?.lines.join('\n')).toContain('%')
})

test('an xy chart renders its axis labels', async () => {
  const result = renderDiagram('xychart-beta\n  x-axis [a, b, c]\n  bar [3, 5, 7]')
  expect(result?.lines.join('\n')).toContain('b')
  expect((result?.height ?? 0) > 5).toBe(true)
})

test('a C4 context diagram renders', async () => {
  const result = renderDiagram('C4Context\n  Person(u, "User")\n  System(s, "App")\n  Rel(u, s, "uses")')
  expect(result?.lines.join('\n')).toContain('User')
})

test('an architecture diagram renders', async () => {
  const result = renderDiagram(
    'architecture-beta\n  group api(cloud)[API]\n  service db(database)[DB] in api\n  service s(server)[Srv] in api\n  s:R --> L:db',
  )
  expect(result?.lines.join('\n')).toContain('Srv')
})

test('a state diagram keeps its start and end markers', async () => {
  const result = renderDiagram('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Run: go\n  Run --> [*]')
  const text = result?.lines.join('\n') ?? ''
  expect(text).toContain('●')
  expect(text).toContain('◉')
})
