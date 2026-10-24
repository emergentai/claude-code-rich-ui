import { expect, test } from 'claude-code/testing'

import { clipText, isPreviewHref, LINK_MARK, markPreviewLinks, MAX_CHARS, pathFromHref, previewLinks, textImages } from './preview'
import { fitTables } from './tables'

const boxLines = (s: string) => s.split('\n').filter(l => /^[┌│├└]/.test(l))
const fits = (s: string, w: number) => boxLines(s).every(l => [...l].length <= w)

// ---- tables ----------------------------------------------------------------

test('table without leading or trailing pipes', () => {
  const out = fitTables('a | b\n--|--\n1 | 2', 40)
  expect(out).toContain('┌')
  expect(out).toContain('│ 1 ')
})

test('alignment colons in the separator', () => {
  expect(fitTables('| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |', 40)).toContain('┌')
})

test('escaped pipe stays in its cell', () => {
  const out = fitTables('| a | b |\n|---|---|\n| x \\| y | z |', 40)
  expect(out).toContain('x | y')
  expect(boxLines(out)[1]!.match(/│/g)!.length).toBe(3)
})

test('pipe inside inline code is not a cell break', () => {
  const out = fitTables('| a | b |\n|---|---|\n| `x|y` | z |', 40)
  expect(boxLines(out)[3]!.match(/│/g)!.length).toBe(3)
})

test('empty cells and ragged rows', () => {
  const out = fitTables('| a | b | c |\n|---|---|---|\n| 1 |\n| | 2 | 3 | 4 |', 40)
  expect(out).toContain('┌')
  expect(fits(out, 40)).toBe(true)
})

test('header only table', () => {
  const out = fitTables('| a | b |\n|---|---|\n', 40)
  expect(out).toContain('┌')
  expect(out).toContain('└')
})

test('single column table', () => {
  expect(fits(fitTables('| a |\n|---|\n| 1 |', 40), 40)).toBe(true)
})

test('many columns in a narrow pane still stay inside the width when they can', () => {
  const head = Array.from({ length: 8 }, (_, i) => `h${i}`)
  const src = `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n| ${head.map(() => 'some long text').join(' | ')} |`
  expect(fits(fitTables(src, 78), 78)).toBe(true)
})

test('absurdly narrow width does not throw or loop', () => {
  expect(() => fitTables('| a | b |\n|---|---|\n| 1 | 2 |', 3)).not.toThrow()
  expect(() => fitTables('| a | b |\n|---|---|\n| 1 | 2 |', 0)).not.toThrow()
  expect(() => fitTables('| a | b |\n|---|---|\n| 1 | 2 |', -5)).not.toThrow()
})

test('one very long unbroken word is cut to fit', () => {
  expect(fits(fitTables(`| a | b |\n|---|---|\n| ${'x'.repeat(300)} | y |`, 60), 60)).toBe(true)
})

test('wide characters (CJK, emoji) keep the box inside the width', () => {
  const out = fitTables('| 名前 | 説明 |\n|---|---|\n| 日本語のテキスト | 🚀 launch |', 40)
  // Terminal cells, not code units: CJK and emoji take two.
  const cells = (s: string) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠\u{1f300}-\u{1faff}]/u.test(c) ? 2 : 1), 0)
  for (const l of boxLines(out)) expect(cells(l)).toBeLessThanOrEqual(40)
  const widths = new Set(boxLines(out).filter(l => l.startsWith('│')).map(cells))
  expect(widths.size).toBe(1)
})

test('table right after a paragraph with no blank line', () => {
  expect(fitTables('Some text\n| a | b |\n|---|---|\n| 1 | 2 |', 40)).toContain('┌')
})

test('table at the end of the file without a newline', () => {
  const out = fitTables('| a | b |\n|---|---|\n| 1 | 2 |', 40)
  expect(out.endsWith('```')).toBe(true)
})

test('CRLF line endings', () => {
  const out = fitTables('| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n', 40)
  expect(out).toContain('┌')
  expect(out).not.toContain('\r')
})

test('tables inside tilde and backtick fences are left alone, an unclosed fence swallows the rest', () => {
  const t = '| a | b |\n|---|---|\n| 1 | 2 |'
  expect(fitTables('~~~\n' + t + '\n~~~', 40)).not.toContain('┌')
  expect(fitTables('```\n' + t, 40)).not.toContain('┌')
})

