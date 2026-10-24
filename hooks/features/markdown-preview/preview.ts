// One drawing takes 100000 characters in all, the pane's own lines included, so
// the file's share leaves room for the path, the notices and the footer.
export const MAX_CHARS = 99_000

export const PANE_ID = 'rich-ui-preview'

export function isMarkdownPath(path: string): boolean {
  return /\.(?:md|markdown|mdx)$/i.test(path)
}

// "  'notes/plan.md' " and the same in double quotes become the bare path.
export function pathFromArgs(args: string): string | undefined {
  const trimmed = args.trim().replace(/^(['"])(.*)\1$/, '$2').trim()

  return trimmed === '' ? undefined : trimmed
}

export function clipText(text: string): { text: string; isTruncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, isTruncated: false }

  return { text: text.slice(0, MAX_CHARS), isTruncated: true }
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.length > 200 ? `${message.slice(0, 199)}…` : message
}
