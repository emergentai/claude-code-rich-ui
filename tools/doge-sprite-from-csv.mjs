// Turns a pixel-grid CSV (a header row `row,x00,x01,...`, then one `yNN,#RRGGBB,...` row per
// line) into the sprite table in hooks/features/doge-greeting/doge.ts. The background (the
// colour in the corners and anything within TOLERANCE of it that touches the edge) is cleared,
// and the grid is cropped to what is left. Usage: node doge-sprite-from-csv.mjs grid.csv
import { readFileSync } from 'node:fs'

const TOLERANCE = 45
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1)
const grid = rows.map(line => line.split(',').slice(1).map(hex => parseInt(hex.slice(1), 16)))
const h = grid.length
const w = grid[0].length
const bg = grid[0][0]
const dist = (a, b) => Math.hypot(...[16, 8, 0].map(s => ((a >> s) & 255) - ((b >> s) & 255)))

const clear = grid.map(row => row.map(() => false))
const stack = []
for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1])
for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y])
while (stack.length > 0) {
  const [x, y] = stack.pop()
  if (x < 0 || y < 0 || x >= w || y >= h || clear[y][x] || dist(grid[y][x], bg) > TOLERANCE) continue
  clear[y][x] = true
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
}

const kept = []
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!clear[y][x]) kept.push([x, y])
const x0 = Math.min(...kept.map(p => p[0]))
const x1 = Math.max(...kept.map(p => p[0]))
const y0 = Math.min(...kept.map(p => p[1]))
const y1 = Math.max(...kept.map(p => p[1]))

console.log(`// ${x1 - x0 + 1} by ${y1 - y0 + 1}: rows of RRGGBB pixels, ...... where clear`)
for (let y = y0; y <= y1; y++) {
  let line = ''
  for (let x = x0; x <= x1; x++) line += clear[y][x] ? '......' : grid[y][x].toString(16).padStart(6, '0')
  console.log(`  '${line}',`)
}
