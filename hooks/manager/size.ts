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

// The body columns the docked pane asks for: its widest line (a description
// indented four cells, or the footer) plus the two cells of side padding. The
// engine grants between 24 columns and 45% of the terminal, and the inline
// frame ignores it.
export function contentColumns(
  descriptions: string[],
  footer: string,
): number {
  const widest = Math.max(
    footer.length,
    ...descriptions.map(description => description.length + 4),
  )

  return widest + 2
}
