// banner (3 rows) + divider + two rows per feature (name, description) + status
// lines + (save notice) + footer. Kept to 11 rows for the three features: an
// inline pane is capped by the terminal's height (the footer was cut at 40 rows
// with a second divider), so no row is spent on decoration below the list.
export const HEADER_ROWS = 3

export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
): number {
  return HEADER_ROWS + 1 + featureCount * 2 + statusLines + (saveFailed ? 1 : 0) + 1
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}