test('indented table in a list or quote still draws, text after it is kept', () => {
  const out = fitTables('- item\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |\n\nafter', 40)
  expect(out).toContain('after')
})

test('blockquoted table does not corrupt the quote', () => {
  const out = fitTables('> | a | b |\n> |---|---|\n> | 1 | 2 |\n\nafter', 40)
  expect(out).toContain('after')
})

test('a setext heading or horizontal rule is not a table', () => {
  expect(fitTables('Title | with pipe\n---\nbody', 40)).toBe('Title | with pipe\n---\nbody')
  expect(fitTables('a\n---\nb | c', 40)).toBe('a\n---\nb | c')
})

test('prose containing pipes is not a table', () => {
  const s = 'use a | b to choose\nnot a table'
  expect(fitTables(s, 40)).toBe(s)
})

test('two tables in a row', () => {
  const t = '| a | b |\n|---|---|\n| 1 | 2 |'
  expect(fitTables(`${t}\n\ntext\n\n${t}`, 40).match(/┌/g)!.length).toBe(2)
})

test('inline markup in cells is stripped, snake_case and math survive', () => {
  const out = fitTables('| a |\n|---|\n| **bold** [link](http://x.y) snake_case_name 2*3*4 |', 60)
  expect(out).toContain('bold link snake_case_name')
  expect(out).not.toContain('**')
})

test('a cell that is only whitespace or a lone dash', () => {
  expect(fitTables('| a | b |\n|---|---|\n|   | - |', 40)).toContain('┌')
})

test('fenced text language tag does not collide with a table that contains backticks', () => {
  const out = fitTables('| a |\n|---|\n| ``` |', 40)
  expect(out.split('\n').filter(l => l === '```').length).toBeGreaterThanOrEqual(1)
})

// ---- images and entities ---------------------------------------------------

test('img variants', () => {
  expect(textImages("<img src='a/b.png' alt='X'>")).toBe('[image: X]')
  expect(textImages('<IMG SRC="a/b.png">')).toBe('[image: b.png]')
  expect(textImages('<img src="a/b.png?raw=1#x">')).toBe('[image: b.png]')
  expect(textImages('<img>')).toBe('[image: image]')
  expect(textImages('<img alt="">')).toBe('[image: image]')
  expect(textImages('<img src="a.png"/>')).toBe('[image: a.png]')
})

test('multi-line img tag', () => {
  const out = textImages('<img\n  src="a/b.png"\n  alt="Shot"\n>')
  expect(out).not.toContain('<img')
  expect(out).toContain('Shot')
})

test('markdown image variants', () => {
  expect(textImages('![a](b.png "title")')).toBe('[image: a]')
  expect(textImages('![](dir/b.png)')).toBe('[image: b.png]')
  expect(textImages('![a](<my file.png>)')).toBe('[image: a]')
  expect(textImages('[![badge](x.svg)](https://ci.example)')).toContain('[image: badge]')
  expect(textImages('![a](b.png) and ![c](d.png)')).toBe('[image: a] and [image: c]')
})

test('markdown image with parentheses in the url', () => {
  expect(textImages('![a](b_(1).png)')).not.toContain('png)')
})

test('badges row in a heading or a list', () => {
  expect(textImages('- ![x](y.png) item')).toBe('- [image: x] item')
})

test('entities: decoded in prose, left in code', () => {
  expect(textImages('a&nbsp;b &amp; c &lt;d&gt;')).toBe('a b & c <d>')
  expect(textImages('use `&lt;div&gt;` here')).toBe('use `&lt;div&gt;` here')
  expect(textImages('&amp;lt;')).toBe('&lt;')
  expect(textImages('AT&T and &unknown; stay')).toBe('AT&T and &unknown; stay')
})

test('images inside code fences and inline code are untouched', () => {
  expect(textImages('`<img src="a.png">`')).toBe('`<img src="a.png">`')
})

test('heading with only an image becomes an empty heading marker, not junk', () => {
  expect(textImages('# <img src="a.png">')).not.toContain('<img')
})

// ---- links -----------------------------------------------------------------

