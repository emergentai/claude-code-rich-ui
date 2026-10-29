import { expect, test } from 'claude-code/testing'

import type { PeekItem } from '../../../types'

import { fitCells, pngSize, sameTags, tagsIn, tileCaptionOf, tileWidthOf } from './peek'
import { drawsPictures, engineRoot, osOf, parseSips, projectOf } from './platform'

test('the tags of a draft: images, each once, in the order they stand', () => {
  expect(tagsIn('see [Image #3] and [Image #5] then [Image #3] again')).toEqual([
    { kind: 'image', n: 3 },
    { kind: 'image', n: 5 },
  ])
})

test('a paste tag, and text that only looks like a tag, is not one', () => {
  expect(tagsIn('[Pasted text #4 +12 lines] [Pasted text #1]')).toEqual([])
  expect(tagsIn('[Image 3] [Image #] Image #3 [image #3]')).toEqual([])
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

test('what a tile says under its picture', () => {
  const image: PeekItem = { kind: 'image', n: 7, ext: 'png', bytes: 28590, width: 1124, height: 158, thumb: '' }
  expect(tileCaptionOf(image)).toBe('#7')
})

test('a tile is as wide as its picture or its caption, whichever is more', () => {
  const image: PeekItem = { kind: 'image', n: 5, ext: 'png', bytes: 9, width: 696, height: 524, thumb: '/t/5.png' }
  expect(tileWidthOf(image, 1, 28)).toBe(Math.max('#5'.length, fitCells(696, 524, 1, 28).columns) + 4)
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
