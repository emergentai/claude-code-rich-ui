export function clip(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, width - 1)}…`
}
