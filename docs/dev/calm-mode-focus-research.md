# rich-ui: the stock /focus view and calm mode

Status: research, 2026-10-25, from Claude Code's public docs (the fullscreen, commands and settings-reference pages) and the engine's type contract. Nothing here was run against a build.

## What /focus is

Claude Code's own quiet view, a toggle:

> `/focus` Toggle the focus view, which shows only your last prompt, a one-line tool-call summary with edit diffstats, and the final response. The tool-call summary also counts the subagents launched in the turn and collapses completed background-task notifications into a single count. The selection persists across sessions; set `viewMode` in settings to override it. Only available in fullscreen rendering. From a Remote Control client, run `/focus [on|off]` ... for the current session only ... (v2.1.281 or later).

- **It is the same idea as calm.** It hides intermediate prose and tool rows and keeps a one-line summary. It is stock, so it also handles the parts a mod cannot: it is one setting, not a set of hooks, and it covers subagents and background-task notices.
- **Fullscreen only.** In the classic renderer the command is not available (the docs say so; a reported "Unknown command" on Windows is a related symptom). Fullscreen is the default for new users since 2026-05-06 on accounts that fetch feature flags, and is `/tui fullscreen` otherwise.
- **Persisted, with a setting.** `viewMode` takes `default`, `verbose` or `focus`; it also overrides the older `verbose` flag. ctrl+o is the separate transcript view.
- **Other quiet settings the docs list** (not rich-ui's to set, and outside this round): `spinnerTipsEnabled`, `spinnerVerbs`, `prefersReducedMotion`, `showTurnDuration`, `promptSuggestionEnabled`, `terminalProgressBarEnabled`, `awaySummaryEnabled`, `statusLine`.

## Can a preset turn it on?

Probably, with two limits.

- **Running it.** `$.command.run({ command: 'focus' })` runs a slash command as if the person typed it, queued until the session is idle (the type contract's description). Whether it reaches a built-in and not only a plugin command is unverified.
- **Toggle, not a switch.** `/focus` flips the view and takes no argument outside Remote Control. A preset that runs it blind would turn focus off for a person who had it on. It needs the current state first: `$.config.list()` may carry a `viewMode` row (unverified; no row list was read on 2.1.310), and `$.config.set({ key: 'viewMode', value: 'focus' })` would then be the safe way, since it sets a value and does not toggle.
- **Overlap.** In focus view the stock renderer already hides tool rows and prose, so calm's tool-row, narration and turn-end changes would have nothing left to hide, and the calm spinner would still draw. The two can run together; the result is mostly focus's.

## Decision

The person using this runs `/focus`, so calm does not hide tool rows or narration (both were
built, then removed). Calm is the spinner and the footer, which focus view does not touch.

## Recommendation

Do not build a preset action for it now. Say in the docs that Claude Code has `/focus` (fullscreen only), that it overlaps with calm, and that calm is for the classic renderer and for people who want the transcript quieter without losing the tool summary line. If a "Focus" row is wanted later, first run `$.config.list()` on a build and look for `viewMode`; with that row it is a small addition (a preset that sets a value, not a command).

## Open checks

1. Does `$.config.list()` on 2.1.310 include `viewMode` (or `verbose`)?
2. Does `$.command.run({ command: 'focus' })` reach the built-in?
3. How do calm's hooks behave under focus view (do `ToolUse` rows still reach the hooks, or does the renderer skip them)?
