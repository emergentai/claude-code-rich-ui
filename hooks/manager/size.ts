// banner (3 rows) + divider + two rows per feature (name, description) with a
// blank row between features + status lines + (save notice) + footer.
export const HEADER_ROWS = 3

export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
): number {
  return HEADER_ROWS + 1 + Math.max(0, featureCount * 3 - 1) + statusLines + 1 + (saveFailed ? 1 : 0)
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}
