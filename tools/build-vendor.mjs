import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outfile = join(root, 'hooks/vendor/beautiful-mermaid.js')
const LIMIT = 800 * 1024

const elkStub = `export default class ELK {
  constructor() {}
  layout() { throw new Error('elk stubbed') }
}`

await build({
  stdin: {
    contents: `export { renderMermaidASCII } from 'beautiful-mermaid'`,
    resolveDir: here,
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
