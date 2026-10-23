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
