import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, ImageSource, MatchedHook, Timer } from 'claude-code'

import type { EnabledMap, PeekItem, PeekTag, PeekView } from '../../../types'
import type { Feature } from '../../core/feature'
import { isOn } from '../../core/gate'
import {
  fitCells,
  idOf,
  pngSize,
  sameTags,
  tagsIn,
  tileCaptionOf,
  tileFallbackOf,
  tileWidthOf,
} from './peek'
import { drawsPictures, engineRoot, osOf, parseSips, projectOf, sizeArgv, thumbArgv } from './platform'
import type { Os } from './platform'

// Declared here, not imported: the engine reads a state source only where it is written (docs/dev/architecture.md 4.0).
const enabledAtom = atom(
  { plugin: 'rich-ui', key: 'enabled' } as const,
  {} as EnabledMap,
  { shape: 'enabled-1' },
)
const EMPTY: PeekView = { session: '', tags: [], items: [] }
const viewAtom = atom({ plugin: 'rich-ui', key: 'peek-view' } as const, EMPTY, { shape: 'peek-view-1' })

// A tile above the prompt for each dropped image in the draft: the picture over a caption
// (docs/features/attachment-peek.md). The draft is read on a timer, and what a tag stands for is
// found on disk.
export const attachmentPeek: Feature = {
  id: 'attachment-peek',
  name: 'Attachment peek',
  description: 'Show a small picture of each dropped image above the prompt',
  isExperimental: true,
  defaultEnabled: true,
}

// Pasting or dropping raises no edit event the mod can use (the tag only turns up on the
// next keystroke), so the draft is read on a short timer.
const POLL_MS = 250
// The longest side, in pixels, of the small PNG made of a picture.
const THUMB_PIXELS = 400
// What an Image may carry as bytes in one tree: 2 MiB, as base64.
const DRAWABLE_BASE64 = 1_400_000
// Rows and columns of a tile's picture.
const TILE_ROWS = 5
const TILE_COLUMNS = 28

type World = { os: Os; root: string; env: Record<string, string | undefined>; isMouseOff: boolean }

// Module variables start over on a reload; what a drawing reads is in $.state.
let world: World | undefined
let ticker: Timer | undefined
let isChecking = false
// The folder each session's pictures are in, once found.
const imagesDirs = new Map<string, string>()
const capturing = new Set<string>()
// Tags that could not be read: not tried again until the tag leaves the draft.
const failed = new Set<string>()
// The small PNGs, as base64, read once.
const pictures = new Map<string, string>()

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'))

async function setUp($: EngineInterface): Promise<World> {
  if (world !== undefined) return world
  const osVariable = await $.env.get('OS')
  const uname = osVariable === 'Windows_NT' ? '' : (await $.process.run(['uname', '-s'])).stdout
  const os = osOf(uname, osVariable)
  const uid = os === 'windows' ? '' : (await $.process.run(['id', '-u'])).stdout.trim()
  const [claudeTmp, tmpdir, mouseOff, clicksOff] = await Promise.all([
    $.env.get('CLAUDE_CODE_TMPDIR'),
    $.env.get('TMPDIR'),
    $.env.get('CLAUDE_CODE_DISABLE_MOUSE'),
    $.env.get('CLAUDE_CODE_DISABLE_MOUSE_CLICKS'),
  ])
  // What decides whether the terminal draws pictures (see drawsPictures), each name spelled out.
  const [term, termProgram, terminal, tmux, screen, kitty, ghostty, forced, kind, images] = await Promise.all([
    $.env.get('TERM'),
    $.env.get('TERM_PROGRAM'),
    $.env.get('LC_TERMINAL'),
    $.env.get('TMUX'),
    $.env.get('STY'),
    $.env.get('KITTY_WINDOW_ID'),
    $.env.get('GHOSTTY_RESOURCES_DIR'),
    $.env.get('CLAUDE_CODE_FORCE_TERMINAL_IMAGES'),
    $.env.get('CLAUDE_CODE_SESSION_KIND'),
    $.env.get('RICH_UI_PEEK_IMAGES'),
  ])
  world = {
    os,
    root: engineRoot(os, claudeTmp, tmpdir, uid),
    env: {
      TERM: term,
      TERM_PROGRAM: termProgram,
      LC_TERMINAL: terminal,
      TMUX: tmux,
      STY: screen,
      KITTY_WINDOW_ID: kitty,
      GHOSTTY_RESOURCES_DIR: ghostty,
      CLAUDE_CODE_FORCE_TERMINAL_IMAGES: forced,
      CLAUDE_CODE_SESSION_KIND: kind,
      RICH_UI_PEEK_IMAGES: images,
    },
    isMouseOff: Boolean(mouseOff || clicksOff),
  }

  return world
}

