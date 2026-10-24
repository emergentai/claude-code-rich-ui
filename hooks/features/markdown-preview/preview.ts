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
  for (const match of text.matchAll(LINK)) {
    if (match[1] === '!') continue
    const href = (match[2] ?? '').replace(/^<|>$/g, '')
    if (isPreviewHref(href)) found.add(href)
  }

  return [...found]
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

  return { text: text.slice(0, MAX_CHARS), isTruncated: true }
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.length > 200 ? `${message.slice(0, 199)}…` : message
}

const IMG_TAG = /<img\b[^>]*>/gi
const MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g
const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

function nameOf(alt: string | undefined, src: string | undefined): string {
  return alt?.trim() || src?.split(/[/?#]/).filter(Boolean).pop() || 'image'
}

// The preview is text only. In a heading a picture is decoration and is dropped;
// anywhere else it becomes a line naming it. Entities such as `&nbsp;` are decoded.
export function textImages(text: string): string {
  let inFence = false
  return text
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
      if (inFence) return line
      const isHeading = /^\s{0,3}#{1,6}\s/.test(line)
      const replace = (name: string) => (isHeading ? '' : `[image: ${name}]`)
      const out = line
        .replace(IMG_TAG, tag =>
          replace(
            nameOf(
              /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1],
              /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1],
            ),
          ),
        )
        .replace(MD_IMAGE, (_, alt: string, src: string) => replace(nameOf(alt, src)))
        .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, name: string) => ENTITIES[name] ?? '')
      return isHeading ? out.replace(/^(\s{0,3}#{1,6})\s+/, '$1 ').replace(/\s+$/, '') : out
    })
    .join('\n')
}
