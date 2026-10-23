# rich-ui

**Your terminal, with the polish of a GUI.**

rich-ui makes Claude Code's output richer and easier to read: diagrams drawn
instead of dumped as code, and more on the way. Every feature has its own
switch.

![rich-ui drawing a mermaid diagram in Claude Code](docs/assets/demo.gif)

## Install

In Claude Code:

```
/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui
```

Confirm adding the marketplace and choose a scope (the first option, user
scope, is fine). That's it: the next time Claude replies with a mermaid
diagram, you'll see it drawn.

**Requirements:** a terminal session of Claude Code (not the desktop app),
version 2.1.287 or later, tested on 2.1.309. The mods API is early access and
can change between Claude Code releases.

To get updates automatically, turn on auto-update for this marketplace in
`/plugin` (Marketplaces tab).

## Use

Type `/rich-ui` to open the feature list. Press a row (or Enter) to turn it on
or off. Your choices are remembered.

| Feature | What it does |
|---|---|
| Mermaid diagrams | Draws mermaid diagrams as text diagrams, with one press to see the source |

Mermaid support covers flowcharts, sequence, class, state and entity
relationship diagrams. Any other diagram type stays a normal code block.

## Uninstall

```
/plugin uninstall rich-ui
```

This removes the plugin and, by default, the settings it saved.

## Coming next

Planned, not promised: rendered tables, a markdown preview pane, a context bar,
inline edit diffs, and image-quality diagrams.

## Docs and help

[Usage, troubleshooting and FAQ](docs/usage.md) · [Report an issue](../../issues)

MIT licensed. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