// <root>/<project>/<session>/images, the project's folder named from the working directory,
// which may since have moved: so it is tried first, then every folder of the root is looked in.
async function imagesDir($: EngineInterface, session: string, isScan: boolean): Promise<string | undefined> {
  const held = imagesDirs.get(session)
  if (held !== undefined) return held
  const { root } = await setUp($)
  const guess = `${root}/${projectOf(await $.session.cwd())}/${session}/images`
  if (await $.fs.exists(guess).catch(() => false)) {
    imagesDirs.set(session, guess)

    return guess
  }
  if (!isScan) return undefined
  for (const entry of await $.fs.list(root).catch(() => [])) {
    if (entry.kind !== 'dir') continue
    const dir = `${root}/${entry.name}/${session}/images`
    if (await $.fs.exists(dir).catch(() => false)) {
      imagesDirs.set(session, dir)

      return dir
    }
  }

  return undefined
}

// The engine's copy of image N lands a moment after its tag does, and is written as it is
// opened: one touched in the last instant is given time to be whole before it is read.
const SETTLE_MS = 100

async function waitForImage($: EngineInterface, session: string, n: number) {
  const name = new RegExp(`^${n}\\.[A-Za-z0-9]+$`)
  const find = async (dir: string) =>
    (await $.fs.list(dir).catch(() => [])).find(e => e.kind === 'file' && name.test(e.name))
  for (let attempt = 0; attempt < 40; attempt++) {
    const dir = await imagesDir($, session, attempt % 8 === 7)
    const entry = dir === undefined ? undefined : await find(dir)
    if (dir !== undefined && entry !== undefined && entry.size > 0) {
      const age = (await $.clock.now()) - entry.mtimeMs
      if (age >= SETTLE_MS) return { dir, name: entry.name }
      await $.clock.sleep(SETTLE_MS - Math.max(0, age))
      const again = await find(dir)
      if (again !== undefined && again.size > 0) return { dir, name: again.name }
    }
    await $.clock.sleep(75)
  }

  return undefined
}

async function captureImage($: EngineInterface, session: string, tag: PeekTag): Promise<PeekItem | undefined> {
  const { os } = await setUp($)
  if (os === 'windows') return undefined
  const found = await waitForImage($, session, tag.n)
  if (found === undefined) return undefined
  const file = `${found.dir}/${found.name}`
  const ext = found.name.slice(found.name.lastIndexOf('.') + 1).toLowerCase()
  // Beside the pictures, in the session's own folder under the temp directory.
  const out = `${parentOf(found.dir)}/rich-ui-peek-${tag.n}.png`
  let width = 0
  let height = 0
  let thumb = ''

  const sizing = sizeArgv(os, file)
  const making = thumbArgv(os, file, out, THUMB_PIXELS)
  if (sizing !== undefined && making !== undefined) {
    const [seen, made] = await Promise.all([
      $.process.run(sizing).catch(() => undefined),
      makeThumb($, making, out),
    ])
    const size = seen === undefined ? undefined : parseSips(seen.stdout)
    width = size?.width ?? 0
    height = size?.height ?? 0
    thumb = made ? out : ''
  } else if (ext === 'png') {
    // Nothing here makes a thumbnail: a PNG is drawn as it is, up to what an Image may carry.
    const bytes = await $.fs.read(file, { as: 'bytes' }).catch(() => undefined)
    const size = bytes === undefined ? undefined : pngSize(bytes.base64)
    width = size?.width ?? 0
    height = size?.height ?? 0
    if (bytes !== undefined && bytes.base64.length <= DRAWABLE_BASE64) {
      pictures.set(file, bytes.base64)
      thumb = file
    }
  }
  const stat = await $.fs.stat(file).catch(() => undefined)

  return { kind: 'image', n: tag.n, ext, bytes: stat?.size ?? 0, width, height, thumb }
}

// The file may still be being written when it is first seen, so a failed conversion is tried again.
async function makeThumb($: EngineInterface, argv: string[], out: string): Promise<boolean> {
  if (await $.fs.exists(out).catch(() => false)) return true
  for (let attempt = 0; attempt < 3; attempt++) {
    const done = await $.process.run(argv).catch(() => undefined)
    if (done?.exitCode === 0) return true
    await $.clock.sleep(120)
  }

  return false
}

async function capture($: EngineInterface, session: string, tag: PeekTag) {
  const key = `${session}:${idOf(tag)}`
  capturing.add(key)
  try {
    const item = await captureImage($, session, tag)
    if (item === undefined) {
      failed.add(key)

      return
    }
    const view = await read($, viewAtom)
    if (view.session !== session || !view.tags.some(t => idOf(t) === idOf(tag))) return
    await update($, viewAtom, v => ({ ...v, items: [...v.items.filter(i => idOf(i) !== idOf(item)), item] }))
    $.ui.invalidate('ui.render')
  } catch {
    failed.add(key)
  } finally {
    capturing.delete(key)
  }
}

