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
