// banner (3 rows) + divider + per feature a blank row above its two rows (name,
// description) + status lines + a blank row (the save notice, when set, takes it)
// + the footer.
export const HEADER_ROWS = 3

// Experimental features sit under their own header: a blank row and the header line, and
// the welcome text field is a bordered box, three rows, under the greeting.
export const EXPERIMENTAL_HEADER_ROWS = 2
export const FIELD_ROWS = 3

export function experimentalCount(features: readonly { isExperimental?: boolean }[]): number {
  return features.filter(feature => feature.isExperimental === true).length
}

export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
  experimental = 0,
  extraDescriptionRows = 0,
): number {
  return (
    HEADER_ROWS +
    1 +
    featureCount * 3 +
    extraDescriptionRows +
    statusLines +
    1 +
    (saveFailed ? 1 : 0) +
    1 +
    (experimental > 0 ? EXPERIMENTAL_HEADER_ROWS + FIELD_ROWS : 0)
  )
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}

// A description may take this many rows; what does not fit is cut with an ellipsis.
export const DESCRIPTION_MAX_LINES = 2

// Word-wraps text to `width`, at most `maxLines` lines; the last line is clipped if text remains.
export function wrap(text: string, width: number, maxLines = DESCRIPTION_MAX_LINES): string[] {
  if (width <= 0) return ['']

  const lines: string[] = []
  let rest = text.trim()
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= width) {
      lines.push(rest)
      rest = ''
      break
    }
    const cut = rest.lastIndexOf(' ', width)
    const at = cut > 0 ? cut : width
    lines.push(rest.slice(0, at).trimEnd())
    rest = rest.slice(at).trimStart()
  }
  if (rest.length > 0) lines[lines.length - 1] = clip(`${lines[lines.length - 1]} ${rest}`, width)

  return lines.length > 0 ? lines : ['']
}
