import { expect, test } from 'claude-code/testing'

import { isPreviewHref, pathFromHref, previewLinks } from './preview'

test('only links to local markdown files are picked out', () => {
  const text = [
    '[a](docs/plan.md) and [b](/abs/spec.markdown) and [c](file:///x/notes.mdx).',
    '[web](https://example.com/readme.md) [code](src/main.ts) ![img](pic.md)',
    '[titled](<my plan.md> "A title") [again](docs/plan.md) [frag](docs/plan.md#top)',
  ].join('\n')

  expect(previewLinks(text)).toEqual([
    'docs/plan.md',
    '/abs/spec.markdown',
    'file:///x/notes.mdx',
    'my plan.md',
    'docs/plan.md#top',
  ])
})

test('schemes other than file are not preview links', () => {
  expect(isPreviewHref('http://a/b.md')).toBe(false)
  expect(isPreviewHref('mailto:a@b.md')).toBe(false)
  expect(isPreviewHref('FILE:///a/b.MD')).toBe(true)
  expect(isPreviewHref('docs/b.txt')).toBe(false)
})

test('a link becomes an absolute path', () => {
  expect(pathFromHref('docs/plan.md', '/repo')).toBe('/repo/docs/plan.md')
  expect(pathFromHref('./docs/../plan.md', '/repo/')).toBe('/repo/plan.md')
  expect(pathFromHref('/abs/a.md', '/repo')).toBe('/abs/a.md')
  expect(pathFromHref('file:///abs/a%20b.md#top', '/repo')).toBe('/abs/a b.md')
  expect(pathFromHref('../x.md?raw=1', '/repo/sub')).toBe('/repo/x.md')
})
