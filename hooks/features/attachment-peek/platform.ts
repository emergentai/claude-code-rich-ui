// What differs between systems for the attachment peek, as plain data and pure functions so a
// test reads it without an engine. macOS and Linux are covered; Windows keeps its pastes
// elsewhere and is left alone.

export type Os = 'mac' | 'linux' | 'windows'

export const osOf = (uname: string, osVariable: string | undefined): Os =>
  osVariable === 'Windows_NT' ? 'windows' : /^Darwin/i.test(uname.trim()) ? 'mac' : 'linux'

// Where Claude Code keeps a session's files: <root>/<project>/<session>/, the root being
// CLAUDE_CODE_TMPDIR or the temp folder as it resolves it (/tmp on macOS, not the per-user
// $TMPDIR; $TMPDIR or /tmp on Linux), then claude-<uid>. A drop or paste lands in its
// images/<N>.<ext>. That is Claude Code's own layout, not an API.
export const engineRoot = (os: Os, claudeTmp: string | undefined, tmpdir: string | undefined, uid: string) =>
  `${(claudeTmp || (os === 'mac' ? '/tmp' : tmpdir || '/tmp')).replace(/\/+$/, '')}/claude-${uid}`

// The project's folder in that root is the working directory with every character but a
// letter or a digit made a dash.
export const projectOf = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-')

// The clipboard as text, by the tools each system has, the session's own first. A collapsed
// paste is only a tag in the draft, but the clipboard still holds what was just pasted.
export const clipboardArgvs = (os: Os, isWayland: boolean): string[][] => {
  if (os === 'mac') return [['pbpaste']]
  if (os === 'windows') return []
  const wayland = ['wl-paste']
  const x11 = ['xclip', '-selection', 'clipboard', '-o']

  return isWayland ? [wayland, x11] : [x11, wayland]
}

// A small PNG of a picture, which the terminal can draw (it draws PNG alone): sips on
// macOS, which also reads the size of any kind of picture. No such tool ships with Linux.
export const thumbArgv = (os: Os, source: string, out: string, pixels: number): string[] | undefined =>
  os === 'mac' ? ['sips', '-s', 'format', 'png', '-Z', String(pixels), source, '--out', out] : undefined

export const sizeArgv = (os: Os, file: string): string[] | undefined =>
  os === 'mac' ? ['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', file] : undefined

export function parseSips(stdout: string): { width: number; height: number } | undefined {
  const width = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1] ?? 0)
  const height = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1] ?? 0)

  return width > 0 && height > 0 ? { width, height } : undefined
}

type Env = Readonly<Record<string, string | undefined>>

// Whether Claude Code will draw an `Image` as a picture. It decides that itself and does not
// say, so this goes by the same signs: always when CLAUDE_CODE_FORCE_TERMINAL_IMAGES is set;
// otherwise never inside tmux or screen or a background session, in kitty and Ghostty (cmux is
// one), and in iTerm2 under fullscreen rendering. Anywhere else the Image shows its alt text,
// and the card says what it is without one. RICH_UI_PEEK_IMAGES=1 or 0 overrides the guess.
export function drawsPictures(env: Env, isFullscreen: boolean): boolean {
  if (env.RICH_UI_PEEK_IMAGES === '1') return true
  if (env.RICH_UI_PEEK_IMAGES === '0') return false
  if (env.CLAUDE_CODE_FORCE_TERMINAL_IMAGES) return true
  if (env.TMUX || env.STY || env.CLAUDE_CODE_SESSION_KIND === 'bg') return false
  if (env.TERM_PROGRAM === 'iTerm.app' || env.LC_TERMINAL === 'iTerm2') return isFullscreen

  return (
    Boolean(env.KITTY_WINDOW_ID || env.GHOSTTY_RESOURCES_DIR) ||
    /kitty|ghostty/i.test(env.TERM ?? '') ||
    /^ghostty$/i.test(env.TERM_PROGRAM ?? '')
  )
}
