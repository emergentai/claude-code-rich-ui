# Status band

One quiet line under the prompt that shows context fullness and plan usage, but only
when they run high. A healthy session shows nothing.

- id `status-band`, name "Status band", `defaultEnabled: true`
- Toggle: its own row in `/rich-ui`; turning it off clears the line at once, turning it
  on restores it from the last reading.
- Research behind it: [`../dev/status-band-research.md`](../dev/status-band-research.md)

## What it shows

```
context ██████░░ 70%  ·  5h 92% (resets in 1h 00m)
```

Segments are joined with `  ·  `. A segment appears only at or above its threshold:

| Segment | Source | Shows from | Flagged as warning from |
|---|---|---|---|
| `context` | context window fullness, with an 8-cell bar | 60% | 85% |
| `5h` | five-hour plan window | 75% | 90% |
| `7d` | seven-day plan window | 75% | 90% |
| `spend` | spend limit | 75% | 90% |

Other limit kinds the engine reports are shown under their own name, after the three above.
Limit segments add `(resets in …)` when a reset time is known: `42m`, `2h 05m`, `3d 4h`.
A window whose reset time has already passed is dropped until a fresh reading arrives.

## Behavior

- **Where.** The engine's own status row under the prompt (`$.ui.status`), so the engine's
  styling and theme apply. It is plain text: that call takes no color or level, so the
  warning flag is computed but not drawn.
- **When it updates.** The engine raises `session.measure` when a figure moves; the line
  is rewritten then. It does not tick on its own, so a countdown is as fresh as the last
  reading.
- **`/clear`.** Ends the session with reason `clear` and no `session.start` follows, so
  the stored reading is reset and the line cleared on `session.end`. Other end reasons
  leave the line alone.
- **State.** The last reading is kept in the `usage` state atom (`UsageSnapshot` in
  `types/index.d.ts`); nothing is written to disk and nothing leaves the machine.

## Not in this version

Model and prompt-cache segments, per-segment switches, colors, narrowing to the terminal
width, and a live countdown. All were in the original idea
([`../FEATURES.md`](../FEATURES.md) backlog history) and are open.

## Code

| File | Role |
|---|---|
| `hooks/features/status-band/band.ts` | thresholds, bar, countdown, segments and the line (pure) |
| `hooks/features/status-band/index.tsx` | feature metadata, `session.measure` and `session.end` hooks |
| `hooks/manager/index.ts` | clears or restores the line when the feature is toggled |
| `hooks/register.tsx` | the two `on(...)` lines |

Tests sit beside the code (`band.test.ts`, `index.test.tsx`) and in
`hooks/manager/pane.test.tsx`.
