// banner (3 rows) + divider + per feature a blank row above its two rows (name,
// description) + status lines + a blank row (the save notice, when set, takes it)
// + the footer.
export const HEADER_ROWS = 3

export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
): number {
  return HEADER_ROWS + 1 + featureCount * 3 + statusLines + 1 + (saveFailed ? 1 : 0) + 1
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}
