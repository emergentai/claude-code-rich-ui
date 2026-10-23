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
