export interface AsciiRenderOptions {
  useAscii?: boolean
  paddingX?: number
  paddingY?: number
  boxBorderPadding?: number
  colorMode?: 'none' | 'ansi16' | 'ansi256' | 'truecolor' | 'html' | 'auto'
}

export function renderMermaidAscii(text: string, options?: AsciiRenderOptions): string
