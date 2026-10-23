# <img src="docs/assets/rich-ui.png" alt="rich-ui logo" width="56" height="56" align="absmiddle">&nbsp;&nbsp;&nbsp;rich-ui

### Upgrade Claude Code's interface, one switch at a time.

rich-ui is a Claude Code mod that upgrades the terminal interface itself, one feature
at a time: things the stock UI shows as plain text get drawn properly. It never
changes what Claude says or does, only how it looks, and every feature has its own
switch.

> **First up:** mermaid diagrams, drawn right in the transcript instead of dumped as code.

![rich-ui drawing a mermaid diagram in Claude Code](docs/assets/demo.gif)

## 📦 Install

```
/plugin install rich-ui --marketplace emergentai/claude-code-rich-ui
```

That adds this repo as a marketplace and installs the plugin. Mods are on by default in
the terminal from Claude Code 2.1.287, so there is nothing else to enable. Works in the
terminal only (not the desktop app or the IDE extensions), and the mods API is still
early access, so it can shift between Claude Code releases. Tested on 2.1.309.

Marketplaces like this one don't auto-update by default; turn it on in `/plugin`
(Marketplaces tab) if you want new features as they land.

## ✨ What you get

| Feature | What it does |
|---|---|
| Mermaid diagrams | Complete mermaid blocks in Claude's replies are drawn as text diagrams. A dim `show source` line above each one swaps it back to the code. |

Flowcharts (subgraphs included), sequence, class, state and ER diagrams are drawn. Any
other type stays the code block it always was, and so does anything too big for your
window.

It all runs locally. No network calls, no telemetry.

## 🎚️ Switch things off

`/rich-ui` opens the feature list. Click a row, or Enter, to flip it; your choices are
remembered. Turning a feature off puts the transcript back exactly as stock Claude Code
draws it, including diagrams already on screen.

## Uninstall

```
/plugin uninstall rich-ui
```

That removes the plugin. Your on/off choices are kept in Claude Code's plugin store
(`~/.claude/plugins/store/rich-ui_*.json`), which an uninstall is not documented to
clear, so a reinstall picks them up again. Delete that file if you want a clean slate.

## 🗺️ Coming next

Planned, not promised: rendered tables, a markdown preview pane, a context bar, inline
edit diffs, image-quality diagrams. The bar for anything new is that it should help in
most sessions and add no clutter; the longer version is in
[`docs/FEATURES.md`](docs/FEATURES.md).

## 📚 Docs and help

[Usage, troubleshooting and FAQ](docs/usage.md) · [Report an issue](../../issues)

MIT licensed. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
