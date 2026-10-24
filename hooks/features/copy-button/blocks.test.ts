import { expect, test } from 'claude-code/testing'

import { copyableBlocks, copiedToast, labelFor, LONG_LINE, MAX_BLOCKS } from './blocks'

const fence = (body: string, info = 'ts', mark = '```') => `${mark}${info}\n${body}\n${mark}`

test('a block gives its source without fence lines or a final newline', () => {
  const [block] = copyableBlocks(`Intro\n\n${fence('const a = 1\nconst b = 2')}\n\nOutro`)

  expect(block).toEqual({ language: 'ts', text: 'const a = 1\nconst b = 2', lines: 2 })
})

test('blank lines at the ends are dropped, inner ones and trailing spaces kept', () => {
  const [block] = copyableBlocks(fence('\n\nx = 1  \n\ny = 2\n\n'))

  expect(block?.text).toBe('x = 1  \n\ny = 2')
  expect(block?.lines).toBe(3)
})

test('a one-line block is skipped unless the line is long', () => {
  expect(copyableBlocks(fence('npm install'))).toEqual([])
  expect(copyableBlocks(fence('x'.repeat(LONG_LINE)))).toHaveLength(0)
  expect(copyableBlocks(fence('x'.repeat(LONG_LINE + 1)))).toHaveLength(1)
})

test('an empty block is skipped', () => {
  expect(copyableBlocks('```\n\n  \n```')).toEqual([])
})

test('an unfinished fence gives nothing, even after a finished one', () => {
  expect(copyableBlocks('```ts\na\nb')).toEqual([])
  const blocks = copyableBlocks(`${fence('a\nb')}\n\n\`\`\`sh\nstill coming\nmore`)
  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.language).toBe('ts')
})

test('a longer fence holds shorter fences inside as source', () => {
  const inner = fence('a\nb', 'ts')
  const [block] = copyableBlocks(fence(inner, 'markdown', '````'))

  expect(block?.language).toBe('markdown')
  expect(block?.text).toBe(inner)
})

test('a closing fence must match the character and be long enough', () => {
  const blocks = copyableBlocks('```ts\na\n~~~\nb\n``\nc\n```')

  expect(blocks[0]?.text).toBe('a\n~~~\nb\n``\nc')
})

test('tilde fences work', () => {
  expect(copyableBlocks(fence('a\nb', 'py', '~~~'))[0]?.language).toBe('py')
})

test('a fence indented under a list item loses that indent', () => {
  const [block] = copyableBlocks('1. Run:\n\n   ```bash\n   cd x\n     make\n   ```\n2. Done')

  expect(block?.text).toBe('cd x\n  make')
})

test('a backtick fence line with a backtick in its info is inline code, not a fence', () => {
  expect(copyableBlocks('```not a fence``` here\na\nb\n```')).toEqual([])
})

test('mermaid fences are left to the mermaid feature, in any case', () => {
  expect(copyableBlocks(fence('graph TD\n A-->B', 'mermaid'))).toEqual([])
  expect(copyableBlocks(fence('graph TD\n A-->B', 'Mermaid'))).toEqual([])
})

test('windows line endings are normalised', () => {
  expect(copyableBlocks('```ts\r\na\r\nb\r\n```\r\n')[0]?.text).toBe('a\nb')
})

test('an info string keeps only its first word as the language', () => {
  expect(copyableBlocks('```ts title="x.ts"\na\nb\n```')[0]?.language).toBe('ts')
  expect(copyableBlocks('```\na\nb\n```')[0]?.language).toBe('')
})

test('a block quote is not scanned', () => {
  expect(copyableBlocks('> ```ts\n> a\n> b\n> ```')).toEqual([])
})

test('only the first twelve blocks are kept', () => {
  const text = Array.from({ length: MAX_BLOCKS + 3 }, () => fence('a\nb')).join('\n\n')

  expect(copyableBlocks(text)).toHaveLength(MAX_BLOCKS)
})

test('labels: plain for one block, numbered with language for several', () => {
  const ts = { language: 'ts', text: 'a\nb', lines: 2 }
  const bare = { language: '', text: 'a\nb', lines: 2 }

  expect(labelFor(ts, 0, 1)).toBe('copy code')
  expect(labelFor(ts, 1, 3)).toBe('copy 2 (ts)')
  expect(labelFor(bare, 2, 3)).toBe('copy 3')
  expect(copiedToast(ts)).toBe('Copied 2 lines')
  expect(copiedToast({ ...ts, lines: 1 })).toBe('Copied 1 line')
})
