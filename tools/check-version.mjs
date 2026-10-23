import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(
  readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'),
)
const source = readFileSync(join(root, 'hooks/core/version.ts'), 'utf8')
const match = /VERSION\s*=\s*'([^']+)'/.exec(source)

if (!match) throw new Error('no VERSION found in hooks/core/version.ts')
if (match[1] !== manifest.version) {
  throw new Error(
    `version mismatch: version.ts says ${match[1]}, plugin.json says ${manifest.version}`,
  )
}
console.log(`version ${manifest.version} is consistent`)
