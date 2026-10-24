import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outfile = join(root, 'hooks/vendor/zombie-mermaid.js')
const LIMIT = 800 * 1024

await build({
  stdin: {
    contents: `export { renderMermaidAscii } from '@zombie-mermaid/ascii-renderer'`,
    resolveDir: here,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  minify: true,
  legalComments: 'none',
  outfile,
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
