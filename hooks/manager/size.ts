// banner (3 rows) + divider + per feature a blank row above its two rows (name,
// description) + status lines + a blank row (the save notice, when set, takes it)
// + the footer.
export const HEADER_ROWS = 3

// Experimental features sit under their own header: a blank row and the header line, and
// the welcome text field is one more row under the greeting.
export const EXPERIMENTAL_HEADER_ROWS = 2
export const FIELD_ROWS = 1

export function experimentalCount(features: readonly { isExperimental?: boolean }[]): number {
  return features.filter(feature => feature.isExperimental === true).length
}

export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
  experimental = 0,
): number {
  return (
    HEADER_ROWS +
    1 +
    featureCount * 3 +
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
