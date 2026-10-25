// The sayings that stand in the hint line under the prompt. Pure: no `$`, no engine.
// Traditional Zen sayings and well-known lines from the old masters, kept short because
// the line shares a row with the permission-mode pill (about 18 cells) and a window can
// be as narrow as 80. Worded plainly, without attributions.

export const ZEN_QUOTES: readonly string[] = [
  'Chop wood, carry water.',
  'Before enlightenment: chop wood. After: chop wood.',
  'Fall seven times, stand up eight.',
  'When walking, walk. When eating, eat.',
  'The obstacle is the path.',
  'Not knowing is most intimate.',
  'Muddy water, let stand, becomes clear.',
  'Move, and the way will open.',
  'Let go, or be dragged.',
  'Have you eaten? Then wash your bowl.',
  'One time, one meeting.',
  'Sitting quietly, the grass grows by itself.',
  'Nothing to gain, nothing to lose.',
  'Still water reflects the moon.',
  "Don't seek the truth; drop your opinions.",
  'This too is the way.',
  'Be where your feet are.',
  'Rest is also practice.',
  'The finger points at the moon; look at the moon.',
  'Empty your cup.',
  'Ordinary mind is the way.',
  'No snowflake falls in the wrong place.',
  'Just this.',
  'Walk on.',
]

// The longest a saying may be: 80 columns less the pill and its separator, with room to
// spare. A narrower window cuts it first.
export const ZEN_MAX = 56

// Which saying: a random pick from a roll in [0, 1), never the one just shown.
export function pickQuote(previous: number | undefined, roll: number): number {
  const count = ZEN_QUOTES.length
  const safe = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0
  const index = Math.floor(safe * count)

  return previous !== undefined && index === previous ? (index + 1) % count : index
}