test('previewLinks variants', () => {
  expect(previewLinks('[a](x.md) [b](./y.md#s) [c](<z w.md>) [d](https://e.com/f.md) [e](m.txt) ![i](p.md)')).toEqual([
    'x.md', './y.md#s', 'z w.md',
  ])
  expect(previewLinks('[a](x.md "title")')).toEqual(['x.md'])
  expect(previewLinks('[a](x.md) [a](x.md)')).toEqual(['x.md'])
  expect(previewLinks('[a](X.MD)')).toEqual(['X.MD'])
  expect(previewLinks('[a](mailto:x@y.md)')).toEqual([])
  expect(previewLinks('[a](javascript:alert(1).md)')).toEqual([])
})

test('links inside code fences are not offered', () => {
  expect(previewLinks('```\n[a](x.md)\n```')).toEqual([])
})

test('reference-style and bare links', () => {
  expect(previewLinks('[a][1]\n\n[1]: x.md')).toEqual([])
  expect(previewLinks('see x.md')).toEqual([])
})

test('isPreviewHref', () => {
  expect(isPreviewHref('')).toBe(false)
  expect(isPreviewHref('#top')).toBe(false)
  expect(isPreviewHref('file:///a/b.md')).toBe(true)
  expect(isPreviewHref('http://a/b.md')).toBe(false)
  expect(isPreviewHref('a/b.md?x=1')).toBe(true)
  expect(isPreviewHref('a/b.markdown')).toBe(true)
  expect(isPreviewHref('a/b.mdx')).toBe(true)
  expect(isPreviewHref('a/md')).toBe(false)
})

test('pathFromHref variants', () => {
  expect(pathFromHref('../../../etc/x.md', '/repo')).toBe('/etc/x.md')
  expect(pathFromHref('a/../b.md', '/repo/')).toBe('/repo/b.md')
  expect(pathFromHref('file://localhost/a/b.md', '/repo')).toBe('/a/b.md')
  expect(pathFromHref('a%2Fb%20c.md', '/repo')).toBe('/repo/a/b c.md')
  expect(pathFromHref('a%ZZ.md', '/repo')).toBe('/repo/a%ZZ.md')
  expect(pathFromHref('a//b.md', '/repo')).toBe('/repo/a/b.md')
  expect(pathFromHref('/a/b.md#x?y', '/repo')).toBe('/a/b.md')
  expect(pathFromHref('a b.md', '/repo')).toBe('/repo/a b.md')
})

// ---- clipping --------------------------------------------------------------

test('clipText boundaries', () => {
  expect(clipText('x'.repeat(MAX_CHARS)).isTruncated).toBe(false)
  expect(clipText('x'.repeat(MAX_CHARS + 1)).isTruncated).toBe(true)
  expect(clipText('').text).toBe('')
})

test('clipping does not leave half an emoji', () => {
  const text = 'x'.repeat(MAX_CHARS - 1) + '😀tail'
  const out = clipText(text).text
  expect(/[\ud800-\udbff]$/.test(out)).toBe(false)
})

test('the text after tables and images still fits the drawing limit', () => {
  // A table drawn as a box is longer than its source: the result must stay under 100000.
  const row = '| aaaaaaaaaa | bbbbbbbbbb | cccccccccc |\n'
  const src = '| h1 | h2 | h3 |\n|---|---|---|\n' + row.repeat(1500)
  const clipped = clipText(src).text
  const drawn = fitTables(textImages(clipped), 78)
  expect(drawn.length).toBeLessThan(100_000)
})

test('markPreviewLinks marks only answered links outside code', () => {
  const m = LINK_MARK
  expect(markPreviewLinks('[a](x.md) [b](y.txt)', ['x.md'])).toBe(`[${m}a](x.md) [b](y.txt)`)
  expect(markPreviewLinks('[`a`](<x y.md> "t")', ['x y.md'])).toBe(`[${m}\`a\`](<x y.md> "t")`)
  expect(markPreviewLinks('`[a](x.md)`', ['x.md'])).toBe('`[a](x.md)`')
  expect(markPreviewLinks('```\n[a](x.md)\n```', ['x.md'])).toBe('```\n[a](x.md)\n```')
  expect(markPreviewLinks('![a](x.md)', ['x.md'])).toBe('![a](x.md)')
  expect(markPreviewLinks('[a](x.md) [a](x.md)', ['x.md'])).toBe(`[${m}a](x.md) [${m}a](x.md)`)
})

test('the link mark is not the engine\'s own marker', () => {
  expect(LINK_MARK).not.toContain('⧉')
})
