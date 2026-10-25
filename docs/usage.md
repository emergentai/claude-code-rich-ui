# Using rich-ui

## Turning features on and off

Type `/rich-ui`. A small pane lists every feature with an on/off switch:

```
 ▀     █           ▀
 █▀▀ █ █▀▀ █▀▄ ▄▄▄ █ █ █
 █   █ █▄▄ █ █     █▄█ █                                     5 of 6 on
 ──────────────────────────────────────────────────────────────────────

 ● on   Mermaid diagrams
        Draw mermaid diagrams as text diagrams

 ● on   Status band
        Show context and plan usage under the prompt when they run high

 ● on   Markdown preview
        Open a markdown file Claude links to, rendered, in a pane

 Experimental  ·  may be removed in a future version

 ● on   Welcome greeting
        A big orange "welcome" sweeps in above the prompt once per session, then is gone
        ╭────────────────────────────────────────╮
        │ Text: welcome                     7/20 │
        ╰────────────────────────────────────────╯

 ● on   Zen spinner
        Replace the working row with one quiet line and trim the turn-end line

 ○ off  Zen footer
        Replace the hint line under the prompt with a zen saying, and hide the dim notices under the logo

 Enter toggles · Esc closes · rich-ui 0.4.1
```

Press a row, or press Enter on it, to flip the feature. Under the mouse a row
lightens. A small `error` or `note` tag beside a name means that feature has
something to tell you on the line below. Esc closes the pane. The
pane stays open after a toggle, so you can change several features in one visit.

- A change applies right away, to everything in the chat: turning Mermaid off puts
  every diagram in the conversation back to plain code, and turning it on draws
  them all again.
- Your choices are saved and come back in the next session.
- Where the pane appears is up to Claude Code: above the prompt in a narrow
  terminal, beside the conversation in a wide fullscreen one.

Features under **Experimental** are tried out and may be removed in any future version.

## Welcome greeting (experimental)

On by default (switch it off in `/rich-ui`). Once per session a big orange "welcome" sweeps
in from the left above the prompt, holds half a second and sweeps out. Send a message and it is gone at
once. Change the word in the text box under the row: it saves as you type. Details:
[`features/welcome-greeting.md`](features/welcome-greeting.md).

## Install from a shell

The one-line form works from a normal shell too (Claude Code 2.1.292 or later):

```
claude plugin install rich-ui --marketplace emergentai/claude-code-rich-ui
```

Add `--scope user`, `--scope project` or `--scope local` to choose a scope, and
`--yes` to skip the prompts.

The two-step form also works, inside Claude Code:

```
/plugin marketplace add emergentai/claude-code-rich-ui
/plugin install rich-ui@claude-code-rich-ui
```

**Updates.** Auto-update is off by default for marketplaces like this one. Turn it
on in `/plugin` (Marketplaces tab), or update by hand with
`claude plugin update rich-ui@claude-code-rich-ui`.

**Uninstall.** `/plugin uninstall rich-ui` removes the plugin (checked on a clean
profile). The marketplace stays added until you remove it with
`claude plugin marketplace remove claude-code-rich-ui`. Your on/off choices live in
Claude Code's plugin store, `~/.claude/plugins/store/rich-ui_*.json`, apart from the
plugin's data folder that Claude Code says an uninstall deletes. They survive an
uninstall, and a reinstall picks them up (turn Mermaid off, uninstall, reinstall: it is
still off); delete that file to start fresh.
The shell form also accepts `--keep-data` for the data folder.

## Status band

When the context window is 60% full or more, or a plan limit (5h, 7d, spend) is at 75%
or more, one line appears in the status row under the prompt, for example
`context ██████░░ 70%  ·  5h 92% (resets in 1h 00m)`. A healthy session shows nothing.
`/clear` resets it, and turning Status band off in `/rich-ui` hides it at once. Details:
[`features/status-band.md`](features/status-band.md).

## Zen spinner and Zen footer

Experimental; each has its own switch under Experimental in `/rich-ui`. The Zen spinner is on by default and the Zen footer is off.
The Zen spinner makes the working row one line such as `  · • ● · · · · ·  thinking 42s`,
the line that ends a turn a dim `3s`, and hides the background-task hint. The Zen footer
replaces the hint line under the prompt with a random zen saying that changes each turn
(`⏵⏵ auto mode on · Chop wood, carry water.`). To hide tool rows and the lines Claude
writes between tool calls, use Claude Code's own `/focus` view (fullscreen only). Details:
[`features/zen.md`](features/zen.md).

## Mermaid diagrams

When Claude's reply contains a complete mermaid code block, rich-ui draws it as a
text diagram. Above each diagram is a small `show source` line: press it to see the
original mermaid code, and press `show diagram` to go back.

Supported diagram types:

- flowchart (`graph` or `flowchart`, including subgraphs)
- sequence diagram
- class diagram
- state diagram
- entity relationship diagram
- XY chart (`xychart-beta`)
- pie chart
- C4 diagram (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`)
- architecture diagram (`architecture-beta`)

Everything else (gantt, journey, mindmap, timeline, gitGraph, and so on) is not drawn
and stays a normal code block.

A diagram also stays a code block when:

- the reply is still being written (the diagram appears once the closing fence
  arrives);
- it is too big for your window, even after a flowchart is turned sideways to try to
  make it fit (make the window larger and it appears on the next draw);
- the code block is inside a list or a quote.

## Troubleshooting

**My diagram stays as code.**
Check the type against the list above, and check that Mermaid diagrams is on in
`/rich-ui`. A diagram too big for the window, or a reply still being written, also
stays as code. If the terminal's size is unknown to Claude Code, rich-ui leaves
diagrams alone and says "Diagrams left as code: terminal size unknown" under the
Mermaid row in `/rich-ui`.

**`/rich-ui` is not found.**
The plugin is not installed or is turned off, or Claude Code is too old. Run
`/plugin` to check, and make sure you are in a terminal session (mods do not run in
the desktop app).

**A feature shows a warning in `/rich-ui`.**
A feature hit an error and was skipped, so Claude Code behaves as if it were off.
Turning the feature off and on clears the warning. If it keeps coming back, report
it (see below).

**It stopped working after a Claude Code update.**
The mods API is early access and can change between releases. Update rich-ui
(`claude plugin update rich-ui@claude-code-rich-ui`) and report the problem if it
persists.

**"Couldn't save your choice" appears in the pane.**
Your toggle worked for this session but could not be written to disk, so it will not
be remembered next time.

## FAQ

**Does it work in the desktop app or VS Code?**
Not yet. rich-ui works in the terminal version of Claude Code only.

**Does it send my data anywhere?**
No. Everything runs on your machine: no network calls, no telemetry.

**Why text diagrams and not images?**
Text works in every terminal with nothing extra to install. Image-quality diagrams
are planned.

**Will turning a feature off remove what is already on screen?**
Turning Mermaid off puts the diagrams in the chat back to code on the next redraw;
turning it on draws them again. Nothing is lost either way.

**How do I remove it?**
`/plugin uninstall rich-ui`.

## Reporting a problem

Open an issue and include:

- your Claude Code version (`claude --version`);
- the rich-ui version (shown at the bottom of `/rich-ui`);
- for a diagram problem, the mermaid source that did not draw.