async function check($: EngineInterface) {
  if (isChecking) return
  isChecking = true
  try {
    const view = await read($, viewAtom)
    if (!isOn(await read($, enabledAtom), attachmentPeek)) {
      if (view.tags.length > 0 || view.items.length > 0) {
        await update($, viewAtom, () => EMPTY)
        $.ui.invalidate('ui.render')
      }

      return
    }
    const session = await $.session.id()
    const draft = (await $.prompt.read()).text
    const tags = tagsIn(draft)
    const isSame = view.session === session
    for (const key of failed) if (!tags.some(tag => key === `${session}:${idOf(tag)}`)) failed.delete(key)

    // What is known of a tag stays while the tag does; a new session knows nothing.
    const known = isSame ? view.items : []
    if (!isSame || !sameTags(view.tags, tags)) {
      const kept = known.filter(item => tags.some(tag => idOf(tag) === idOf(item)))
      await update($, viewAtom, () => ({ session, tags, items: kept }))
      // Only the pictures of what is still in the draft are held.
      for (const path of pictures.keys()) {
        if (!kept.some(item => item.thumb === path)) pictures.delete(path)
      }
      $.ui.invalidate('ui.render')
    }
    for (const tag of tags) {
      const key = `${session}:${idOf(tag)}`
      if (known.some(item => idOf(item) === idOf(tag)) || capturing.has(key) || failed.has(key)) continue
      void capture($, session, tag)
    }
  } finally {
    isChecking = false
  }
}

// Called from the one session.start hook (the engine allows one unmatched hook per event).
export function startPeek($: EngineInterface) {
  ticker?.cancel()
  ticker = $.clock.every(POLL_MS, () => {
    void check($).catch(() => undefined)
  })
}

// The tiles go the moment a prompt is sent, not at the next read of the draft (up to POLL_MS later).
export const clearPeeks: Hook<'prompt.submit'> = async ($, e, next) => {
  const view = await read($, viewAtom)
  if (view.tags.length > 0 || view.items.length > 0) {
    await update($, viewAtom, () => EMPTY)
    $.ui.invalidate('ui.render')
  }

  return next(e)
}

async function pictureOf($: EngineInterface, item: PeekItem): Promise<ImageSource | undefined> {
  if (item.thumb === '') return undefined
  const held = pictures.get(item.thumb)
  if (held !== undefined) return { png: held }
  const bytes = await $.fs.read(item.thumb, { as: 'bytes' }).catch(() => undefined)
  if (bytes === undefined || bytes.base64.length > DRAWABLE_BASE64) return undefined
  pictures.set(item.thumb, bytes.base64)

  return { png: bytes.base64 }
}

export const renderPeeks: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
  if (!isOn(await read($, enabledAtom), attachmentPeek)) return next(e)
  const view = await read($, viewAtom)
  const items = view.tags.flatMap(tag => view.items.filter(item => idOf(item) === idOf(tag)))
  if (items.length === 0) return next(e)

  const rest = await next(e)
  const { Box, Text, Image } = $.ui.resolve(e)
  const there = await setUp($).catch(() => undefined)
  const hasPictures = there !== undefined && drawsPictures(there.env, e.viewport?.isFullscreen === true)
  const columns = Math.max(10, e.props.bodyColumns ?? 80)
  const rows = Math.min(TILE_ROWS, e.props.maxRows - 3)
  if (rows < 1) return rest

  // The picture of each tile, where the terminal draws one; a tile without one is sized to its words.
  const sources = new Map<string, ImageSource | undefined>()
  await Promise.all(
    items.map(async item => sources.set(idOf(item), hasPictures ? await pictureOf($, item) : undefined)),
  )
  const tileWidth = (item: PeekItem) =>
    tileWidthOf(item, rows, TILE_COLUMNS, sources.get(idOf(item)) !== undefined)

  // One tile: a picture over a one-line caption, in a round frame.
  const tileOf = (item: PeekItem) => {
    const source = sources.get(idOf(item))
    const cells = fitCells(item.width, item.height, rows, TILE_COLUMNS)

    return (
      <Box
        key={`peek-tile-${idOf(item)}`}
        flexDirection="column"
        alignItems="center"
        borderStyle="round"
        borderDimColor
        paddingX={1}
        width={tileWidth(item)}
        flexShrink={0}
      >
        {source !== undefined ? (
          <Image
            key={`peek-image-${idOf(item)}`}
            source={source}
            columns={cells.columns}
            rows={cells.rows}
            alt={`[Image #${item.n}]`}
          />
        ) : (
          <Text dimColor wrap="truncate">{tileFallbackOf(item)}</Text>
        )}
        <Text dimColor wrap="truncate">{tileCaptionOf(item)}</Text>
      </Box>
    )
  }

  // As many tiles as fit across, with `+N` for the rest.
  const shown: PeekItem[] = []
  let used = 0
  for (const item of items) {
    const width = tileWidth(item)
    if (shown.length > 0 && used + width + 1 > columns - 4) break
    shown.push(item)
    used += width + 1
  }
  const tiles = shown.map(tileOf)
  const hidden = items.length - shown.length

  return (
    <Box flexDirection="column">
      {rest}
      <Box flexDirection="row" columnGap={1} alignItems="center" marginTop={1}>
        {tiles}
        {hidden > 0 && <Text dimColor>{`+${hidden}`}</Text>}
      </Box>
    </Box>
  )
}
