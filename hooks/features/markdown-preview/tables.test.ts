import { expect, test } from 'claude-code/testing'
import { fitTables } from './tables'

const table = '| Feature | What it does |\n|---|---|\n| Mermaid diagrams | Complete **mermaid** blocks in Claude\'s replies are drawn as text diagrams. |\n'

test('draws a table inside the width', () => {
  const out = fitTables(`intro\n\n${table}\nafter`, 50)
  const box = out.split('\n').filter(l => /^[┌│├└]/.test(l))
  expect(box.length).toBeGreaterThan(4)
  for (const l of box) expect(l.length).toBeLessThanOrEqual(50)
  expect(out).toContain('intro')
  expect(out).toContain('after')
  expect(out).not.toContain('**')
})

test('leaves tables inside code fences alone', () => {
  const src = '```\n' + table + '```'
  expect(fitTables(src, 50)).toBe(src)
})
