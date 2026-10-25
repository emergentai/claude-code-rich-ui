// header + blank + two rows per feature (name, description) + status lines
// + blank + footer (+ save notice)
export function contentRows(
  featureCount: number,
  statusLines: number,
  saveFailed: boolean,
): number {
  return featureCount * 2 + statusLines + 4 + (saveFailed ? 1 : 0)
}

export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}

// The welcome text field: a blank row and the field itself.
export const WELCOME_ROWS = 2
