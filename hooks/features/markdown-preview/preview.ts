// One drawing takes 100000 characters in all, the pane's own lines included, so
// the file's share leaves room for the path, the notices and the footer.
export const MAX_CHARS = 99_000

export const PANE_ID = 'rich-ui-preview'

export function isMarkdownPath(path: string): boolean {
  return /\.(?:md|markdown|mdx)$/i.test(path)
}

const LINK = /(!?)\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g

// Targets of the links in a reply that point at a local markdown file: no scheme
// (or file:), ending .md, .markdown or .mdx. Images and web links are left alone.
// Returned as written, which is how the engine matches the links it should answer.
export function previewLinks(text: string): string[] {
  const found = new Set<string>()
  for (const match of withoutCode(text).matchAll(LINK)) {
    if (match[1] === '!') continue
    const href = (match[2] ?? '').replace(/^<|>$/g, '')
    if (isPreviewHref(href)) found.add(href)
  }

  return [...found]
}

// The text the engine reads as prose: code fences and inline code blanked out.
function withoutCode(text: string): string {
  let inFence = false
  return text
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return ''
      }
      return inFence ? '' : line.replace(/`[^`]*`/g, '')
    })
    .join('\n')
}

// Set before the label of a link the plugin answers, so it can be told from a
// stock link. A no-break space keeps it on the line of the label after it.
// Not U+29C9 (⧉): the engine's own marker for a link that points elsewhere than
// it reads, and a label that holds it gets the target shown after it.
export const LINK_MARK = '❐\u00a0'

const LABELED = /(!?)\[([^\]]*)\](\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\))/g

// The reply text with LINK_MARK before the label of each link in `links`, for
// drawing only. The targets stay as written, which is how the engine matches the
// links it answers. Links in code fences and inline code are left as written.
export function markPreviewLinks(text: string, links: readonly string[]): string {
  const wanted = new Set(links)
  let inFence = false

  return text
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      const code = [...line.matchAll(/`[^`]*`/g)].map(m => [m.index, m.index + m[0].length] as const)

      return line.replace(
        LABELED,
        (whole: string, bang: string, label: string, target: string, href: string, at: number) => {
          if (bang === '!' || code.some(([from, to]) => at >= from && at < to)) return whole
          if (!wanted.has(href.replace(/^<|>$/g, ''))) return whole

          return `[${LINK_MARK}${label}]${target}`
        },
      )
    })
    .join('\n')
}

function bare(href: string): string {
  return href.replace(/[#?].*$/, '')
}

export function isPreviewHref(href: string): boolean {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(href)
  if (hasScheme && !/^file:/i.test(href)) return false

  return isMarkdownPath(bare(href))
}

// The absolute path a link names: a file: URL or a plain path, percent-escapes
// undone, a #fragment or ?query dropped, a relative path placed under `cwd`.
export function pathFromHref(href: string, cwd: string): string {
  let path = bare(href).replace(/^file:\/\/(?:localhost)?/i, '')
  try {
    path = decodeURIComponent(path)
  } catch {
    // Left as written when the escapes are malformed.
  }
  const full = path.startsWith('/') ? path : `${cwd.replace(/\/$/, '')}/${path}`
  const parts: string[] = []
  for (const part of full.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return `/${parts.join('/')}`
}

export function clipText(text: string): { text: string; isTruncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, isTruncated: false }

  const cut = text.slice(0, MAX_CHARS)
  // Not through the middle of an emoji's surrogate pair.
  const half = /[\ud800-\udbff]$/.test(cut)

  return { text: half ? cut.slice(0, -1) : cut, isTruncated: true }
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.length > 200 ? `${message.slice(0, 199)}…` : message
}

const IMG_TAG = /<img\b[^>]*>/gi
const MD_IMAGE = /!\[([^\]]*)\]\(\s*(<[^>]*>|(?:[^()\s]|\([^()]*\))*)(?:\s+"[^"]*")?\s*\)/g
const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

function nameOf(alt: string | undefined, src: string | undefined): string {
  const file = src?.replace(/^<|>$/g, '').replace(/[?#].*$/, '').split('/').filter(Boolean).pop()

  return alt?.trim() || file || 'image'
}

// The preview is text only. In a heading a picture is decoration and is dropped;
// anywhere else it becomes a line naming it. Entities such as `&nbsp;` are decoded.
// Code fences and inline code are shown as written.
export function textImages(text: string): string {
  let inFence = false
  const lines: string[] = []
  let block: string[] = []
  const flush = () => {
    if (block.length === 0) return
    // A tag may run over several lines: joined first, so it reads as one.
    const joined = block.join('\n').replace(IMG_TAG, tag => tag.replace(/\s*\n\s*/g, ' '))
    for (const line of joined.split('\n')) lines.push(prose(line))
    block = []
  }
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) flush()
      lines.push(line)
      inFence = !inFence
    } else if (inFence) lines.push(line)
    else block.push(line)
  }
  flush()

  return lines.join('\n')
}

function prose(line: string): string {
  const isHeading = /^\s{0,3}#{1,6}\s/.test(line)
  const replace = (name: string) => (isHeading ? '' : `[image: ${name}]`)
  const out = line
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(IMG_TAG, tag =>
              replace(
                nameOf(
                  /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1],
                  /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1],
                ),
              ),
            )
            .replace(MD_IMAGE, (_, alt: string, src: string) => replace(nameOf(alt, src)))
            .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, name: string) => ENTITIES[name] ?? ''),
    )
    .join('')

  return isHeading ? out.replace(/^(\s{0,3}#{1,6})\s+/, '$1 ').replace(/\s+$/, '') : out
}
