import { expect, test } from 'claude-code/testing'

import type { PeekItem } from '../../../types'

import { fitCells, pngSize, sameTags, snippetOf, tagsIn, tileCaptionOf } from './peek'
import { clipboardArgvs, drawsPictures, engineRoot, osOf, parseSips, projectOf } from './platform'

test('the tags of a draft: images and pastes, each once, in the order they stand', () => {
  expect(tagsIn('see [Image #3] and [Pasted text #4 +12 lines] then [Image #3] again, and [Image #5]')).toEqual([
    { kind: 'image', n: 3, lines: 0 },
    { kind: 'text', n: 4, lines: 12 },
    { kind: 'image', n: 5, lines: 0 },
  ])
})

test('a paste of one line has no "+N lines" in its tag', () => {
  expect(tagsIn('[Pasted text #1]')).toEqual([{ kind: 'text', n: 1, lines: 0 }])
  expect(tagsIn('[Pasted text #2 +1 line]')).toEqual([{ kind: 'text', n: 2, lines: 1 }])
})

test('text that only looks like a tag is not one', () => {
  expect(tagsIn('[Image 3] [Image #] Image #3 [image #3] [Pasted text #x]')).toEqual([])
  expect(tagsIn('')).toEqual([])
})

test('the same tags are the same whatever the rest of the draft says', () => {
  expect(sameTags(tagsIn('a [Image #1]'), tagsIn('[Image #1] b'))).toBe(true)
  expect(sameTags(tagsIn('[Image #1]'), tagsIn('[Image #2]'))).toBe(false)
  expect(sameTags(tagsIn('[Image #1]'), tagsIn('[Image #1] [Image #2]'))).toBe(false)
})

test('a picture box keeps the picture shape, and never passes the columns it may have', () => {
  // A cell is a little under twice as tall as wide: 6 rows of a square picture is 11 columns.
  expect(fitCells(100, 100, 6, 40)).toEqual({ columns: 11, rows: 6 })
  // A wide screenshot would be far past 40 columns, so the rows shrink to keep its shape.
  expect(fitCells(1124, 158, 6, 40)).toEqual({ columns: 40, rows: 3 })
  // A tall phone shot stays tall and narrow.
  expect(fitCells(400, 800, 6, 40)).toEqual({ columns: 5, rows: 6 })
  // A picture of unknown size is taken as 16 by 10.
  expect(fitCells(0, 0, 5, 40)).toEqual({ columns: 14, rows: 5 })
  // Never less than a row, nor narrower than the minimum.
  expect(fitCells(5000, 10, 1, 40).rows).toBe(1)
  expect(fitCells(10, 5000, 6, 40).columns).toBeGreaterThanOrEqual(4)
})

test('a PNG size comes from its first bytes; anything else has none', () => {
  // The signature, then IHDR: 1124 by 158.
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, 1124)
  new DataView(bytes.buffer).setUint32(20, 158)
  expect(pngSize(btoa(String.fromCharCode(...bytes)))).toEqual({ width: 1124, height: 158 })
  expect(pngSize(btoa('GIF89a not a png at all, just text'))).toBeUndefined()
  expect(pngSize('')).toBeUndefined()
  expect(pngSize('%%%')).toBeUndefined()
})

test('a snippet: the opening lines clipped to a width, and the count of the rest', () => {
  const text = ['alpha', 'beta\tgamma', 'x'.repeat(80), 'delta', 'epsilon', 'zeta', ''].join('\n')
  const snippet = snippetOf(text)
  expect(snippet.lines).toEqual(['alpha', 'beta  gamma', `${'x'.repeat(33)}…`])
  expect(snippet.more).toBe(3)
  expect(snippet.total).toBe(6)
  expect(snippetOf('one line').more).toBe(0)
  expect(snippetOf('a\r\nb\rc').total).toBe(3)
})

test('what a tile says under its picture', () => {
  const image: PeekItem = { kind: 'image', n: 7, ext: 'png', bytes: 28590, width: 1124, height: 158, thumb: '' }
  const text: PeekItem = { kind: 'text', n: 11, lines: [], more: 0, total: 7, chars: 412 }
  expect(tileCaptionOf(image)).toBe('#7')
  expect(tileCaptionOf(text)).toBe('#11 · 7 lines')
})

test('the system, and where Claude Code keeps a session', () => {
  expect(osOf('Darwin\n', undefined)).toBe('mac')
  expect(osOf('Linux', undefined)).toBe('linux')
  expect(osOf('', 'Windows_NT')).toBe('windows')
  expect(engineRoot('mac', undefined, '/var/folders/x/T/', '501')).toBe('/tmp/claude-501')
  expect(engineRoot('linux', undefined, '/run/user/1000/', '1000')).toBe('/run/user/1000/claude-1000')
  expect(engineRoot('linux', undefined, undefined, '1000')).toBe('/tmp/claude-1000')
  expect(engineRoot('mac', '/scratch/', undefined, '501')).toBe('/scratch/claude-501')
  expect(projectOf('/Users/me/my repo.v2')).toBe('-Users-me-my-repo-v2')
})

test('the clipboard tool follows the session: Wayland first where there is one', () => {
  expect(clipboardArgvs('mac', false)).toEqual([['pbpaste']])
  expect(clipboardArgvs('linux', true)[0]).toEqual(['wl-paste'])
  expect(clipboardArgvs('linux', false)[0]?.[0]).toBe('xclip')
  expect(clipboardArgvs('windows', false)).toEqual([])
})

test('what sips says of a picture', () => {
  expect(parseSips('/x/1.png\n  pixelWidth: 1124\n  pixelHeight: 158\n')).toEqual({ width: 1124, height: 158 })
  expect(parseSips('Error 4: no such file')).toBeUndefined()
})

test('where pictures are drawn: kitty, Ghostty, iTerm2 in fullscreen, never in tmux or screen', () => {
  expect(drawsPictures({ TERM_PROGRAM: 'ghostty' }, false)).toBe(true)
  expect(drawsPictures({ TERM: 'xterm-kitty' }, false)).toBe(true)
  expect(drawsPictures({ GHOSTTY_RESOURCES_DIR: '/x' }, true)).toBe(true)
  expect(drawsPictures({ TERM_PROGRAM: 'iTerm.app' }, true)).toBe(true)
  expect(drawsPictures({ TERM_PROGRAM: 'iTerm.app' }, false)).toBe(false)
  expect(drawsPictures({ TERM_PROGRAM: 'Apple_Terminal' }, true)).toBe(false)
  expect(drawsPictures({ TERM_PROGRAM: 'ghostty', TMUX: '/tmp/tmux-501/default,1,0' }, true)).toBe(false)
  expect(drawsPictures({ TERM_PROGRAM: 'ghostty', STY: '1.pts' }, true)).toBe(false)
  expect(drawsPictures({ TERM_PROGRAM: 'ghostty', CLAUDE_CODE_SESSION_KIND: 'bg' }, true)).toBe(false)
  // Forced on, whatever the terminal says; the override beats everything.
  expect(drawsPictures({ CLAUDE_CODE_FORCE_TERMINAL_IMAGES: '1', TMUX: 'x' }, false)).toBe(true)
  expect(drawsPictures({ RICH_UI_PEEK_IMAGES: '1', TMUX: 'x' }, false)).toBe(true)
  expect(drawsPictures({ RICH_UI_PEEK_IMAGES: '0', TERM_PROGRAM: 'ghostty' }, true)).toBe(false)
})
